import { AppState, Frase, Perfil } from "./types";
import catalogo from "../data/content.json";
import { BLOQUES_ORDENADOS } from "./catalogo";
import { subirEstado } from "./nube";

const STORAGE_KEY = "flashenglish.state";
const VERSION = 2;

const ESTADO_INICIAL: AppState = {
  version: VERSION,
  perfil_activo: "",
  perfiles: {},
};

export function cargarEstado(): AppState {
  if (typeof window === "undefined") return ESTADO_INICIAL;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return ESTADO_INICIAL;

    const parsed = JSON.parse(raw);

    if (parsed.version === 1) return migrarV1aV2(parsed as AppState);
    if (parsed.version === 2) return parsed as AppState;

    // Versión desconocida: no destruir datos, devolver estado inicial limpio
    return ESTADO_INICIAL;
  } catch {
    return ESTADO_INICIAL;
  }
}

export function guardarEstado(estado: AppState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
  subirEstado(estado); // fire-and-forget: sube a Supabase en segundo plano
}

/**
 * Guarda el estado SOLO en localStorage, sin disparar el upload a Supabase.
 * Usar únicamente cuando se acaba de descargar desde Supabase, para evitar
 * un ciclo innecesario de descarga → upload.
 */
export function guardarEstadoLocal(estado: AppState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
}

export function obtenerPerfilActivo(estado: AppState): Perfil {
  return estado.perfiles[estado.perfil_activo];
}

export function actualizarPerfilActivo(estado: AppState, perfil: Perfil): AppState {
  return {
    ...estado,
    perfiles: {
      ...estado.perfiles,
      [estado.perfil_activo]: perfil,
    },
  };
}

/** Avanza bloque_activo al siguiente bloque y actualiza bloques_desbloqueados.
 *  Persiste el estado automáticamente. No hace nada si ya está en el último bloque. */
export function avanzarBloqueActivo(estado: AppState): AppState {
  const perfil = obtenerPerfilActivo(estado);
  const idx = BLOQUES_ORDENADOS.findIndex((b) => b.codigo === perfil.bloque_activo);
  if (idx === -1 || idx >= BLOQUES_ORDENADOS.length - 1) return estado;

  const siguienteCodigo = BLOQUES_ORDENADOS[idx + 1].codigo;
  const desbloqueados = perfil.bloques_desbloqueados.includes(siguienteCodigo)
    ? perfil.bloques_desbloqueados
    : [...perfil.bloques_desbloqueados, siguienteCodigo];

  const perfilActualizado: Perfil = {
    ...perfil,
    bloque_activo: siguienteCodigo,
    bloques_desbloqueados: desbloqueados,
  };
  const nuevoEstado = actualizarPerfilActivo(estado, perfilActualizado);
  guardarEstado(nuevoEstado);
  return nuevoEstado;
}

/**
 * Aplica el resultado del test de nivel: establece bloque_activo y desbloquea
 * todos los bloques hasta el bloque resultado (inclusive). Persiste automáticamente.
 */
export function aplicarResultadoTest(estado: AppState, bloqueResultado: string): AppState {
  const perfil = obtenerPerfilActivo(estado);
  const idxResultado = BLOQUES_ORDENADOS.findIndex((b) => b.codigo === bloqueResultado);
  const idxActual = BLOQUES_ORDENADOS.findIndex((b) => b.codigo === perfil.bloque_activo);

  // Si el resultado no supera el bloque actual, no se toca el progreso.
  // test_nivel_estado se actualiza igualmente via marcarTestCompletado.
  if (idxResultado <= idxActual) {
    return estado;
  }

  const desbloqueados = BLOQUES_ORDENADOS.slice(0, idxResultado + 1).map((b) => b.codigo);
  const perfilActualizado: Perfil = {
    ...perfil,
    bloque_activo: bloqueResultado,
    bloques_desbloqueados: desbloqueados,
  };
  const nuevoEstado = actualizarPerfilActivo(estado, perfilActualizado);
  guardarEstado(nuevoEstado);
  return nuevoEstado;
}

export function marcarTestCompletado(estado: AppState): AppState {
  const perfil = obtenerPerfilActivo(estado);
  const nuevoEstado = actualizarPerfilActivo(estado, {
    ...perfil,
    test_nivel_estado: "completado",
    test_nivel_fecha: new Date().toISOString(),
  });
  guardarEstado(nuevoEstado);
  return nuevoEstado;
}

export function marcarTestOmitido(estado: AppState): AppState {
  const perfil = obtenerPerfilActivo(estado);
  const nuevoEstado = actualizarPerfilActivo(estado, {
    ...perfil,
    test_nivel_estado: "omitido",
    test_nivel_fecha: new Date().toISOString(),
  });
  guardarEstado(nuevoEstado);
  return nuevoEstado;
}

// ── Gestión de perfiles ───────────────────────────────────────────────────────

export const COLORES_PERFIL = ["#FF7A45", "#7B5EA7", "#1ABC9C"] as const;

const SLOTS_PERFIL = ["perfil_1", "perfil_2", "perfil_3"];

export function cambiarPerfilActivo(estado: AppState, perfilId: string): AppState {
  if (!(perfilId in estado.perfiles)) return estado;
  const nuevoEstado = { ...estado, perfil_activo: perfilId };
  guardarEstado(nuevoEstado);
  return nuevoEstado;
}

export function crearPerfil(estado: AppState, nombre: string, colorAcento: string): AppState {
  const id = SLOTS_PERFIL.find((s) => !(s in estado.perfiles));
  if (!id) return estado; // ya hay 3 perfiles

  const nuevoPerfil: Perfil = {
    nombre,
    color_acento: colorAcento,
    avatar: "default",
    creado: new Date().toISOString(),
    racha_dias: 0,
    ultima_sesion_fecha: null,
    aciertos_totales: 0,
    bloque_activo: "BASIC1",
    bloques_desbloqueados: ["BASIC1"],
    stats_dia: null,
    puntero_frase_nueva: {
      BASIC1: 0, BASIC2: 0, INT1: 0, INT2: 0,
      INT3: 0, INT4: 0, ADV1: 0, ADV2: 0,
    },
    progreso_frases: {},
    sesion_en_curso: null,
  };

  const nuevoEstado: AppState = {
    ...estado,
    perfil_activo: id,
    perfiles: { ...estado.perfiles, [id]: nuevoPerfil },
  };
  guardarEstado(nuevoEstado);
  return nuevoEstado;
}

export function renombrarPerfil(estado: AppState, perfilId: string, nombre: string): AppState {
  const perfil = estado.perfiles[perfilId];
  if (!perfil) return estado;
  const nuevoEstado = {
    ...estado,
    perfiles: { ...estado.perfiles, [perfilId]: { ...perfil, nombre } },
  };
  guardarEstado(nuevoEstado);
  return nuevoEstado;
}

export function cambiarColorPerfil(estado: AppState, perfilId: string, colorAcento: string): AppState {
  const perfil = estado.perfiles[perfilId];
  if (!perfil) return estado;
  const nuevoEstado = {
    ...estado,
    perfiles: { ...estado.perfiles, [perfilId]: { ...perfil, color_acento: colorAcento } },
  };
  guardarEstado(nuevoEstado);
  return nuevoEstado;
}

export function eliminarPerfil(estado: AppState, perfilId: string): AppState {
  const ids = Object.keys(estado.perfiles);
  if (ids.length <= 1) return estado; // no borrar el último

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { [perfilId]: _eliminado, ...restPerfiles } = estado.perfiles;
  const nuevoActivo =
    estado.perfil_activo === perfilId
      ? Object.keys(restPerfiles)[0]
      : estado.perfil_activo;

  const nuevoEstado: AppState = {
    ...estado,
    perfil_activo: nuevoActivo,
    perfiles: restPerfiles,
  };
  guardarEstado(nuevoEstado);
  return nuevoEstado;
}

// ── Migración v1 → v2 ────────────────────────────────────────────────────────

function migrarV1aV2(estadoV1: AppState): AppState {
  const perfilV1 = estadoV1.perfiles["default"];
  if (!perfilV1) return ESTADO_INICIAL;

  const perfilV2: Perfil = {
    ...perfilV1,
    bloque_activo: "BASIC1",
    bloques_desbloqueados: calcularBloquesDesbloqueados(perfilV1),
    color_acento: "#FF7A45",
    avatar: "default",
    stats_dia: null,
    // ids_repaso se añadió en It-2 de Fase 1; sesiones antiguas pueden no tenerlo
    sesion_en_curso: perfilV1.sesion_en_curso
      ? { ...perfilV1.sesion_en_curso, ids_repaso: perfilV1.sesion_en_curso.ids_repaso ?? [] }
      : null,
  };

  const estadoV2: AppState = {
    version: 2,
    perfil_activo: "perfil_1",
    perfiles: { perfil_1: perfilV2 },
  };

  // Solo persistimos cuando el objeto v2 está completo (migración atómica)
  guardarEstado(estadoV2);
  return estadoV2;
}

// Recorre los bloques en orden y desbloquea el siguiente cuando el anterior está al 100%.
// La cadena se rompe en el primer bloque que no está completo.
function calcularBloquesDesbloqueados(perfil: Perfil): string[] {
  const bloques = (catalogo.bloques as Array<{ codigo: string; orden: number }>)
    .sort((a, b) => a.orden - b.orden);

  const totalPorBloque = new Map<string, number>();
  for (const f of catalogo.frases as Frase[]) {
    totalPorBloque.set(f.bloque, (totalPorBloque.get(f.bloque) ?? 0) + 1);
  }

  const desbloqueados: string[] = ["BASIC1"];

  for (let i = 0; i < bloques.length - 1; i++) {
    const codigo = bloques[i].codigo;
    const total = totalPorBloque.get(codigo) ?? 0;
    const puntero = perfil.puntero_frase_nueva[codigo] ?? 0;
    const enRepaso = Object.keys(perfil.progreso_frases).filter(
      (id) => id.startsWith(codigo + "-")
    ).length;
    const aprendidas = puntero - enRepaso;

    if (total > 0 && aprendidas >= total) {
      desbloqueados.push(bloques[i + 1].codigo);
    } else {
      break;
    }
  }

  return desbloqueados;
}
