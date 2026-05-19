import { Bloque, Frase, Perfil } from "./types";
import rawCatalogo from "../data/content.json";

type Nivel = "basic" | "intermediate" | "advanced";

const NIVEL_DE_BLOQUE: Record<string, Nivel> = {
  BASIC1: "basic",  BASIC2: "basic",
  INT1:   "intermediate", INT2: "intermediate",
  INT3:   "intermediate", INT4: "intermediate",
  ADV1:   "advanced", ADV2: "advanced",
};

// ── Precálculo al cargar el módulo (se ejecuta una sola vez) ─────────────────

export const BLOQUES_ORDENADOS: Bloque[] = (rawCatalogo.bloques as Bloque[])
  .sort((a, b) => a.orden - b.orden);

const todasLasFrases: Frase[] = rawCatalogo.frases as Frase[];

const indiceFrases       = new Map<string, Frase>();
const totalPorBloque     = new Map<string, number>();
const frasesPorBloque    = new Map<string, Frase[]>();
const _temasGrandesPorFrase = new Map<string, string[]>();
const _totalPorTema      = new Map<string, number>();
const _nivelPorTema      = new Map<string, Nivel>();

function extraerTemaGrande(subTema: string): string {
  return subTema.includes(": ") ? subTema.split(": ")[0] : subTema;
}

for (const frase of todasLasFrases) {
  indiceFrases.set(frase.id, frase);
  totalPorBloque.set(frase.bloque, (totalPorBloque.get(frase.bloque) ?? 0) + 1);

  if (!frasesPorBloque.has(frase.bloque)) frasesPorBloque.set(frase.bloque, []);
  frasesPorBloque.get(frase.bloque)!.push(frase);

  // Deduplicar temas grandes en la misma frase (puede que dos subtemas compartan padre)
  const temasUnicos = Array.from(new Set(frase.temas_gramaticales.map(extraerTemaGrande)));
  _temasGrandesPorFrase.set(frase.id, temasUnicos);

  for (const tema of temasUnicos) {
    _totalPorTema.set(tema, (_totalPorTema.get(tema) ?? 0) + 1);
  }
}

// Asignar nivel a cada tema grande por mayoría de frases
// Empate → nivel más bajo (basic > intermediate > advanced)
for (const tema of Array.from(_totalPorTema.keys())) {
  const conteo: Record<Nivel, number> = { basic: 0, intermediate: 0, advanced: 0 };
  for (const frase of todasLasFrases) {
    if (_temasGrandesPorFrase.get(frase.id)?.includes(tema)) {
      const nivel = NIVEL_DE_BLOQUE[frase.bloque];
      if (nivel) conteo[nivel]++;
    }
  }
  const ganador: Nivel =
    conteo.basic >= conteo.intermediate && conteo.basic >= conteo.advanced
      ? "basic"
      : conteo.intermediate >= conteo.advanced
      ? "intermediate"
      : "advanced";
  _nivelPorTema.set(tema, ganador);
}

// ── API pública ──────────────────────────────────────────────────────────────

export function obtenerFrasePorId(id: string): Frase | undefined {
  return indiceFrases.get(id);
}

export function totalFrasesEnBloque(codigo: string): number {
  return totalPorBloque.get(codigo) ?? 0;
}

export function frasesDelBloque(codigo: string): Frase[] {
  return frasesPorBloque.get(codigo) ?? [];
}

/** % aprendido de un bloque para un perfil (spec §3.2 y doc-03 §4). */
export function porcentajeBloque(perfil: Perfil, codigo: string): number {
  const total = totalFrasesEnBloque(codigo);
  if (total === 0) return 0;
  const puntero = perfil.puntero_frase_nueva[codigo] ?? 0;
  const enRepaso = Object.keys(perfil.progreso_frases).filter(
    (id) => id.startsWith(codigo + "-")
  ).length;
  const aprendidas = Math.max(0, puntero - enRepaso);
  return Math.round((aprendidas / total) * 100);
}

// Exportados para It-4 (Mi trayectoria) e It-5 (resumen enriquecido)
export const temasGrandesPorFrase = _temasGrandesPorFrase;
export const totalPorTema         = _totalPorTema;
export const nivelPorTema         = _nivelPorTema;

// ── It-4: progreso por tema ──────────────────────────────────────────────────

export interface ProgresoPorTema {
  tema: string;
  nivel: Nivel;
  total: number;      // total frases del catálogo que tocan este tema
  aprendidas: number; // posición < puntero Y no en progreso_frases
  porcentaje: number; // round(100 * aprendidas / total)
}

/**
 * Frases del tema grande que pertenecen a un bloque desbloqueado del perfil.
 * Sin filtros de fecha ni de estado de aprendizaje — para sesiones de refuerzo.
 */
export function frasesDelTemaEnNivel(perfil: Perfil, temaId: string): Frase[] {
  const desbloqueados = new Set(perfil.bloques_desbloqueados);
  const resultado: Frase[] = [];
  for (const frase of todasLasFrases) {
    if (!desbloqueados.has(frase.bloque)) continue;
    if (_temasGrandesPorFrase.get(frase.id)?.includes(temaId)) {
      resultado.push(frase);
    }
  }
  return resultado;
}

export function calcularProgresoTemas(perfil: Perfil): ProgresoPorTema[] {
  // Índice de posición dentro del bloque para comparar con puntero_frase_nueva
  const posicionPorFrase = new Map<string, number>();
  for (const bloque of BLOQUES_ORDENADOS) {
    (frasesPorBloque.get(bloque.codigo) ?? []).forEach((f, i) =>
      posicionPorFrase.set(f.id, i)
    );
  }

  const aprendidasPorTema = new Map<string, number>();
  for (const [fraseId, temas] of Array.from(_temasGrandesPorFrase.entries())) {
    const frase = indiceFrases.get(fraseId);
    if (!frase) continue;
    const puntero = perfil.puntero_frase_nueva[frase.bloque] ?? 0;
    const posicion = posicionPorFrase.get(fraseId) ?? Infinity;
    if (posicion < puntero && !(fraseId in perfil.progreso_frases)) {
      for (const tema of temas) {
        aprendidasPorTema.set(tema, (aprendidasPorTema.get(tema) ?? 0) + 1);
      }
    }
  }

  return Array.from(_totalPorTema.entries()).map(([tema, total]) => {
    const aprendidas = aprendidasPorTema.get(tema) ?? 0;
    return {
      tema,
      nivel: _nivelPorTema.get(tema) ?? "basic",
      total,
      aprendidas,
      porcentaje: total > 0 ? Math.round((aprendidas / total) * 100) : 0,
    };
  });
}
