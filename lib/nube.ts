/**
 * lib/nube.ts — Sincronización del AppState con Supabase.
 *
 * Dos funciones puras, sin efectos secundarios visibles para el llamador:
 *   · descargarEstado() → lee el AppState de la nube. Devuelve null si no hay sesión.
 *   · subirEstado()     → escribe el AppState en la nube. No lanza nunca.
 *
 * Estrategia local-first:
 *   - La app carga desde localStorage inmediatamente (síncrono, sin esperar red).
 *   - Luego llama a descargarEstado() en segundo plano y actualiza si hay datos.
 *   - guardarEstado() en storage.ts llama a subirEstado() sin await (fire-and-forget).
 *
 * Invitados (modo_invitado sin cuenta Supabase):
 *   - subirEstado() detecta que no hay sesión y retorna sin hacer nada.
 *   - Transparente: el modo invitado sigue usando localStorage como siempre.
 */

import { crearClienteSupabase } from "./supabase";
import type { AppState } from "./types";

const TABLA = "estado_usuario";

/**
 * Descarga el AppState del usuario autenticado actual desde Supabase.
 * Devuelve null si:
 *   - No hay sesión activa (modo invitado o sin login).
 *   - El usuario no tiene datos en la nube todavía.
 *   - Hay un error de red.
 */
export async function descargarEstado(): Promise<AppState | null> {
  // Solo funciona en el navegador
  if (typeof window === "undefined") return null;

  try {
    const supabase = crearClienteSupabase();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from(TABLA)
      .select("estado")
      .eq("cuenta_id", user.id)
      .single();

    if (error || !data) return null;

    return data.estado as AppState;
  } catch {
    // Error de red u otro inesperado: la app sigue con localStorage
    return null;
  }
}

/**
 * Sube el AppState del usuario autenticado actual a Supabase (upsert).
 *
 * Diseñada para llamarse sin await (fire-and-forget):
 *   - Captura cualquier error internamente.
 *   - Nunca lanza excepciones al llamador.
 *   - No-op si no hay sesión (modo invitado).
 */
export async function subirEstado(estado: AppState): Promise<void> {
  // Solo funciona en el navegador
  if (typeof window === "undefined") return;

  try {
    const supabase = crearClienteSupabase();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // modo invitado o sin sesión — no-op

    await supabase
      .from(TABLA)
      .upsert(
        {
          cuenta_id: user.id,
          estado,
          actualizado_en: new Date().toISOString(),
        },
        { onConflict: "cuenta_id" }
      );
  } catch {
    // Fire-and-forget: ignoramos errores de red silenciosamente
  }
}
