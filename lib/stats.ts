import { Perfil } from "./types";
import { porcentajeBloque, totalFrasesEnBloque } from "./catalogo";

/** Stats del bloque activo del perfil, para la home y el resumen. */
export function calcularStats(perfil: Perfil) {
  const bloque = perfil.bloque_activo;
  const total = totalFrasesEnBloque(bloque);
  const puntero = perfil.puntero_frase_nueva[bloque] ?? 0;
  const enRepaso = Object.keys(perfil.progreso_frases).filter(
    (id) => id.startsWith(bloque + "-")
  ).length;
  const aprendidas = Math.max(0, puntero - enRepaso);

  return {
    aprendidas,
    enRepaso,
    total,
    porcentajeBloque: porcentajeBloque(perfil, bloque),
    rachaDias: perfil.racha_dias,
    aciertos_totales: perfil.aciertos_totales,
  };
}

/** Temas con errores en la sesión, ordenados de mayor a menor conteo. */
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
