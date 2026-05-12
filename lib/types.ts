// ── Catálogo de contenido ──────────────────────────────────────────────────

export interface Frase {
  id: string;
  bloque: string;
  leccion: string;
  orden: number;
  es: string;
  en: string;
  temas_gramaticales: string[];
}

export interface Bloque {
  codigo: string;
  nombre: string;
  nivel: string;
  orden: number;
}

export interface Catalogo {
  version: string;
  fecha_generacion: string;
  total_frases: number;
  bloques: Bloque[];
  frases: Frase[];
}

// ── Sistema de aprendizaje ─────────────────────────────────────────────────

export type ResultadoEval = "perfecto" | "casi" | "incorrecto";

export type EstadoFrase = "casi" | "incorrecto";

export interface ProgresoFrase {
  estado: EstadoFrase;
  pendientes: number;       // apariciones correctas que le quedan
  ultima_vez: string;       // ISO 8601
}

// ── Sesión ────────────────────────────────────────────────────────────────

export interface RespuestaSesion {
  id: string;
  resultado: ResultadoEval;
}

export interface SesionEnCurso {
  frases_ids: string[];
  ids_repaso: string[];   // IDs que ya estaban en repaso al construir la sesión
  indice_actual: number;
  respuestas: RespuestaSesion[];
}

// ── Perfil ────────────────────────────────────────────────────────────────

export type PunteroBloque = Record<string, number>;

export interface Perfil {
  nombre: string;
  creado: string;
  racha_dias: number;
  ultima_sesion_fecha: string | null;
  aciertos_totales: number;
  puntero_frase_nueva: PunteroBloque;
  progreso_frases: Record<string, ProgresoFrase>;
  sesion_en_curso: SesionEnCurso | null;
}

// ── Estado global de la app ───────────────────────────────────────────────

export interface AppState {
  version: number;
  perfil_activo: string;
  perfiles: Record<string, Perfil>;
}
