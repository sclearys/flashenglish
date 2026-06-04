// Constantes de control de coste del tutor virtual (Pieza G).
// Fuente de verdad — no duplicar estos valores en ningún otro fichero.

/** Número máximo de evaluaciones IA que un usuario puede hacer en un día natural. */
export const TOPE_DIARIO_EVALUACIONES = 100;

/**
 * Si el total global de evaluaciones del día supera este umbral,
 * el panel de admin muestra una alerta visual.
 */
export const UMBRAL_ALERTA_GLOBAL_DIA = 200;

/**
 * Coste estimado en euros por cada llamada a claude-haiku.
 * Usado solo para mostrar estimaciones en el admin — no para decisiones de negocio.
 */
export const COSTE_ESTIMADO_EUR_POR_EVALUACION = 0.002;
