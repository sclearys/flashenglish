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
  // Fase 3: campos opcionales para sesiones de refuerzo temático.
  // Ausencia de tipo = sesión normal de bloque (retrocompatible).
  tipo?: "bloque" | "refuerzo";
  temaId?: string;
  // Pieza F: timestamp de inicio de sesión. Opcional para retrocompatibilidad
  // con sesiones guardadas antes de este campo. Usado en el backoffice para
  // detectar sesiones posiblemente atascadas (> 2h desde inicio).
  inicio?: string;   // ISO timestamp, p.ej. "2026-05-26T09:14:00.000Z"
  // Pieza G: modo de evaluación elegido al inicio de la sesión.
  // Ausencia = autoevaluacion (retrocompatible con sesiones antiguas).
  modo?: "tutor" | "autoevaluacion";
  // Pieza H: frases del pool trenzado que no cupieron en esta sesión.
  // undefined en sesiones antiguas o de refuerzo (retrocompatible).
  frases_saltadas?: number;
}

// ── Perfil ────────────────────────────────────────────────────────────────

export type PunteroBloque = Record<string, number>;

export interface StatsDia {
  fecha: string;       // "YYYY-MM-DD"
  perfecto: number;
  casi: number;
  incorrecto: number;
}

export interface Perfil {
  nombre: string;
  creado: string;
  racha_dias: number;
  ultima_sesion_fecha: string | null;
  aciertos_totales: number;
  bloque_activo: string;               // código del bloque activo ("BASIC1", "INT2", etc.)
  bloques_desbloqueados: string[];     // códigos de bloques accesibles para este perfil
  color_acento: string;                // hex — por defecto "#FF7A45", usado en pieza B
  avatar: string;                      // opaco — por defecto "default", usado en pieza B
  stats_dia: StatsDia | null;          // stats acumuladas del día actual
  puntero_frase_nueva: PunteroBloque;
  progreso_frases: Record<string, ProgresoFrase>;
  sesion_en_curso: SesionEnCurso | null;
  test_nivel_estado?: "completado" | "omitido" | null;
}

// ── Estado global de la app ───────────────────────────────────────────────

export interface AppState {
  version: number;
  perfil_activo: string;
  perfiles: Record<string, Perfil>;
  // Preferencia del usuario sobre el tutor IA (Pieza G.5).
  // Independiente de tutor_activo (columna DB): el admin siempre tiene la última palabra.
  // undefined / true → quiere usar el tutor; false → prefiere no usarlo.
  tutorPreferido?: boolean;
}
