import { Frase, Perfil, SesionEnCurso } from "./types";
import catalogo from "../data/content.json";

const TAMANYO_SESION_DEFAULT = 25;

// Total de frases disponibles en el MVP (exportado para stats)
export const TOTAL_FRASES_MVP: number = (catalogo.frases as Frase[]).filter((f) =>
  ["BASIC1", "BASIC2"].includes(f.bloque)
).length;

// Bloques activos en el MVP (Fase 1)
const BLOQUES_MVP = ["BASIC1", "BASIC2"];

// Todas las frases del MVP, en orden estricto del catálogo
const frasesMVP: Frase[] = (catalogo.frases as Frase[]).filter((f) =>
  BLOQUES_MVP.includes(f.bloque)
);

export function obtenerFrasePorId(id: string): Frase | undefined {
  return frasesMVP.find((f) => f.id === id);
}

/**
 * Construye la lista de IDs de frases para una sesión nueva.
 *
 * Orden de prioridad (según doc maestro):
 *   1. Frases en repaso (progreso_frases con pendientes > 0)
 *   2. Frases nuevas, en orden estricto del catálogo, usando el puntero por bloque
 *
 * Si hay menos de TAMANYO_SESION disponibles, la sesión es más corta.
 */
export function construirSesion(
  perfil: Perfil,
  tamanyoSesion: number = TAMANYO_SESION_DEFAULT
): SesionEnCurso {
  const idsEnRepaso = Object.entries(perfil.progreso_frases)
    .filter(([, prog]) => prog.pendientes > 0)
    .map(([id]) => id);

  const idsNuevas = obtenerFrasesNuevas(perfil, tamanyoSesion - idsEnRepaso.length);

  const frases_ids = [...idsEnRepaso, ...idsNuevas];

  return {
    frases_ids,
    ids_repaso: idsEnRepaso,   // guardamos cuáles eran repaso al arrancar
    indice_actual: 0,
    respuestas: [],
  };
}

/**
 * Devuelve hasta `cantidad` IDs de frases nuevas (que no están en progreso_frases
 * y que aún no han aparecido), respetando el puntero por bloque.
 */
function obtenerFrasesNuevas(perfil: Perfil, cantidad: number): string[] {
  if (cantidad <= 0) return [];

  const resultado: string[] = [];

  for (const bloque of BLOQUES_MVP) {
    if (resultado.length >= cantidad) break;

    const frasesDelBloque = frasesMVP.filter((f) => f.bloque === bloque);
    const puntero = perfil.puntero_frase_nueva[bloque] ?? 0;

    for (let i = puntero; i < frasesDelBloque.length; i++) {
      if (resultado.length >= cantidad) break;
      const frase = frasesDelBloque[i];
      // Saltamos frases que ya están en progreso (en repaso activo)
      if (!(frase.id in perfil.progreso_frases)) {
        resultado.push(frase.id);
      }
    }
  }

  return resultado;
}

/**
 * Avanza el puntero de frases nuevas para los bloques que corresponda,
 * tras finalizar una sesión. Solo avanza para las frases que eran nuevas
 * (no estaban en progreso antes de la sesión).
 */
export function avanzarPunteros(
  perfil: Perfil,
  idsNuevasUsadas: string[]
): Perfil["puntero_frase_nueva"] {
  const punteros = { ...perfil.puntero_frase_nueva };

  for (const bloque of BLOQUES_MVP) {
    const frasesDelBloque = frasesMVP.filter((f) => f.bloque === bloque);
    const usadasEnEsteBloque = idsNuevasUsadas.filter((id) =>
      id.startsWith(bloque)
    );
    punteros[bloque] = Math.min(
      frasesDelBloque.length,
      (punteros[bloque] ?? 0) + usadasEnEsteBloque.length
    );
  }

  return punteros;
}
