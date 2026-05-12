import { AppState, Perfil } from "./types";

const STORAGE_KEY = "flashenglish.state";
const VERSION = 1;

const PERFIL_INICIAL: Perfil = {
  nombre: "Yo",
  creado: new Date().toISOString(),
  racha_dias: 0,
  ultima_sesion_fecha: null,
  aciertos_totales: 0,
  puntero_frase_nueva: {
    BASIC1: 0, BASIC2: 0,
    INT1: 0, INT2: 0, INT3: 0, INT4: 0,
    ADV1: 0, ADV2: 0,
  },
  progreso_frases: {},
  sesion_en_curso: null,
};

const ESTADO_INICIAL: AppState = {
  version: VERSION,
  perfil_activo: "default",
  perfiles: { default: PERFIL_INICIAL },
};

export function cargarEstado(): AppState {
  if (typeof window === "undefined") return ESTADO_INICIAL;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return ESTADO_INICIAL;

    const parsed = JSON.parse(raw) as AppState;
    // Si el schema cambia en el futuro, aquí iría la migración
    if (parsed.version !== VERSION) return ESTADO_INICIAL;

    return parsed;
  } catch {
    return ESTADO_INICIAL;
  }
}

export function guardarEstado(estado: AppState): void {
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
