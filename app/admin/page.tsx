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
import type { UsuarioResumen, PerfilResumen } from "./types";
import type { AppState } from "@/lib/types";
import catalogo from "@/data/content.json";

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
    .select("cuenta_id, estado, actualizado_en");

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
      } satisfies UsuarioResumen;
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

        return {
          id,
          nombre: perfil.nombre,
          color: perfil.color_acento,
          bloqueActivo: bloque,
          progresoBloque,
          racha: perfil.racha_dias,
          sesionEnCurso: !!perfil.sesion_en_curso,
          sesionInicio: perfil.sesion_en_curso?.inicio ?? null,
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
    } satisfies UsuarioResumen;
  });

  return <AdminPanel usuarios={usuariosResumen} />;
}
