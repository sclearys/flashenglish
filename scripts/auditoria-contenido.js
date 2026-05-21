'use strict';

const fs   = require('fs');
const path = require('path');

// Lee app/data/content.json (copia del catálogo usada en el build).
const rutaCatalogo = path.resolve(__dirname, '../data/content.json');
const catalogo     = JSON.parse(fs.readFileSync(rutaCatalogo, 'utf-8'));
const frases       = catalogo.frases;

const BLOQUES_ORDEN   = ['BASIC1', 'BASIC2', 'INT1', 'INT2', 'INT3', 'INT4', 'ADV1', 'ADV2'];
const BLOQUES_BASIC_INT = new Set(['BASIC1', 'BASIC2', 'INT1', 'INT2', 'INT3', 'INT4']);
const UMBRAL_INFRA    = 10; // < N frases en un bloque Basic/Int = hueco a rellenar

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function temaGrande(etiqueta) {
  return etiqueta.split(':')[0].trim();
}

function contarPalabras(frase) {
  return frase.trim().split(/\s+/).filter(Boolean).length;
}

function media(arr) {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function mediana(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function r1(n) {
  return Math.round(n * 10) / 10;
}

function sep(char, ancho) {
  return (char || '─').repeat(ancho || 90);
}

function pL(val, w) { return String(val).padStart(w); }
function pR(val, w) { return String(val).padEnd(w); }

// ─── CONSTRUCCIÓN DE ÍNDICES ─────────────────────────────────────────────────

// Temas grandes únicos (ordenados)
const temasGrandesSet = new Set();
for (const fr of frases) {
  for (const et of fr.temas_gramaticales) temasGrandesSet.add(temaGrande(et));
}
const temasGrandes = [...temasGrandesSet].sort();

// Matriz: tema → bloque → Set<id> (Set para que una frase con dos etiquetas del mismo
// tema grande cuente solo una vez en esa celda)
const matriz = {};
for (const tema of temasGrandes) {
  matriz[tema] = {};
  for (const bloque of BLOQUES_ORDEN) matriz[tema][bloque] = new Set();
}
for (const fr of frases) {
  const tgDeEstaFrase = new Set(fr.temas_gramaticales.map(temaGrande));
  for (const tg of tgDeEstaFrase) {
    if (matriz[tg]) matriz[tg][fr.bloque].add(fr.id);
  }
}

// Matriz de conteos numéricos + columna ACUM_BI
const conteo = {};
for (const tema of temasGrandes) {
  conteo[tema] = {};
  let acum = 0;
  for (const bloque of BLOQUES_ORDEN) {
    const n = matriz[tema][bloque].size;
    conteo[tema][bloque] = n;
    if (BLOQUES_BASIC_INT.has(bloque)) acum += n;
  }
  conteo[tema]['ACUM_BI'] = acum;
}

// Temas ordenados por ACUM_BI ascendente (huecos primero)
const temasOrd = [...temasGrandes].sort((a, b) => conteo[a]['ACUM_BI'] - conteo[b]['ACUM_BI']);

// ─── CABECERA DEL INFORME ────────────────────────────────────────────────────

const ANCHO = 92;
console.log('\n' + sep('═', ANCHO));
console.log('INFORME DE AUDITORÍA DEL CATÁLOGO  —  FlashEnglish');
console.log(`Versión: ${catalogo.version}   |   Frases: ${catalogo.total_frases}   |   Fecha catálogo: ${catalogo.fecha_generacion}`);
console.log(sep('═', ANCHO));

// ════════════════════════════════════════════════════════════════════════════════
// A. TABLA CRUZADA TEMA × BLOQUE
// ════════════════════════════════════════════════════════════════════════════════

const ANCHO_TEMA = Math.max(...temasGrandes.map(t => t.length), 10) + 2;
const ANCHO_NUM  = 8;

console.log('\n' + sep('─', ANCHO));
console.log('A. DISTRIBUCIÓN POR TEMA GRANDE × BLOQUE');
console.log('   Celdas: nº de frases que tocan ese tema en ese bloque.');
console.log('   "ACUM B+I" = suma BASIC1+BASIC2+INT1+INT2+INT3+INT4.');
console.log('   Tabla ordenada por ACUM B+I ascendente — los huecos aparecen primero.');
console.log(sep('─', ANCHO));

// Cabecera de columnas
let cabecera = pR('TEMA', ANCHO_TEMA);
cabecera += pL('ACUM B+I', ANCHO_NUM + 2);
for (const bloque of BLOQUES_ORDEN) cabecera += pL(bloque, ANCHO_NUM);
console.log(cabecera);
console.log(sep('·', ANCHO_TEMA + ANCHO_NUM + 2 + BLOQUES_ORDEN.length * ANCHO_NUM));

for (const tema of temasOrd) {
  const acum = conteo[tema]['ACUM_BI'];
  let linea = pR(tema, ANCHO_TEMA);
  linea += pL(acum === 0 ? '—' : String(acum), ANCHO_NUM + 2);
  for (const bloque of BLOQUES_ORDEN) {
    const n = conteo[tema][bloque];
    linea += pL(n === 0 ? '·' : String(n), ANCHO_NUM);
  }
  console.log(linea);
}

// ════════════════════════════════════════════════════════════════════════════════
// B. TEMAS INFRARREPRESENTADOS EN BLOQUES TEMPRANOS
// ════════════════════════════════════════════════════════════════════════════════

console.log('\n' + sep('─', ANCHO));
console.log('B. TEMAS INFRARREPRESENTADOS EN BLOQUES BASIC / INTERMEDIATE');
console.log(`   Dos grupos: (1) ausentes por completo de Basic+Int; (2) presentes pero con < ${UMBRAL_INFRA} frases por bloque.`);
console.log(sep('─', ANCHO));

// Grupo 1: ACUM_BI = 0
const soloAvanzados = temasGrandes.filter(t => conteo[t]['ACUM_BI'] === 0);
console.log('\n  GRUPO 1 — Temas ausentes de Basic+Int (solo aparecen en ADV1/ADV2):');
if (soloAvanzados.length === 0) {
  console.log('  (ninguno)');
} else {
  for (const tema of soloAvanzados) {
    const adv1 = conteo[tema]['ADV1'];
    const adv2 = conteo[tema]['ADV2'];
    console.log(`  • ${tema.padEnd(ANCHO_TEMA - 2)} ADV1: ${String(adv1).padStart(3)}  ADV2: ${String(adv2).padStart(3)}`);
  }
}

// Grupo 2: pares (tema, bloque) donde bloque ∈ B/I, count > 0 y count < UMBRAL_INFRA
console.log(`\n  GRUPO 2 — Pares (tema, bloque) donde 0 < frases < ${UMBRAL_INFRA} en un bloque Basic/Int:`);
const paresInfra = [];
for (const tema of temasGrandes) {
  for (const bloque of BLOQUES_ORDEN) {
    if (!BLOQUES_BASIC_INT.has(bloque)) continue;
    const n = conteo[tema][bloque];
    if (n > 0 && n < UMBRAL_INFRA) paresInfra.push({ tema, bloque, n });
  }
}
paresInfra.sort((a, b) => a.n - b.n || a.tema.localeCompare(b.tema));

if (paresInfra.length === 0) {
  console.log('  (ninguno)');
} else {
  const cabPares = `  ${'TEMA'.padEnd(ANCHO_TEMA)}${'BLOQUE'.padStart(8)}${'FRASES'.padStart(8)}`;
  console.log(cabPares);
  for (const { tema, bloque, n } of paresInfra) {
    console.log(`  ${tema.padEnd(ANCHO_TEMA)}${bloque.padStart(8)}${String(n).padStart(8)}`);
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// C. DISTRIBUCIÓN DE FRASES POR NÚMERO DE TEMAS
// ════════════════════════════════════════════════════════════════════════════════

console.log('\n' + sep('─', ANCHO));
console.log('C. DISTRIBUCIÓN DE FRASES POR NÚMERO DE TEMAS GRAMATICALES');
console.log('   Cuántas frases tienen 1, 2 o 3 etiquetas (por bloque y total).');
console.log('   Una densidad temática alta significa más contexto de repaso cruzado.');
console.log(sep('─', ANCHO));

const ANCHO_B = 9;
let cabC = pR('BLOQUE', 10);
cabC += pL('1 tema', ANCHO_B) + pL('2 temas', ANCHO_B) + pL('3 temas', ANCHO_B) + pL('TOTAL', ANCHO_B) + pL('% con ≥2', ANCHO_B);
console.log('\n' + cabC);
console.log(sep('·', 10 + ANCHO_B * 5));

const bloquesMasTotal = [...BLOQUES_ORDEN, 'TOTAL'];
const countsPorBloque = {};
for (const bloque of bloquesMasTotal) {
  countsPorBloque[bloque] = { 1: 0, 2: 0, 3: 0 };
}
for (const fr of frases) {
  const n = fr.temas_gramaticales.length;
  const k = Math.min(n, 3); // por si hubiera más de 3
  countsPorBloque[fr.bloque][k]++;
  countsPorBloque['TOTAL'][k]++;
}

for (const bloque of bloquesMasTotal) {
  const c = countsPorBloque[bloque];
  const total = (c[1] || 0) + (c[2] || 0) + (c[3] || 0);
  const conDos = (c[2] || 0) + (c[3] || 0);
  const pct = total > 0 ? r1((conDos / total) * 100) : 0;
  let linea = pR(bloque, 10);
  linea += pL(c[1] || 0, ANCHO_B);
  linea += pL(c[2] || 0, ANCHO_B);
  linea += pL(c[3] || 0, ANCHO_B);
  linea += pL(total, ANCHO_B);
  linea += pL(`${pct}%`, ANCHO_B);
  console.log(linea);
}

// ════════════════════════════════════════════════════════════════════════════════
// D. LONGITUD DE FRASE POR BLOQUE
// ════════════════════════════════════════════════════════════════════════════════

console.log('\n' + sep('─', ANCHO));
console.log('D. LONGITUD DE LA FRASE EN INGLÉS POR BLOQUE');
console.log('   Caracteres y palabras. La progresión debería ser monótonamente creciente.');
console.log('   Se señala explícitamente cualquier bloque que rompa la tendencia.');
console.log(sep('─', ANCHO));

const ANCHO_L = 9;
let cabD = pR('BLOQUE', 10);
cabD += pL('Frases', ANCHO_L);
cabD += pL('Med.car', ANCHO_L) + pL('Mediana', ANCHO_L) + pL('Min.car', ANCHO_L) + pL('Max.car', ANCHO_L);
cabD += pL('Med.pal', ANCHO_L) + pL('Mdn.pal', ANCHO_L) + pL('Min.pal', ANCHO_L) + pL('Max.pal', ANCHO_L);
console.log('\n' + cabD);
console.log(sep('·', 10 + ANCHO_L * 9));

const statsLong = {};
for (const bloque of BLOQUES_ORDEN) {
  const frasesBloque = frases.filter(fr => fr.bloque === bloque);
  const chars  = frasesBloque.map(fr => fr.en.length);
  const pals   = frasesBloque.map(fr => contarPalabras(fr.en));
  statsLong[bloque] = {
    n:          frasesBloque.length,
    mediaChar:  r1(media(chars)),
    medianaChar: r1(mediana(chars)),
    minChar:    Math.min(...chars),
    maxChar:    Math.max(...chars),
    mediaPal:   r1(media(pals)),
    medianaPal: r1(mediana(pals)),
    minPal:     Math.min(...pals),
    maxPal:     Math.max(...pals),
  };
}

for (const bloque of BLOQUES_ORDEN) {
  const s = statsLong[bloque];
  let linea = pR(bloque, 10);
  linea += pL(s.n,           ANCHO_L);
  linea += pL(s.mediaChar,   ANCHO_L);
  linea += pL(s.medianaChar, ANCHO_L);
  linea += pL(s.minChar,     ANCHO_L);
  linea += pL(s.maxChar,     ANCHO_L);
  linea += pL(s.mediaPal,    ANCHO_L);
  linea += pL(s.medianaPal,  ANCHO_L);
  linea += pL(s.minPal,      ANCHO_L);
  linea += pL(s.maxPal,      ANCHO_L);
  console.log(linea);
}

// Detección de drift (usando mediana de caracteres como métrica principal)
console.log('\n  Detección de drift de dificultad (mediana de caracteres entre bloques consecutivos):');
let driftDetectado = false;
for (let i = 1; i < BLOQUES_ORDEN.length; i++) {
  const bloqueAnterior = BLOQUES_ORDEN[i - 1];
  const bloqueActual   = BLOQUES_ORDEN[i];
  const antes  = statsLong[bloqueAnterior].medianaChar;
  const ahora  = statsLong[bloqueActual].medianaChar;
  const diff   = r1(ahora - antes);
  if (ahora < antes) {
    console.log(`  ⚠ POSIBLE DRIFT: ${bloqueActual} (mediana ${ahora} car) < ${bloqueAnterior} (mediana ${antes} car) — diferencia ${diff} car`);
    driftDetectado = true;
  }
}
if (!driftDetectado) {
  console.log('  ✓ Sin drift detectado. La mediana de longitud es monótonamente creciente.');
}

// ════════════════════════════════════════════════════════════════════════════════
// E. RESUMEN EJECUTIVO
// ════════════════════════════════════════════════════════════════════════════════

console.log('\n' + sep('═', ANCHO));
console.log('E. RESUMEN EJECUTIVO');
console.log(sep('═', ANCHO));

// Top 3 huecos: temas con menor ACUM_BI (excluye los de ACUM_BI = 0 que ya son grupo 1)
// Ordenados: primero los completamente ausentes, luego los más escasos
const temasOrdenPorHueco = [...temasGrandes].sort((a, b) => conteo[a]['ACUM_BI'] - conteo[b]['ACUM_BI']);
const top3Huecos = temasOrdenPorHueco.slice(0, 3);

console.log('\n  TOP 3 HUECOS EN BASIC+INT (mayor impacto para extraer frases del libro):');
for (let i = 0; i < top3Huecos.length; i++) {
  const tema  = top3Huecos[i];
  const acum  = conteo[tema]['ACUM_BI'];
  const adv1  = conteo[tema]['ADV1'];
  const adv2  = conteo[tema]['ADV2'];
  const totalAdv = adv1 + adv2;
  const desc = acum === 0
    ? `Ausente de Basic+Int. Solo en Advanced: ${totalAdv} frases.`
    : `Solo ${acum} frases en Basic+Int. En Advanced: ${totalAdv} frases.`;
  console.log(`  ${i + 1}. ${tema} — ${desc}`);
}

// Drift
console.log('\n  DRIFT DE LONGITUD:');
let driftResumen = false;
for (let i = 1; i < BLOQUES_ORDEN.length; i++) {
  const ba = BLOQUES_ORDEN[i - 1];
  const bb = BLOQUES_ORDEN[i];
  if (statsLong[bb].medianaChar < statsLong[ba].medianaChar) {
    console.log(`  ⚠ ${bb} tiene mediana ${statsLong[bb].medianaChar} car, menor que ${ba} (${statsLong[ba].medianaChar} car).`);
    driftResumen = true;
  }
}
if (!driftResumen) console.log('  ✓ Sin drift. La dificultad de longitud crece de forma consistente.');

// Temas solo en Advanced
console.log('\n  TEMAS SOLO EN ADVANCED (riesgo de progresión rota para usuarios en Basic/Int):');
if (soloAvanzados.length === 0) {
  console.log('  ✓ Todos los temas tienen al menos alguna frase en Basic o Intermediate.');
} else {
  for (const t of soloAvanzados) console.log(`  • ${t}`);
}

// Densidad temática global
const total1 = countsPorBloque['TOTAL'][1] || 0;
const total2 = countsPorBloque['TOTAL'][2] || 0;
const total3 = countsPorBloque['TOTAL'][3] || 0;
const totalFr = total1 + total2 + total3;
const pctMulti = r1(((total2 + total3) / totalFr) * 100);
console.log(`\n  DENSIDAD TEMÁTICA GLOBAL: ${pctMulti}% de las frases tienen 2 o más temas (${total2} con 2, ${total3} con 3).`);

console.log('\n' + sep('═', ANCHO) + '\n');
