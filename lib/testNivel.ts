import rawCatalogo from "../data/content.json";
import type { Frase } from "./types";

export type BloqueId =
  | "BASIC1"
  | "BASIC2"
  | "INT1"
  | "INT2"
  | "INT3"
  | "INT4"
  | "ADV1"
  | "ADV2";

type FaseTest = "fase1" | "fase2";

export interface EstadoTest {
  fase: FaseTest;
  frasesActuales: string[]; // IDs de las frases en pantalla ahora
  respuestas: Record<string, boolean>; // id -> sabe/no sabe
  zonaProbable?: [BloqueId, BloqueId]; // par [inferior, superior] calculado en fase1
}

export interface ResultadoTest {
  bloqueAsignado: BloqueId;
  esCasoExtremo: boolean; // true si BASIC1 o ADV2
}

export interface FraseTest {
  id: string;
  es: string;
  en: string;
}

export const ANCLAS_TEST = {
  INT2_fase1: ["INT2-L02-08-V1", "INT2-L05-01-V1", "INT2-L07-08-V1"],
  BASIC1: [
    "BASIC1-L01-03-V1",
    "BASIC1-L03-06-V1",
    "BASIC1-L04-08-V1",
    "BASIC1-L07-13-V1",
  ],
  BASIC2: [
    "BASIC2-L01-02-V1",
    "BASIC2-L03-04-V1",
    "BASIC2-L04-04-V1",
    "BASIC2-L08-09-V1",
  ],
  INT1: [
    "INT1-L01-08-V1",
    "INT1-L02-08-V1",
    "INT1-L03-04-V1",
    "INT1-L04-12-V1",
  ],
  INT2: [
    "INT2-L02-08-V1",
    "INT2-L05-01-V1",
    "INT2-L07-08-V1",
    "INT2-L06-09-V1",
  ],
  INT3: [
    "INT3-L02-08-V1",
    "INT3-L05-01-V1",
    "INT3-L06-08-V1",
    "INT3-L08-01-V1",
  ],
  INT4: [
    "INT4-L03-01-V1",
    "INT4-L05-08-V1",
    "INT4-L08-01-V1",
    "INT4-L11-01-V1",
  ],
  ADV1: [
    "ADV1-L03-01-V1",
    "ADV1-L05-08-V1",
    "ADV1-L08-08-V1",
    "ADV1-L11-01-V1",
  ],
  ADV2: [
    "ADV2-L02-08-V1",
    "ADV2-L04-08-V1",
    "ADV2-L07-08-V1",
    "ADV2-L10-08-V1",
  ],
} as const;

const ORDEN_BLOQUES: BloqueId[] = [
  "BASIC1",
  "BASIC2",
  "INT1",
  "INT2",
  "INT3",
  "INT4",
  "ADV1",
  "ADV2",
];

function bloqueAnterior(bloque: BloqueId): BloqueId {
  const idx = ORDEN_BLOQUES.indexOf(bloque);
  return idx > 0 ? ORDEN_BLOQUES[idx - 1] : "BASIC1";
}

function contarAciertos(
  respuestas: Record<string, boolean>,
  ids: readonly string[]
): number {
  return ids.filter((id) => respuestas[id] === true).length;
}

export function iniciarTest(): EstadoTest {
  return {
    fase: "fase1",
    frasesActuales: [...ANCLAS_TEST.INT2_fase1],
    respuestas: {},
  };
}

export function registrarRespuesta(
  estado: EstadoTest,
  idFrase: string,
  sabe: boolean
): EstadoTest {
  return {
    ...estado,
    respuestas: { ...estado.respuestas, [idFrase]: sabe },
  };
}

export function testCompletado(estado: EstadoTest): boolean {
  return estado.frasesActuales.every((id) => id in estado.respuestas);
}

export function calcularSiguienteFase(estado: EstadoTest): EstadoTest {
  const aciertos = contarAciertos(estado.respuestas, ANCLAS_TEST.INT2_fase1);

  let zonaProbable: [BloqueId, BloqueId];
  if (aciertos === 3) zonaProbable = ["INT4", "ADV1"];
  else if (aciertos === 2) zonaProbable = ["INT3", "INT4"];
  else if (aciertos === 1) zonaProbable = ["INT2", "INT3"];
  else zonaProbable = ["BASIC2", "INT1"];

  const [inferior, superior] = zonaProbable;
  const frasesInferior = [...ANCLAS_TEST[inferior]];
  const frasesSuperior = [...ANCLAS_TEST[superior]];

  return {
    ...estado,
    fase: "fase2",
    frasesActuales: [...frasesInferior, ...frasesSuperior],
    zonaProbable,
  };
}

export function calcularResultado(estado: EstadoTest): ResultadoTest {
  const [inferior, superior] = estado.zonaProbable!;

  const scoreInferior =
    contarAciertos(estado.respuestas, ANCLAS_TEST[inferior]) / 4;
  const scoreSuperior =
    contarAciertos(estado.respuestas, ANCLAS_TEST[superior]) / 4;

  let bloqueAsignado: BloqueId;

  if (scoreInferior >= 0.75 && scoreSuperior >= 0.6) {
    bloqueAsignado = superior;
  } else if (scoreInferior >= 0.75 && scoreSuperior < 0.6) {
    bloqueAsignado = inferior;
  } else {
    bloqueAsignado = bloqueAnterior(inferior);
  }

  const esCasoExtremo =
    bloqueAsignado === "BASIC1" || bloqueAsignado === "ADV2";

  return { bloqueAsignado, esCasoExtremo };
}

const _todasLasFrases = rawCatalogo.frases as Frase[];

// Devuelve los datos completos de una frase ancla para mostrarla en el test
export function getFraseTest(id: string): FraseTest | null {
  const frase = _todasLasFrases.find((f) => f.id === id);
  if (!frase) return null;
  return { id: frase.id, es: frase.es, en: frase.en };
}
