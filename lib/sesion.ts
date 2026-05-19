import { Perfil, SesionEnCurso } from "./types";
import { frasesDelBloque, frasesDelTemaEnNivel } from "./catalogo";

const TAMANYO_SESION_DEFAULT = 25;

// Re-exportar para mantener compatibilidad con imports existentes en SesionInterna y resumen
export { obtenerFrasePorId } from "./catalogo";

/**
 * Construye la lista de IDs de frases para una sesión nueva.
 *
 * Prioridad:
 *   1. Frases en repaso de cualquier bloque (progreso_frases con pendientes > 0, ultima_vez no hoy)
 *   2. Frases nuevas del bloque activo, en orden estricto del catálogo
 *
 * Si hay menos de tamanyoSesion disponibles, la sesión usa las que haya.
 * Frases falladas hoy no vuelven a aparecer hasta el día siguiente (Pieza D).
 */
export function construirSesion(
  perfil: Perfil,
  tamanyoSesion: number = TAMANYO_SESION_DEFAULT
): SesionEnCurso {
  const fechaHoy = new Date().toISOString().slice(0, 10);

  const idsEnRepaso = Object.entries(perfil.progreso_frases)
    .filter(([, prog]) =>
      prog.pendientes > 0 && prog.ultima_vez.slice(0, 10) !== fechaHoy
    )
    .map(([id]) => id);

  const idsNuevas = obtenerFrasesNuevas(perfil, tamanyoSesion - idsEnRepaso.length);

  return {
    frases_ids: [...idsEnRepaso, ...idsNuevas],
    ids_repaso: idsEnRepaso,
    indice_actual: 0,
    respuestas: [],
  };
}

/** True si construirSesion() devolvería al menos una frase. */
export function hayFrasesDisponibles(perfil: Perfil): boolean {
  return construirSesion(perfil, 1).frases_ids.length > 0;
}

/** Cuántas frases de repaso tienen ultima_vez hoy (aparecerán mañana). */
export function contarRepasoMañana(perfil: Perfil): number {
  const fechaHoy = new Date().toISOString().slice(0, 10);
  return Object.values(perfil.progreso_frases)
    .filter((p) => p.pendientes > 0 && p.ultima_vez.slice(0, 10) === fechaHoy)
    .length;
}

/**
 * Construye una sesión de refuerzo temático.
 * Toma frases del tema en bloques desbloqueados, en orden aleatorio.
 * No aplica filtro de fecha (Pieza D). No escribe en progreso_frases.
 */
export function construirSesionRefuerzo(
  perfil: Perfil,
  temaId: string,
  tamano: number
): SesionEnCurso {
  const frases = frasesDelTemaEnNivel(perfil, temaId);

  // Barajar (Fisher-Yates)
  const barajadas = [...frases];
  for (let i = barajadas.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [barajadas[i], barajadas[j]] = [barajadas[j], barajadas[i]];
  }

  const seleccionadas = barajadas.slice(0, tamano).map((f) => f.id);

  return {
    frases_ids: seleccionadas,
    ids_repaso: [],   // en refuerzo no hay frases en repaso
    indice_actual: 0,
    respuestas: [],
    tipo: "refuerzo",
    temaId,
  };
}

/**
 * Devuelve hasta `cantidad` IDs de frases nuevas del bloque activo,
 * respetando el puntero y saltando las que ya están en progreso_frases.
 */
function obtenerFrasesNuevas(perfil: Perfil, cantidad: number): string[] {
  if (cantidad <= 0) return [];

  const bloque = perfil.bloque_activo;
  const frases = frasesDelBloque(bloque);
  const puntero = perfil.puntero_frase_nueva[bloque] ?? 0;
  const resultado: string[] = [];

  for (let i = puntero; i < frases.length; i++) {
    if (resultado.length >= cantidad) break;
    const frase = frases[i];
    if (!(frase.id in perfil.progreso_frases)) {
      resultado.push(frase.id);
    }
  }

  return resultado;
}
