"use client";

import { useMemo, useState } from "react";
import type { FraseContenido } from "../types";

const C = {
  orange: "#FF7A45", orangeBg: "#FFF1EB",
  ink: "#1A1A1A", ink2: "#3D3D3D",
  mute: "#6B6B6B", mute2: "#9A9A9A",
  line: "#E8E2D9", surface: "#F7F3EC",
  green: "#1A9C6B", greenBg: "#E6F6EF",
  amber: "#C77A11", amberBg: "#FBF0DC",
  red: "#D14343", redBg: "#FBE9E9",
};

const BLOQUES_ORDEN = ["BASIC1", "BASIC2", "INT1", "INT2", "INT3", "INT4", "ADV1", "ADV2"];

function calcularId(bloque: string, leccion: string, orden: number): string {
  if (!bloque || !leccion || !orden) return "—";
  const lecNum = leccion.replace(/\D/g, "").padStart(2, "0");
  const ordNum = String(orden).padStart(2, "0");
  return `${bloque}-L${lecNum}-${ordNum}-V1`;
}

function detectarDuplicado(es: string, en: string, frases: FraseContenido[]): FraseContenido | null {
  const clave = es.trim().toLowerCase() + "|||" + en.trim().toLowerCase();
  return frases.find((f) =>
    f.es.trim().toLowerCase() + "|||" + f.en.trim().toLowerCase() === clave
  ) ?? null;
}

export default function AnadirFrase({ frases }: { frases: FraseContenido[] }) {
  const [bloque, setBloque] = useState("");
  const [leccion, setLeccion] = useState("");
  const [ordenAuto, setOrdenAuto] = useState(true);
  const [ordenManual, setOrdenManual] = useState("");
  const [es, setEs] = useState("");
  const [en, setEn] = useState("");
  const [t1, setT1] = useState("");
  const [t2, setT2] = useState("");
  const [t3, setT3] = useState("");
  const [outputVisible, setOutputVisible] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // Lecciones disponibles en el bloque seleccionado
  const leccionesDisponibles = useMemo(() => {
    if (!bloque) return [];
    const set = new Set(frases.filter((f) => f.bloque === bloque).map((f) => f.leccion));
    return Array.from(set).sort();
  }, [frases, bloque]);

  // Siguiente orden disponible para bloque+lección
  const siguienteOrden = useMemo(() => {
    if (!bloque || !leccion) return 1;
    const existentes = frases
      .filter((f) => f.bloque === bloque && f.leccion === leccion)
      .map((f) => f.orden);
    return existentes.length > 0 ? Math.max(...existentes) + 1 : 1;
  }, [frases, bloque, leccion]);

  const orden = ordenAuto ? siguienteOrden : (parseInt(ordenManual) || 0);
  const idCalculado = calcularId(bloque, leccion, orden);
  const duplicado = es.trim() && en.trim() ? detectarDuplicado(es, en, frases) : null;

  // Temas disponibles como sugerencias (los ya existentes en el catálogo)
  const temasDisponibles = useMemo(() => {
    const set = new Set<string>();
    for (const f of frases) for (const t of f.temas_gramaticales) set.add(t);
    return Array.from(set).sort();
  }, [frases]);

  // Validación
  const errores: string[] = [];
  if (!bloque) errores.push("Selecciona un bloque.");
  if (!leccion.trim()) errores.push("Introduce o selecciona una lección.");
  if (!es.trim()) errores.push("La frase en español es obligatoria.");
  if (!en.trim()) errores.push("La frase en inglés es obligatoria.");
  if (!t1.trim()) errores.push("El tema 1 es obligatorio.");
  if (duplicado) errores.push(`Duplicado detectado: ya existe la frase con ID ${duplicado.id}.`);
  if (!ordenAuto && (!parseInt(ordenManual) || parseInt(ordenManual) < 1)) errores.push("El orden debe ser un número positivo.");

  const valido = errores.length === 0;

  // TSV output: columnas del content.json actual
  const temas = [t1, t2, t3].filter(Boolean);
  const tsvRow = [
    idCalculado,
    bloque,
    leccion,
    String(orden),
    es.trim(),
    en.trim(),
    temas[0] ?? "",
    temas[1] ?? "",
    temas[2] ?? "",
  ].join("\t");

  function copiar() {
    navigator.clipboard.writeText(tsvRow).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    });
  }

  function resetForm() {
    setBloque(""); setLeccion(""); setOrdenAuto(true); setOrdenManual("");
    setEs(""); setEn(""); setT1(""); setT2(""); setT3("");
    setOutputVisible(false);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", fontSize: 13, padding: "9px 12px",
    border: `1px solid ${C.line}`, borderRadius: 8,
    background: C.surface, color: C.ink, fontFamily: "inherit",
    transition: "border-color .15s, background .15s",
    outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4,
  };
  const hintStyle: React.CSSProperties = {
    fontSize: 11, color: C.mute, fontWeight: 400, marginLeft: 6,
  };

  return (
    <div style={{ maxWidth: 700 }}>
      {/* Nota */}
      <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 14px", fontSize: 13, color: C.mute, marginBottom: 20 }}>
        El formulario genera la fila TSV para pegar en el Excel v10. <strong>No escribe en el catálogo directamente.</strong> Los campos del Excel v10 no disponibles en esta versión (uso, registro, subtema, problema) se dejan en blanco en el TSV.
      </div>

      <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.04)" }}>

        {/* Bloque + Lección + Orden */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Bloque <span style={{ color: C.red }}>*</span></label>
            <select
              value={bloque}
              onChange={(e) => { setBloque(e.target.value); setLeccion(""); }}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              <option value="">— Selecciona bloque —</option>
              {BLOQUES_ORDEN.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>
              Lección <span style={{ color: C.red }}>*</span>
              <span style={hintStyle}>p.ej. L01, L12</span>
            </label>
            {leccionesDisponibles.length > 0 ? (
              <select
                value={leccion}
                onChange={(e) => setLeccion(e.target.value)}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                <option value="">— Selecciona o escribe —</option>
                {leccionesDisponibles.map((l) => <option key={l} value={l}>{l}</option>)}
                <option value="__nueva__">Nueva lección…</option>
              </select>
            ) : (
              <input
                type="text"
                placeholder="L01"
                value={leccion}
                onChange={(e) => setLeccion(e.target.value.toUpperCase())}
                style={inputStyle}
              />
            )}
            {leccion === "__nueva__" && (
              <input
                type="text"
                placeholder="Escribe el código: L09"
                autoFocus
                onChange={(e) => setLeccion(e.target.value.toUpperCase())}
                style={{ ...inputStyle, marginTop: 6 }}
              />
            )}
          </div>
        </div>

        {/* Orden */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Orden dentro de la lección</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
              <input type="radio" checked={ordenAuto} onChange={() => setOrdenAuto(true)} />
              Auto ({siguienteOrden})
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
              <input type="radio" checked={!ordenAuto} onChange={() => setOrdenAuto(false)} />
              Manual:
            </label>
            {!ordenAuto && (
              <input
                type="number" min={1}
                value={ordenManual}
                onChange={(e) => setOrdenManual(e.target.value)}
                style={{ ...inputStyle, width: 80 }}
              />
            )}
            <span style={{ fontFamily: "monospace", fontSize: 12, color: valido || (!es && !en) ? C.mute : C.mute, background: C.surface, padding: "4px 10px", borderRadius: 6 }}>
              ID: <strong>{idCalculado}</strong>
            </span>
          </div>
        </div>

        {/* Español + Inglés */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Español <span style={{ color: C.red }}>*</span></label>
          <input
            type="text"
            placeholder="Soy de España."
            value={es}
            onChange={(e) => setEs(e.target.value)}
            style={inputStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = C.orange; e.currentTarget.style.background = "#fff"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.background = C.surface; }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Inglés <span style={{ color: C.red }}>*</span></label>
          <input
            type="text"
            placeholder="I'm from Spain."
            value={en}
            onChange={(e) => setEn(e.target.value)}
            style={inputStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = C.orange; e.currentTarget.style.background = "#fff"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.background = C.surface; }}
          />
          {duplicado && (
            <div style={{ marginTop: 6, fontSize: 12, color: C.red, background: C.redBg, borderRadius: 6, padding: "6px 10px" }}>
              ⚠️ Duplicado detectado: ya existe <strong>{duplicado.id}</strong> con el mismo español + inglés.
            </div>
          )}
        </div>

        {/* Temas */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Temas gramaticales <span style={{ color: C.red }}>*</span> <span style={hintStyle}>máximo 3</span></label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {([
              ["Tema 1 *", t1, setT1],
              ["Tema 2", t2, setT2],
              ["Tema 3", t3, setT3],
            ] as [string, string, (v: string) => void][]).map(([label, val, set]) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: C.mute, fontWeight: 600, marginBottom: 4 }}>{label}</div>
                <input
                  type="text"
                  list={`temas-list-${label}`}
                  value={val}
                  onChange={(e) => set(e.target.value)}
                  placeholder="p.ej. Present simple"
                  style={{ ...inputStyle }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = C.orange; e.currentTarget.style.background = "#fff"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.background = C.surface; }}
                />
                <datalist id={`temas-list-${label}`}>
                  {temasDisponibles.map((t) => <option key={t} value={t} />)}
                </datalist>
              </div>
            ))}
          </div>
        </div>

        {/* Errores */}
        {errores.length > 0 && (
          <div style={{ background: C.redBg, borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
            {errores.map((e, i) => (
              <div key={i} style={{ fontSize: 13, color: C.red, lineHeight: 1.6 }}>· {e}</div>
            ))}
          </div>
        )}

        {/* Botones */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setOutputVisible(true)}
            disabled={!valido}
            style={{
              padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700,
              border: "none", cursor: valido ? "pointer" : "default",
              background: valido ? C.orange : C.line, color: valido ? "#fff" : C.mute,
              fontFamily: "inherit", transition: "filter .15s",
            }}
          >
            Generar fila TSV
          </button>
          <button
            onClick={resetForm}
            style={{ padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, border: `1px solid ${C.line}`, background: "#fff", color: C.ink2, cursor: "pointer", fontFamily: "inherit" }}
          >
            Limpiar
          </button>
        </div>

        {/* Output TSV */}
        {outputVisible && valido && (
          <div style={{ marginTop: 18, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "8px 12px", background: C.orangeBg, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.orange }}>Fila TSV lista para pegar en el Excel v10</span>
                <span style={{ fontSize: 11, color: C.amber, marginLeft: 10 }}>campos: id · bloque · lección · orden · español · inglés · t1 · t2 · t3</span>
              </div>
              <button
                onClick={copiar}
                style={{ background: C.orange, color: "#fff", border: "none", padding: "4px 12px", borderRadius: 5, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >
                {copiado ? "✓ Copiado" : "Copiar"}
              </button>
            </div>
            <pre style={{ padding: "12px 14px", fontFamily: "monospace", fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-all", lineHeight: 1.7, margin: 0 }}>
              {tsvRow}
            </pre>
            <div style={{ padding: "8px 14px", borderTop: `1px solid ${C.line}`, fontSize: 11, color: C.mute2 }}>
              Pega esta fila en la hoja del Excel v10, completa los campos faltantes (uso, registro, subtema, problema) y regenera el <code>content.json</code>.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
