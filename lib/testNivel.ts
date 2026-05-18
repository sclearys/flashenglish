import { frasesDelBloque } from "./catalogo";

const FRASES_POR_FASE = 5;

// Los 3 bloques representativos del test, de más fácil a más difícil
const BLOQUES_FASES = ["BASIC1", "INT1", "ADV1"] as const;
export const MAX_FRASES_TEST = BLOQUES_FASES.length * FRASES_POR_FASE; // 15

export interface FraseTest {
  id: string;
  es: string;
  en: string;
}

export interface FaseTest {
  bloque: string;
  frases: FraseTest[];
}

// Precalculado una vez al cargar el módulo, igual que catalogo.ts
export const FASES_TEST: FaseTest[] = BLOQUES_FASES.map((bloque) => ({
  bloque,
  frases: frasesDelBloque(bloque).slice(0, FRASES_POR_FASE).map((f) => ({
    id: f.id,
    es: f.es,
    en: f.en,
  })),
}));

export interface EstadoTest {
  fase: number;          // 0, 1 o 2 — índice en FASES_TEST
  indiceFrase: number;   // 0-4 dentro de la fase actual
  respuestas: boolean[]; // respuestas acumuladas en la fase actual
  terminado: boolean;
  bloqueResultado: string | null;
}

export function iniciarTest(): EstadoTest {
  return {
    fase: 0,
    indiceFrase: 0,
    respuestas: [],
    terminado: false,
    bloqueResultado: null,
  };
}

/**
 * Procesa la respuesta del usuario y devuelve el estado siguiente.
 * Si termina la fase: avanza a la siguiente o calcula el bloque resultado.
 */
export function evaluarRespuesta(estado: EstadoTest, correcto: boolean): EstadoTest {
  const nuevasRespuestas = [...estado.respuestas, correcto];
  const esUltimaFraseDeFase = nuevasRespuestas.length >= FRASES_POR_FASE;

  if (!esUltimaFraseDeFase) {
    return {
      ...estado,
      indiceFrase: estado.indiceFrase + 1,
      respuestas: nuevasRespuestas,
    };
  }

  // Fin de fase: decidir si avanzar o terminar
  const correctas = nuevasRespuestas.filter(Boolean).length;
  const resultado = decidirTrasFinDeFase(estado.fase, correctas);

  if (resultado === null) {
    // Pasar a la siguiente fase
    return {
      fase: estado.fase + 1,
      indiceFrase: 0,
      respuestas: [],
      terminado: false,
      bloqueResultado: null,
    };
  }

  return {
    ...estado,
    indiceFrase: estado.indiceFrase + 1,
    respuestas: nuevasRespuestas,
    terminado: true,
    bloqueResultado: resultado,
  };
}

/**
 * Devuelve el bloque resultado de la fase, o null para avanzar a la siguiente fase.
 *
 * Tabla de decisión:
 *   Fase 0 (BASIC1): ≥4 → null (→ INT1)  |  2-3 → BASIC2  |  ≤1 → BASIC1
 *   Fase 1 (INT1):   ≥4 → null (→ ADV1)  |  2-3 → INT2    |  ≤1 → INT1
 *   Fase 2 (ADV1):   ≥4 → ADV2           |  2-3 → ADV1    |  ≤1 → INT3
 */
function decidirTrasFinDeFase(fase: number, correctas: number): string | null {
  if (fase === 0) {
    if (correctas >= 4) return null;
    if (correctas >= 2) return "BASIC2";
    return "BASIC1";
  }
  if (fase === 1) {
    if (correctas >= 4) return null;
    if (correctas >= 2) return "INT2";
    return "INT1";
  }
  // fase === 2 (ADV1) — última fase, siempre termina
  if (correctas >= 4) return "ADV2";
  if (correctas >= 2) return "ADV1";
  return "INT3";
}

/** Número de la pregunta actual (1-based), para mostrar en el contador "X / 15". */
export function numeroPreguntaActual(estado: EstadoTest): number {
  return estado.fase * FRASES_POR_FASE + estado.respuestas.length + 1;
}
