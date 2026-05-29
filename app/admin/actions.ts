"use server";

/**
 * app/admin/actions.ts — Server Actions del backoffice.
 *
 * "use server" al principio del fichero convierte TODAS las funciones
 * exportadas en Server Actions: se ejecutan en el servidor aunque las
 * llame un Client Component desde el navegador.
 *
 * Seguridad: cada acción verifica que el usuario actual es el admin antes
 * de hacer nada. Sin esta comprobación, cualquiera que conociera la URL
 * de la action podría llamarla.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { crearClienteAdmin } from "@/lib/supabase-admin";
import type { AppState, Perfil } from "@/lib/types";
import {
  BLOQUES_ORDENADOS,
  porcentajeBloque,
  calcularProgresoTemas,
  totalFrasesEnBloque,
} from "@/lib/catalogo";
import type {
  BloqueDetalle,
  DetalleUsuario,
  PerfilDetalle,
} from "./types";

// ── Guard de seguridad ────────────────────────────────────────────────────────

async function verificarAdmin(): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return false;

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email === adminEmail;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Calcula el número de frases que un perfil ha completado del todo
 * (han pasado el ciclo de repaso y ya no están en progreso_frases).
 *
 * Lógica: puntero_frase_nueva[bloque] = cuántas frases nuevas se han
 * introducido en ese bloque. De esas, las que siguen en progreso_frases
 * todavía están "en repaso". Las demás están aprendidas.
 */
function calcularFrasesAprendidas(perfil: Perfil): number {
  return BLOQUES_ORDENADOS.reduce((acc, { codigo }) => {
    const puntero = perfil.puntero_frase_nueva[codigo] ?? 0;
    const enRepaso = Object.keys(perfil.progreso_frases).filter((id) =>
      id.startsWith(codigo + "-")
    ).length;
    return acc + Math.max(0, puntero - enRepaso);
  }, 0);
}

function construirDetallesPerfil(id: string, perfil: Perfil): PerfilDetalle {
  const TOTAL_CATALOGO = 750;

  // ── Bloques ────────────────────────────────────────────────────────────────
  const bloques: BloqueDetalle[] = BLOQUES_ORDENADOS.map(({ codigo }) => {
    const desbloqueado = perfil.bloques_desbloqueados.includes(codigo);
    const esActivo = codigo === perfil.bloque_activo;
    const pct = desbloqueado ? porcentajeBloque(perfil, codigo) : 0;

    let estado: BloqueDetalle["estado"];
    if (!desbloqueado) {
      estado = "locked";
    } else if (esActivo) {
      estado = "active";
    } else {
      // Desbloqueado pero no activo = ya completado
      estado = "done";
    }

    return { cod: codigo, pct, estado };
  });

  // ── Temas (top 6 por % aprendido, filtrando los que tengan al menos 1 frase) ──
  const temas = calcularProgresoTemas(perfil)
    .filter((t) => {
      // Solo mostrar temas con frases en bloques desbloqueados del perfil
      const desbloqueados = new Set(perfil.bloques_desbloqueados);
      const totalEnDesbloqueados = totalFrasesEnBloque(t.tema); // approx
      return t.total > 0 && desbloqueados.size > 0 && totalEnDesbloqueados > 0;
    })
    .sort((a, b) => b.aprendidas - a.aprendidas || b.total - a.total)
    .slice(0, 6)
    .map((t) => ({ nombre: t.tema, pct: t.porcentaje }));

  // ── Stats ──────────────────────────────────────────────────────────────────
  const frasesAprendidas = calcularFrasesAprendidas(perfil);
  const progresoTotal = Math.round((frasesAprendidas / TOTAL_CATALOGO) * 100);

  // ── Bloque activo: puntero y entradas en repaso (para acciones de bloque) ──
  const punteroBloque = perfil.puntero_frase_nueva[perfil.bloque_activo] ?? 0;
  const enRepasoBloque = Object.keys(perfil.progreso_frases).filter(
    (id) => id.startsWith(perfil.bloque_activo + "-")
  ).length;

  // ── Sesión en curso ────────────────────────────────────────────────────────
  const sesEnCurso = perfil.sesion_en_curso;
  const sesion = sesEnCurso
    ? {
        tipo: sesEnCurso.tipo ?? "bloque",
        temaId: sesEnCurso.temaId ?? null,
        frasesPendientes: Math.max(
          0,
          sesEnCurso.frases_ids.length - sesEnCurso.indice_actual
        ),
        inicio: sesEnCurso.inicio ?? null,
      }
    : null;

  // ── Última vez (para acción "borrar última vez") ───────────────────────────
  const entradasProgreso = Object.values(perfil.progreso_frases);
  let ultimaVezFecha: string | null = null;
  let ultimaVezEntradas = 0;

  if (entradasProgreso.length > 0) {
    const maxFecha = entradasProgreso.reduce(
      (max, prog) => (prog.ultima_vez > max ? prog.ultima_vez : max),
      ""
    );
    if (maxFecha) {
      ultimaVezFecha = maxFecha.slice(0, 10); // "YYYY-MM-DD"
      ultimaVezEntradas = entradasProgreso.filter(
        (prog) => prog.ultima_vez.slice(0, 10) === ultimaVezFecha
      ).length;
    }
  }

  return {
    id,
    nombre: perfil.nombre,
    color: perfil.color_acento,
    bloqueActivo: perfil.bloque_activo,
    frasesAprendidas,
    totalFrases: TOTAL_CATALOGO,
    progresoTotal,
    racha: perfil.racha_dias,
    bloquesDesbloqueados: perfil.bloques_desbloqueados,
    bloques,
    temas,
    sesion,
    ultimaVezFecha,
    ultimaVezEntradas,
    punteroBloque,
    enRepasoBloque,
  };
}

// ── Tipo de retorno común para acciones de modificación ──────────────────────

type ResultadoAccion =
  | { ok: true; mensaje: string }
  | { ok: false; error: string };

// ── Helper: leer y guardar AppState ──────────────────────────────────────────

async function leerAppState(
  userId: string
): Promise<{ appState: AppState; supabase: ReturnType<typeof crearClienteAdmin> } | null> {
  const supabase = crearClienteAdmin();
  const { data } = await supabase
    .from("estado_usuario")
    .select("estado")
    .eq("cuenta_id", userId)
    .single();

  if (!data?.estado) return null;
  return { appState: data.estado as AppState, supabase };
}

async function guardarAppState(
  supabase: ReturnType<typeof crearClienteAdmin>,
  userId: string,
  nuevoEstado: AppState
): Promise<ResultadoAccion> {
  const { error } = await supabase
    .from("estado_usuario")
    .update({
      estado: nuevoEstado,
      actualizado_en: new Date().toISOString(),
    })
    .eq("cuenta_id", userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, mensaje: "Guardado correctamente." };
}

// ── Acciones de sesión (It-4) ─────────────────────────────────────────────────

/**
 * Pone sesion_en_curso a null en el perfil indicado.
 */
export async function borrarSesionEnCurso(
  userId: string,
  perfilId: string
): Promise<ResultadoAccion> {
  if (!(await verificarAdmin())) return { ok: false, error: "No autorizado." };

  const resultado = await leerAppState(userId);
  if (!resultado) return { ok: false, error: "No se encontró el AppState." };
  const { appState, supabase } = resultado;

  const perfil = appState.perfiles[perfilId];
  if (!perfil) return { ok: false, error: "Perfil no encontrado." };
  if (!perfil.sesion_en_curso) return { ok: false, error: "No hay sesión activa." };

  const nuevoEstado: AppState = {
    ...appState,
    perfiles: {
      ...appState.perfiles,
      [perfilId]: { ...perfil, sesion_en_curso: null },
    },
  };

  const guardado = await guardarAppState(supabase, userId, nuevoEstado);
  if (!guardado.ok) return guardado;
  return { ok: true, mensaje: `Sesión en curso borrada para ${perfil.nombre}.` };
}

/**
 * Elimina de progreso_frases todas las entradas cuya ultima_vez
 * coincida con la fecha más reciente del perfil.
 */
export async function borrarUltimaVez(
  userId: string,
  perfilId: string
): Promise<ResultadoAccion> {
  if (!(await verificarAdmin())) return { ok: false, error: "No autorizado." };

  const resultado = await leerAppState(userId);
  if (!resultado) return { ok: false, error: "No se encontró el AppState." };
  const { appState, supabase } = resultado;

  const perfil = appState.perfiles[perfilId];
  if (!perfil) return { ok: false, error: "Perfil no encontrado." };

  // Encontrar la fecha más reciente
  const entradas = Object.entries(perfil.progreso_frases);
  if (entradas.length === 0) return { ok: false, error: "No hay entradas de progreso." };

  const maxFecha = entradas.reduce(
    (max, [, prog]) => (prog.ultima_vez > max ? prog.ultima_vez : max),
    ""
  );
  const fechaDia = maxFecha.slice(0, 10);

  // Filtrar eliminando las entradas de ese día
  const progresoFiltrado = Object.fromEntries(
    entradas.filter(([, prog]) => prog.ultima_vez.slice(0, 10) !== fechaDia)
  );
  const borradas = entradas.length - Object.keys(progresoFiltrado).length;

  const nuevoEstado: AppState = {
    ...appState,
    perfiles: {
      ...appState.perfiles,
      [perfilId]: { ...perfil, progreso_frases: progresoFiltrado },
    },
  };

  const guardado = await guardarAppState(supabase, userId, nuevoEstado);
  if (!guardado.ok) return guardado;
  return {
    ok: true,
    mensaje: `${borradas} entradas del ${fechaDia} eliminadas para ${perfil.nombre}.`,
  };
}

/**
 * Cambia racha_dias del perfil al valor indicado.
 */
export async function corregirRacha(
  userId: string,
  perfilId: string,
  nuevaRacha: number
): Promise<ResultadoAccion> {
  if (!(await verificarAdmin())) return { ok: false, error: "No autorizado." };
  if (nuevaRacha < 0 || nuevaRacha > 365 || !Number.isInteger(nuevaRacha)) {
    return { ok: false, error: "Valor de racha inválido (0-365)." };
  }

  const resultado = await leerAppState(userId);
  if (!resultado) return { ok: false, error: "No se encontró el AppState." };
  const { appState, supabase } = resultado;

  const perfil = appState.perfiles[perfilId];
  if (!perfil) return { ok: false, error: "Perfil no encontrado." };

  const nuevoEstado: AppState = {
    ...appState,
    perfiles: {
      ...appState.perfiles,
      [perfilId]: { ...perfil, racha_dias: nuevaRacha },
    },
  };

  const guardado = await guardarAppState(supabase, userId, nuevoEstado);
  if (!guardado.ok) return guardado;
  return {
    ok: true,
    mensaje: `Racha de ${perfil.nombre} actualizada a ${nuevaRacha} días.`,
  };
}

// ── Acciones de bloque (It-5) ────────────────────────────────────────────────

/**
 * Retrocede el bloque activo al anterior: quita el bloque actual de
 * bloques_desbloqueados y pone el anterior como bloque_activo.
 * Limpia sesion_en_curso para evitar incoherencias.
 */
export async function retrocederBloque(
  userId: string,
  perfilId: string
): Promise<ResultadoAccion> {
  if (!(await verificarAdmin())) return { ok: false, error: "No autorizado." };

  const resultado = await leerAppState(userId);
  if (!resultado) return { ok: false, error: "No se encontró el AppState." };
  const { appState, supabase } = resultado;

  const perfil = appState.perfiles[perfilId];
  if (!perfil) return { ok: false, error: "Perfil no encontrado." };

  const idx = BLOQUES_ORDENADOS.findIndex((b) => b.codigo === perfil.bloque_activo);
  if (idx <= 0) return { ok: false, error: "Ya está en el primer bloque." };

  const bloqueAnterior = BLOQUES_ORDENADOS[idx - 1].codigo;
  const nuevosBloques = perfil.bloques_desbloqueados.filter(
    (b) => b !== perfil.bloque_activo
  );

  const nuevoEstado: AppState = {
    ...appState,
    perfiles: {
      ...appState.perfiles,
      [perfilId]: {
        ...perfil,
        bloque_activo: bloqueAnterior,
        bloques_desbloqueados: nuevosBloques,
        sesion_en_curso: null,
      },
    },
  };

  const guardado = await guardarAppState(supabase, userId, nuevoEstado);
  if (!guardado.ok) return guardado;
  return {
    ok: true,
    mensaje: `Bloque de ${perfil.nombre} retrocedido a ${bloqueAnterior}.`,
  };
}

/**
 * Resetea el bloque activo desde cero: pone el puntero a 0 y elimina
 * todas las entradas de progreso_frases de ese bloque.
 * Limpia sesion_en_curso para evitar incoherencias.
 */
export async function resetearBloqueActivo(
  userId: string,
  perfilId: string
): Promise<ResultadoAccion> {
  if (!(await verificarAdmin())) return { ok: false, error: "No autorizado." };

  const resultado = await leerAppState(userId);
  if (!resultado) return { ok: false, error: "No se encontró el AppState." };
  const { appState, supabase } = resultado;

  const perfil = appState.perfiles[perfilId];
  if (!perfil) return { ok: false, error: "Perfil no encontrado." };

  const bloque = perfil.bloque_activo;

  const nuevosPunteros = { ...perfil.puntero_frase_nueva, [bloque]: 0 };
  const progresoFiltrado = Object.fromEntries(
    Object.entries(perfil.progreso_frases).filter(
      ([id]) => !id.startsWith(bloque + "-")
    )
  );

  const nuevoEstado: AppState = {
    ...appState,
    perfiles: {
      ...appState.perfiles,
      [perfilId]: {
        ...perfil,
        puntero_frase_nueva: nuevosPunteros,
        progreso_frases: progresoFiltrado,
        sesion_en_curso: null,
      },
    },
  };

  const guardado = await guardarAppState(supabase, userId, nuevoEstado);
  if (!guardado.ok) return guardado;
  return {
    ok: true,
    mensaje: `Bloque ${bloque} de ${perfil.nombre} reseteado desde cero.`,
  };
}

/**
 * Avanza el bloque activo al siguiente: añade el siguiente bloque a
 * bloques_desbloqueados (si no estaba) y lo pone como bloque_activo.
 * Limpia sesion_en_curso para evitar incoherencias.
 */
export async function avanzarBloque(
  userId: string,
  perfilId: string
): Promise<ResultadoAccion> {
  if (!(await verificarAdmin())) return { ok: false, error: "No autorizado." };

  const resultado = await leerAppState(userId);
  if (!resultado) return { ok: false, error: "No se encontró el AppState." };
  const { appState, supabase } = resultado;

  const perfil = appState.perfiles[perfilId];
  if (!perfil) return { ok: false, error: "Perfil no encontrado." };

  const idx = BLOQUES_ORDENADOS.findIndex((b) => b.codigo === perfil.bloque_activo);
  if (idx === -1 || idx >= BLOQUES_ORDENADOS.length - 1) {
    return { ok: false, error: "Ya está en el último bloque." };
  }

  const siguienteBloque = BLOQUES_ORDENADOS[idx + 1].codigo;
  const nuevosBloques = perfil.bloques_desbloqueados.includes(siguienteBloque)
    ? perfil.bloques_desbloqueados
    : [...perfil.bloques_desbloqueados, siguienteBloque];

  const nuevoEstado: AppState = {
    ...appState,
    perfiles: {
      ...appState.perfiles,
      [perfilId]: {
        ...perfil,
        bloque_activo: siguienteBloque,
        bloques_desbloqueados: nuevosBloques,
        sesion_en_curso: null,
      },
    },
  };

  const guardado = await guardarAppState(supabase, userId, nuevoEstado);
  if (!guardado.ok) return guardado;
  return {
    ok: true,
    mensaje: `Bloque de ${perfil.nombre} avanzado a ${siguienteBloque}.`,
  };
}

// ── Acciones de tutor virtual (G.4) ─────────────────────────────────────────

/**
 * Activa o desactiva el tutor virtual para un usuario concreto.
 * Escribe directamente en la columna tutor_activo de estado_usuario.
 */
export async function setTutorActivo(
  userId: string,
  activo: boolean
): Promise<ResultadoAccion> {
  if (!(await verificarAdmin())) return { ok: false, error: "No autorizado." };

  const supabase = crearClienteAdmin();
  const { error } = await supabase
    .from("estado_usuario")
    .update({ tutor_activo: activo })
    .eq("cuenta_id", userId);

  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    mensaje: activo ? "Tutor activado." : "Tutor desactivado.",
  };
}

/**
 * Bloquea o desbloquea una cuenta de usuario.
 * Escribe directamente en la columna bloqueado de estado_usuario.
 */
export async function setBloqueado(
  userId: string,
  bloqueado: boolean
): Promise<ResultadoAccion> {
  if (!(await verificarAdmin())) return { ok: false, error: "No autorizado." };

  const supabase = crearClienteAdmin();
  const { error } = await supabase
    .from("estado_usuario")
    .update({ bloqueado })
    .eq("cuenta_id", userId);

  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    mensaje: bloqueado ? "Cuenta bloqueada." : "Cuenta desbloqueada.",
  };
}

// ── Acciones públicas ─────────────────────────────────────────────────────────

/**
 * Carga el detalle completo de un usuario: stats de cada perfil, progreso
 * por bloque y por tema, y estado de sesión.
 */
export async function obtenerDetalleUsuario(
  userId: string
): Promise<DetalleUsuario | null> {
  if (!(await verificarAdmin())) return null;

  const supabase = crearClienteAdmin();

  // Datos del usuario en auth
  const {
    data: { user },
  } = await supabase.auth.admin.getUserById(userId);
  if (!user) return null;

  // AppState en estado_usuario
  const { data } = await supabase
    .from("estado_usuario")
    .select("estado")
    .eq("cuenta_id", userId)
    .single();

  const appState = data?.estado as AppState | undefined;
  if (!appState?.perfiles) return null;

  const nombreDisplay =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    user.email?.split("@")[0] ||
    "—";

  const perfiles: PerfilDetalle[] = Object.entries(appState.perfiles).map(
    ([id, perfil]) => construirDetallesPerfil(id, perfil)
  );

  return {
    id: userId,
    email: user.email ?? "—",
    nombreDisplay,
    perfiles,
    perfilActivoId: appState.perfil_activo,
  };
}
