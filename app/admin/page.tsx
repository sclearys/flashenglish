/**
 * /admin — Server Component principal del backoffice.
 *
 * Aquí vive toda la lógica de datos:
 *   1. Lee los usuarios de auth.users con la service role (bypassa RLS).
 *   2. Lee todos los AppState de estado_usuario.
 *   3. Une los dos datasets por cuenta_id.
 *   4. Calcula los campos derivados (progreso, días inactivo, etc.).
 *   5. Pasa el resultado serializado al Client Component AdminPanel.
 *
 * Por qué Server Component y no Client Component con fetch:
 *   - La service role key no puede salir al navegador.
 *   - Todo el trabajo pesado de datos queda en el servidor; el cliente
 *     solo recibe el array final ya procesado.
 */

import { crearClienteAdmin } from "@/lib/supabase-admin";
import AdminPanel from "./AdminPanel";
import type { UsuarioResumen, PerfilResumen, ConsumoGlobal, SesionHistorial, FraseContenido, UsageStats } from "./types";
import type { AppState } from "@/lib/types";
import catalogo from "@/data/content.json";
import {
  UMBRAL_ALERTA_GLOBAL_DIA,
  COSTE_ESTIMADO_EUR_POR_EVALUACION,
} from "@/lib/tutor";

// Totales de frases por bloque, calculados una vez al cargar el módulo.
// Necesarios para calcular el % de progreso del bloque activo.
const TOTAL_POR_BLOQUE: Record<string, number> = {};
for (const frase of catalogo.frases as Array<{ bloque: string }>) {
  TOTAL_POR_BLOQUE[frase.bloque] = (TOTAL_POR_BLOQUE[frase.bloque] ?? 0) + 1;
}

function diasDesdeAhora(isoString: string | null): number {
  if (!isoString) return 999;
  const diff = Date.now() - new Date(isoString).getTime();
  return Math.floor(diff / 1000 / 60 / 60 / 24);
}

export default async function AdminPage() {
  const supabase = crearClienteAdmin();

  // ── 1. Leer todos los usuarios de auth ──────────────────────────────────
  const {
    data: { users },
    error: usersError,
  } = await supabase.auth.admin.listUsers({ perPage: 1000 });

  if (usersError) {
    return (
      <div style={{ padding: 40, color: "#D14343", fontFamily: "system-ui" }}>
        <strong>Error al leer usuarios:</strong> {usersError.message}
      </div>
    );
  }

  // ── 2. Leer todos los AppState de estado_usuario ─────────────────────────
  const { data: estados, error: estadosError } = await supabase
    .from("estado_usuario")
    .select("cuenta_id, estado, actualizado_en, tutor_activo, bloqueado");

  if (estadosError) {
    return (
      <div style={{ padding: 40, color: "#D14343", fontFamily: "system-ui" }}>
        <strong>Error al leer estados:</strong> {estadosError.message}
      </div>
    );
  }

  // ── 3. Indexar estados por cuenta_id para join O(1) ─────────────────────
  const estadoPorUsuario = new Map(
    (estados ?? []).map((e) => [e.cuenta_id, e])
  );

  // ── 3b. Leer evaluaciones del tutor de hoy ───────────────────────────────
  const hoyISO = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const { data: evaluacionesHoyRows } = await supabase
    .from("evaluaciones_tutor")
    .select("cuenta_id")
    .gte("creado_en", `${hoyISO}T00:00:00.000Z`);

  // Agrupar por usuario: Map<userId, count>
  const evalHoyPorUsuario = new Map<string, number>();
  for (const row of evaluacionesHoyRows ?? []) {
    evalHoyPorUsuario.set(row.cuenta_id, (evalHoyPorUsuario.get(row.cuenta_id) ?? 0) + 1);
  }
  const totalEvalHoy = evaluacionesHoyRows?.length ?? 0;

  // ── 3c. Leer historial de sesiones (Pieza H) ─────────────────────────────
  const { data: sesionesRows } = await supabase
    .from("sesiones")
    .select("id, cuenta_id, perfil_id, creado_en, bloque, frases_total, frases_saltadas")
    .order("creado_en", { ascending: false })
    .limit(1000);

  // Contar sesiones totales por cuenta
  const sesionesPorCuenta = new Map<string, number>();
  for (const row of sesionesRows ?? []) {
    sesionesPorCuenta.set(row.cuenta_id, (sesionesPorCuenta.get(row.cuenta_id) ?? 0) + 1);
  }

  // Agrupar en Map<`cuentaId::perfilId`, SesionHistorial[]>
  const historialPorPerfil = new Map<string, SesionHistorial[]>();
  for (const row of sesionesRows ?? []) {
    const key = `${row.cuenta_id}::${row.perfil_id}`;
    if (!historialPorPerfil.has(key)) historialPorPerfil.set(key, []);
    historialPorPerfil.get(key)!.push({
      id: row.id,
      creadoEn: row.creado_en,
      bloque: row.bloque,
      frasesTotal: row.frases_total,
      frasesSaltadas: row.frases_saltadas,
    });
  }

  const consumoGlobal: ConsumoGlobal = {
    totalHoy: totalEvalHoy,
    costeEstimadoEurHoy: Math.round(totalEvalHoy * COSTE_ESTIMADO_EUR_POR_EVALUACION * 1000) / 1000,
    alerta: totalEvalHoy > UMBRAL_ALERTA_GLOBAL_DIA,
  };

  // ── 4. Construir UsuarioResumen[] ────────────────────────────────────────
  const usuariosResumen: UsuarioResumen[] = users.map((user) => {
    const estadoRow = estadoPorUsuario.get(user.id);
    const appState = estadoRow?.estado as AppState | undefined;

    // Nombre de display: Google full_name → Google name → prefijo del email
    const nombreDisplay =
      (user.user_metadata?.full_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      user.email?.split("@")[0] ||
      "—";

    // Sin AppState: el usuario existe en auth pero nunca usó la app
    if (!appState?.perfiles) {
      return {
        id: user.id,
        email: user.email ?? "—",
        nombreDisplay,
        creadoEn: user.created_at,
        ultimaActualizacion: estadoRow?.actualizado_en ?? null,
        diasDesdeUltima: diasDesdeAhora(estadoRow?.actualizado_en ?? null),
        perfilActivoId: "",
        perfiles: [],
        tieneEstado: false,
        tutorActivo: estadoRow?.tutor_activo ?? true,
        bloqueado: estadoRow?.bloqueado ?? false,
        evaluacionesHoy: evalHoyPorUsuario.get(user.id) ?? 0,
        sesionesTotal: sesionesPorCuenta.get(user.id) ?? 0,
      } satisfies UsuarioResumen;  // perfiles vacíos → historialSesiones también vacío por defecto
    }

    // Procesar cada perfil del AppState
    const perfiles: PerfilResumen[] = Object.entries(appState.perfiles).map(
      ([id, perfil]) => {
        const bloque = perfil.bloque_activo;
        const totalFrases = TOTAL_POR_BLOQUE[bloque] ?? 0;
        const puntero = perfil.puntero_frase_nueva[bloque] ?? 0;
        const progresoBloque =
          totalFrases > 0
            ? Math.min(100, Math.round((puntero / totalFrases) * 100))
            : 0;

        const historialKey = `${user.id}::${id}`;
        const historialSesiones = (historialPorPerfil.get(historialKey) ?? []).slice(0, 20);

        return {
          id,
          nombre: perfil.nombre,
          color: perfil.color_acento,
          bloqueActivo: bloque,
          progresoBloque,
          racha: perfil.racha_dias,
          sesionEnCurso: !!perfil.sesion_en_curso,
          sesionInicio: perfil.sesion_en_curso?.inicio ?? null,
          historialSesiones,
        } satisfies PerfilResumen;
      }
    );

    return {
      id: user.id,
      email: user.email ?? "—",
      nombreDisplay,
      creadoEn: user.created_at,
      ultimaActualizacion: estadoRow?.actualizado_en ?? null,
      diasDesdeUltima: diasDesdeAhora(estadoRow?.actualizado_en ?? null),
      perfilActivoId: appState.perfil_activo,
      perfiles,
      tieneEstado: true,
      tutorActivo: estadoRow?.tutor_activo ?? true,
      bloqueado: estadoRow?.bloqueado ?? false,
      evaluacionesHoy: evalHoyPorUsuario.get(user.id) ?? 0,
      sesionesTotal: sesionesPorCuenta.get(user.id) ?? 0,
    } satisfies UsuarioResumen;
  });

  const frases = catalogo.frases as FraseContenido[];

  // ── Agregar progreso_frases de todos los perfiles ────────────────────────
  // Solo incluye frases en repaso activo (las dominadas se eliminan del record).
  const usagePorFrase: Record<string, UsageStats> = {};
  for (const estadoRow of estados ?? []) {
    const appState = estadoRow.estado as AppState | undefined;
    if (!appState?.perfiles) continue;
    for (const [, perfil] of Object.entries(appState.perfiles)) {
      for (const [fraseId, prog] of Object.entries(perfil.progreso_frases ?? {})) {
        const p = prog as { estado: "casi" | "incorrecto"; pendientes: number };
        if (!usagePorFrase[fraseId]) {
          usagePorFrase[fraseId] = { enRepaso: 0, casi: 0, fallo: 0, perfilDetalle: [] };
        }
        const u = usagePorFrase[fraseId];
        u.enRepaso++;
        if (p.estado === "casi") u.casi++;
        else if (p.estado === "incorrecto") u.fallo++;
        u.perfilDetalle.push({
          nombre: perfil.nombre,
          estado: p.estado,
          pendientes: p.pendientes,
          color: perfil.color_acento,
        });
      }
    }
  }

  return <AdminPanel usuarios={usuariosResumen} consumoGlobal={consumoGlobal} frases={frases} usagePorFrase={usagePorFrase} />;
}
