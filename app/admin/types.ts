/**
 * Tipos compartidos entre el Server Component (page.tsx) y el Client
 * Component (AdminPanel.tsx) del backoffice.
 *
 * Son versiones "aplanadas" del AppState, con solo los campos que
 * necesita la UI de admin. Mantenerlos simples facilita la serialización
 * server → client (solo strings, numbers y booleans).
 */

// Pieza H: entrada del historial de sesiones de bloque completadas.
export type SesionHistorial = {
  id: string;
  creadoEn: string;       // ISO timestamp
  bloque: string;
  frasesTotal: number;
  frasesSaltadas: number;
};

export type PerfilResumen = {
  id: string;           // "perfil_1" | "perfil_2" | "perfil_3"
  nombre: string;
  color: string;        // hex, p.ej. "#FF7A45"
  bloqueActivo: string; // "BASIC1" | "INT2" | etc.
  progresoBloque: number; // 0-100, calculado del puntero vs total frases
  racha: number;          // racha_dias del perfil
  sesionEnCurso: boolean;
  sesionInicio: string | null; // ISO timestamp si existe campo inicio (Pieza F+)
  historialSesiones: SesionHistorial[]; // últimas sesiones de bloque (Pieza H)
};

export type UsuarioResumen = {
  id: string;                       // UUID de auth.users
  email: string;
  nombreDisplay: string;            // full_name de Google o prefijo del email
  creadoEn: string;                 // ISO timestamp de registro
  ultimaActualizacion: string | null; // actualizado_en de estado_usuario
  diasDesdeUltima: number;          // días desde ultimaActualizacion (999 si nunca)
  perfilActivoId: string;           // "perfil_1" | etc.
  perfiles: PerfilResumen[];        // todos los perfiles del AppState
  tieneEstado: boolean;             // false si aún no tiene fila en estado_usuario
  // Pieza G.4: control de coste del tutor virtual
  tutorActivo: boolean;             // admin puede desactivar el tutor para este usuario
  bloqueado: boolean;               // cuenta bloqueada
  evaluacionesHoy: number;          // evaluaciones IA hechas hoy
  sesionesTotal: number;            // sesiones de bloque completadas (tabla sesiones)
};

// Datos globales de consumo del tutor virtual (para la cabecera del panel de admin).
export type ConsumoGlobal = {
  totalHoy: number;
  costeEstimadoEurHoy: number;   // totalHoy * COSTE_ESTIMADO_EUR_POR_EVALUACION
  alerta: boolean;               // true si totalHoy > UMBRAL_ALERTA_GLOBAL_DIA
};

// ── Tipos del panel de detalle (It-3) ────────────────────────────────────────

export type BloqueDetalle = {
  cod: string;
  pct: number;                      // 0-100, frases aprendidas / total del bloque
  estado: "done" | "active" | "locked";
};

export type TemaDetalle = {
  nombre: string;
  pct: number;                      // % de frases del tema que el perfil ha aprendido
};

export type SesionDetalle = {
  tipo: string;                     // "bloque" | "refuerzo"
  temaId: string | null;            // solo en refuerzo
  frasesPendientes: number;         // frases que quedan en la sesión guardada
  inicio: string | null;            // ISO timestamp (Pieza F+); null en sesiones antiguas
};

export type PerfilDetalle = {
  id: string;
  nombre: string;
  color: string;
  bloqueActivo: string;
  frasesAprendidas: number;         // frases que han completado el ciclo de repaso
  totalFrases: number;              // siempre 750 (catálogo completo)
  progresoTotal: number;            // 0-100 sobre las 750 frases
  racha: number;
  bloquesDesbloqueados: string[];
  bloques: BloqueDetalle[];         // los 8 bloques en orden
  temas: TemaDetalle[];             // top 6 por % aprendido
  sesion: SesionDetalle | null;
  // Para la acción "borrar última vez" (It-4)
  ultimaVezFecha: string | null;    // "YYYY-MM-DD" de la sesión más reciente
  ultimaVezEntradas: number;        // entradas de progreso_frases con esa fecha
  // Para las acciones de bloque (It-5)
  punteroBloque: number;            // puntero_frase_nueva del bloque activo
  enRepasoBloque: number;           // entradas de progreso_frases del bloque activo
  // Pieza H: historial de sesiones de bloque completadas
  historialSesiones: SesionHistorial[];
};

export type DetalleUsuario = {
  id: string;
  email: string;
  nombreDisplay: string;
  perfiles: PerfilDetalle[];
  perfilActivoId: string;
};

// ── Tipos del panel de Contenido ─────────────────────────────────────────────

// Estadísticas de uso por frase, agregadas de todos los perfiles.
// Solo refleja frases en repaso activo (progreso_frases).
// Frases dominadas (ciclo completado) se eliminan de progreso_frases → no aparecen aquí.
export type UsageStats = {
  enRepaso: number;    // perfiles con esta frase en repaso activo
  casi: number;        // perfiles con estado "casi" (último eval fue casi)
  fallo: number;       // perfiles con estado "incorrecto" (último eval fue fallo)
  perfilDetalle: Array<{
    nombre: string;
    estado: "casi" | "incorrecto";
    pendientes: number;
    color: string;
  }>;
};



// Frase del catálogo. Estructura del content.json actual (v10 parcial):
// falta uso, tema_prot, registro, subtema, problema — se añadirán con el Excel v10 completo.
export type FraseContenido = {
  id: string;
  bloque: string;
  leccion: string;
  orden: number;
  es: string;
  en: string;
  temas_gramaticales: string[];
};
