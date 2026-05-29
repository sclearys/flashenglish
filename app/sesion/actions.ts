"use server";

// Server Action: evalúa la transcripción del usuario llamando a la API de Anthropic.
// Esta función solo se ejecuta en el servidor — la API key nunca llega al cliente.
// Pieza G.4: antes de llamar a Anthropic, verifica 4 anillos de control de coste.

import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { crearClienteAdmin } from "@/lib/supabase-admin";
import type { ResultadoEval } from "@/lib/types";
import { TOPE_DIARIO_EVALUACIONES } from "@/lib/tutor";

const cliente = new Anthropic();

// Tipo de retorno: veredicto + explicación si todo va bien, o código de error si algún anillo lo bloquea.
type ResultadoEvaluacion =
  | { veredicto: ResultadoEval; explicacion: string | null }
  | { error: "no_autenticado" | "bloqueado" | "tutor_desactivado" | "cap_diario" };

/**
 * Recibe lo que el usuario dijo (transcripción de STT) y la frase inglesa correcta,
 * verifica los anillos de control de coste, y devuelve un veredicto IA o un error.
 *
 * Anillos de control (en orden de comprobación):
 *   1. Autenticación: debe haber sesión Supabase activa.
 *   2. Cuenta bloqueada: la cuenta no puede estar bloqueada.
 *   3. Tutor desactivado: el admin no ha desactivado el tutor para este usuario.
 *   4. Cap diario: el usuario no ha superado el límite de evaluaciones del día.
 */
export async function evaluarConTutor(
  transcripcion: string,
  fraseCorrecta: string,
  temasGramaticales: string[],
  fraseId: string
): Promise<ResultadoEvaluacion> {

  // ── Anillo 1: autenticación ────────────────────────────────────────────────
  const cookieStore = cookies();
  const supabaseUser = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return { error: "no_autenticado" };

  // ── Anillos 2, 3 y 4: consultas a la BD con cliente admin (bypassa RLS) ───
  const adminClient = crearClienteAdmin();

  // Anillos 2 y 3: leer tutor_activo y bloqueado de estado_usuario
  const { data: estadoFila } = await adminClient
    .from("estado_usuario")
    .select("tutor_activo, bloqueado")
    .eq("cuenta_id", user.id)
    .single();

  if (estadoFila?.bloqueado === true) return { error: "bloqueado" };
  // Si tutor_activo es null (columna aún no existe en la fila), tratamos como true.
  if (estadoFila?.tutor_activo === false) return { error: "tutor_desactivado" };

  // Anillo 4: contar evaluaciones de hoy para este usuario
  const hoyISO = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const { count } = await adminClient
    .from("evaluaciones_tutor")
    .select("id", { count: "exact", head: true })
    .eq("cuenta_id", user.id)
    .gte("creado_en", `${hoyISO}T00:00:00.000Z`);

  if ((count ?? 0) >= TOPE_DIARIO_EVALUACIONES) return { error: "cap_diario" };

  // ── Llamada a Anthropic ────────────────────────────────────────────────────
  const prompt = `Eres un evaluador de inglés para una app de aprendizaje de idiomas.
El usuario debía traducir una frase al inglés y la dijo en voz alta.

Frase correcta: "${fraseCorrecta}"
Lo que dijo el usuario: "${transcripcion}"
Temas gramaticales clave: ${temasGramaticales.join(", ")}

Evalúa si la respuesta del usuario es:
- "fluido": esencialmente igual que la frase correcta. Pequeñas variaciones de pronunciación o sinónimos son OK si la estructura gramatical y el significado son correctos.
- "casi": estructura general correcta pero hay un error pequeño: preposición incorrecta, tiempo verbal aproximado, pronombre equivocado, o palabra con significado ligeramente diferente.
- "incorrecto": estructura gramatical incorrecta, vocabulario muy diferente, o frase incompleta.

Responde ÚNICAMENTE con JSON en este formato exacto (sin texto adicional, sin markdown, sin bloques de código):
{"veredicto":"fluido|casi|incorrecto","explicacion":"Explicación breve en español (1-2 frases), dirigida directamente al alumno en segunda persona (tú). Para fluido: comenta qué estructura usó bien (ej: 'Has usado el Present Perfect correctamente'). Para casi/incorrecto: indica el error concreto y la regla correcta (ej: 'Has dicho X, pero la forma correcta es Y porque...')."}`;

  const mensaje = await cliente.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });

  // Extraer el texto de la respuesta y parsear el JSON esperado.
  const textoRespuesta =
    mensaje.content[0].type === "text" ? mensaje.content[0].text.trim() : "";

  let veredictoRaw = "incorrecto";
  let explicacion: string | null = null;

  try {
    // Extraer el primer objeto JSON de la respuesta — el modelo a veces envuelve
    // la salida en bloques de markdown (```json ... ```) o añade texto antes/después.
    const jsonMatch = textoRespuesta.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? jsonMatch[0] : textoRespuesta;
    const parsed = JSON.parse(jsonString);
    veredictoRaw = typeof parsed.veredicto === "string" ? parsed.veredicto : "incorrecto";
    explicacion = typeof parsed.explicacion === "string" ? parsed.explicacion : null;
  } catch {
    // Si no se puede extraer JSON válido, usar fallback por texto plano.
    // explicacion queda null: mejor sin explicación que mostrar JSON roto al usuario.
    veredictoRaw = textoRespuesta.toLowerCase().includes("fluido") ? "fluido"
      : textoRespuesta.toLowerCase().includes("casi") ? "casi"
      : "incorrecto";
  }

  // Mapear al tipo ResultadoEval de la app.
  // "fluido" → "perfecto" (el modelo usa "fluido"; la app usa "perfecto" internamente).
  const veredicto: ResultadoEval =
    veredictoRaw === "fluido" ? "perfecto" :
    veredictoRaw === "casi"   ? "casi"     :
    "incorrecto"; // Fallback seguro ante cualquier respuesta inesperada.

  // ── Registrar la evaluación en BD (log de coste) ──────────────────────────
  // No esperamos a que termine — el veredicto ya está calculado y el usuario no debe esperar.
  adminClient
    .from("evaluaciones_tutor")
    .insert({ cuenta_id: user.id, frase_id: fraseId, veredicto })
    .then(() => {}); // fire-and-forget, igual que subirEstado()

  return { veredicto, explicacion };
}
