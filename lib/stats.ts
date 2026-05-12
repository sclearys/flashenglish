import { Perfil } from "./types";
import { TOTAL_FRASES_MVP } from "./sesion";

const BLOQUES_MVP = ["BASIC1", "BASIC2"];

export function calcularStats(perfil: Perfil) {
  const frasesIniciadas = BLOQUES_MVP.reduce(
    (suma, bloque) => suma + (perfil.puntero_frase_nueva[bloque] ?? 0),
    0
  );

  const enRepaso = Object.keys(perfil.progreso_frases).filter((id) =>
    BLOQUES_MVP.some((b) => id.startsWith(b))
  ).length;

  const aprendidas = frasesIniciadas - enRepaso;

  // Porcentaje de avance en el bloque Basic (frases iniciadas / total)
  const porcentajeBloque =
    TOTAL_FRASES_MVP > 0
      ? Math.round((frasesIniciadas / TOTAL_FRASES_MVP) * 100)
      : 0;

  return {
    aprendidas,
    enRepaso,
    total: TOTAL_FRASES_MVP,
    porcentajeBloque,
    rachaDias: perfil.racha_dias,
    aciertos_totales: perfil.aciertos_totales,
  };
}

// Devuelve temas con su conteo de apariciones en errores, ordenados de mayor a menor
export function temasARepasar(
  respuestas: Array<{ id: string; resultado: string }>,
  obtenerFrase: (id: string) => { temas_gramaticales: string[] } | undefined
): Array<{ tema: string; count: number }> {
  const conteo = new Map<string, number>();
  for (const r of respuestas) {
    if (r.resultado === "casi" || r.resultado === "incorrecto") {
      obtenerFrase(r.id)?.temas_gramaticales.forEach((t) => {
        conteo.set(t, (conteo.get(t) ?? 0) + 1);
      });
    }
  }
  return Array.from(conteo.entries())
    .map(([tema, count]) => ({ tema, count }))
    .sort((a, b) => b.count - a.count);
}
