"use client";

import { useMemo, useState } from "react";
import type { FraseContenido } from "../types";

const C = {
  orange: "#FF7A45", orangeBg: "#FFF1EB",
  ink: "#1A1A1A", ink2: "#3D3D3D",
  mute: "#6B6B6B", mute2: "#9A9A9A",
  line: "#E8E2D9", surface: "#F7F3EC", bg: "#FCFAF6",
  green: "#1A9C6B", greenBg: "#E6F6EF",
  amber: "#C77A11", amberBg: "#FBF0DC",
  red: "#D14343", redBg: "#FBE9E9",
  blue: "#2563EB", blueBg: "#EFF6FF",
  purple: "#7B5EA7", purpleBg: "#F3EEFF",
};

const BLOQUES_ORDEN = ["BASIC1", "BASIC2", "INT1", "INT2", "INT3", "INT4", "ADV1", "ADV2"];

const NIVEL_COLOR: Record<string, string> = {
  BASIC1: "#3B82F6", BASIC2: "#3B82F6",
  INT1: "#8B5CF6", INT2: "#8B5CF6", INT3: "#8B5CF6", INT4: "#8B5CF6",
  ADV1: "#EF4444", ADV2: "#EF4444",
};
const NIVEL_LABEL: Record<string, string> = {
  BASIC1: "Basic", BASIC2: "Basic",
  INT1: "Intermediate", INT2: "Intermediate", INT3: "Intermediate", INT4: "Intermediate",
  ADV1: "Advanced", ADV2: "Advanced",
};

type LeccionDerived = {
  leccion: string;
  orden: number;
  temaProtagonista: string;
  temasSecundarios: string[];
  totalFrases: number;
};

type BloqueDerived = {
  bloque: string;
  lecciones: LeccionDerived[];
  totalFrases: number;
};

function derivarMapa(frases: FraseContenido[]): BloqueDerived[] {
  // Agrupar por bloque → leccion
  const porBloque = new Map<string, Map<string, FraseContenido[]>>();
  for (const f of frases) {
    if (!porBloque.has(f.bloque)) porBloque.set(f.bloque, new Map());
    const bl = porBloque.get(f.bloque)!;
    if (!bl.has(f.leccion)) bl.set(f.leccion, []);
    bl.get(f.leccion)!.push(f);
  }

  return BLOQUES_ORDEN.filter((b) => porBloque.has(b)).map((bloque) => {
    const leccionesMap = porBloque.get(bloque)!;
    const lecciones: LeccionDerived[] = Array.from(leccionesMap.entries())
      .map(([leccion, frs]) => {
        // Tema protagonista: el más frecuente en posición 0
        const temaCounts = new Map<string, number>();
        for (const f of frs) {
          const t = f.temas_gramaticales[0];
          if (t) temaCounts.set(t, (temaCounts.get(t) ?? 0) + 1);
        }
        const temaProtagonista = Array.from(temaCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

        // Temas secundarios: todos los distintos excepto el protagonista
        const todosSet = new Set<string>();
        for (const f of frs) for (const t of f.temas_gramaticales) todosSet.add(t);
        todosSet.delete(temaProtagonista);
        const temasSecundarios = Array.from(todosSet).slice(0, 4);

        const orden = parseInt(leccion.replace("L", ""), 10) || 0;
        return { leccion, orden, temaProtagonista, temasSecundarios, totalFrases: frs.length };
      })
      .sort((a, b) => a.orden - b.orden);

    const totalFrases = lecciones.reduce((s, l) => s + l.totalFrases, 0);
    return { bloque, lecciones, totalFrases };
  });
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function MapaMaestro({ frases }: { frases: FraseContenido[] }) {
  const [filtroBloque, setFiltroBloque] = useState("todos");

  const mapa = useMemo(() => derivarMapa(frases), [frases]);

  const mapaFiltrado = filtroBloque === "todos"
    ? mapa
    : mapa.filter((b) => b.bloque === filtroBloque);

  const selectStyle: React.CSSProperties = {
    fontSize: 13, padding: "8px 11px",
    border: `1px solid ${C.line}`, borderRadius: 8,
    background: C.surface, color: C.ink, fontFamily: "inherit", cursor: "pointer",
  };

  return (
    <div>
      {/* Nota de datos limitados */}
      <div style={{ background: C.amberBg, border: `1px solid #FDE68A`, borderRadius: 8, padding: "9px 14px", fontSize: 13, color: C.amber, marginBottom: 18, display: "flex", gap: 8 }}>
        ⚠️ <span>Vista derivada de <code>content.json</code>. Foco didáctico, subtemas objetivo y dificultad no disponibles hasta que se añada la hoja <strong>MAPA_MAESTRO</strong> del Excel v10.</span>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, alignItems: "center" }}>
        <select value={filtroBloque} onChange={(e) => setFiltroBloque(e.target.value)} style={selectStyle}>
          <option value="todos">Todos los bloques</option>
          {BLOQUES_ORDEN.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <span style={{ fontSize: 12, color: C.mute, background: C.surface, padding: "4px 10px", borderRadius: 20, fontWeight: 600 }}>
          {mapaFiltrado.reduce((s, b) => s + b.lecciones.length, 0)} lecciones · {mapaFiltrado.reduce((s, b) => s + b.totalFrases, 0)} frases
        </span>
      </div>

      {/* Bloques */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {mapaFiltrado.map((bloque) => (
          <BloqueCard key={bloque.bloque} bloque={bloque} />
        ))}
      </div>
    </div>
  );
}

function BloqueCard({ bloque }: { bloque: BloqueDerived }) {
  const nivelColor = NIVEL_COLOR[bloque.bloque] ?? C.mute;
  const nivelLabel = NIVEL_LABEL[bloque.bloque] ?? "—";
  const totalLecciones = bloque.lecciones.length;

  return (
    <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.04)" }}>
      {/* Cabecera del bloque */}
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: 12, background: C.surface }}>
        <span style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 800, color: C.ink }}>{bloque.bloque}</span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 5, color: "#fff", background: nivelColor }}>{nivelLabel}</span>
        <span style={{ fontSize: 12, color: C.mute, fontWeight: 500 }}>{totalLecciones} lecciones · {bloque.totalFrases} frases</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 120, height: 6, background: C.line, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 3, background: nivelColor, width: "100%" }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: nivelColor }}>100%</span>
        </div>
      </div>

      {/* Tabla de lecciones */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Lección", "Tema protagonista", "Temas secundarios", "Frases (progreso)", "Frases (refuerzo)"].map((h) => (
                <th key={h} style={{ textAlign: "left", fontSize: 10, fontWeight: 700, color: C.mute, padding: "7px 14px", background: C.surface, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `1px solid ${C.line}`, whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bloque.lecciones.map((lec, i) => (
              <tr key={lec.leccion}>
                <td style={{ padding: "9px 14px", fontSize: 11, fontFamily: "monospace", color: C.mute, borderBottom: i < bloque.lecciones.length - 1 ? `1px solid ${C.surface}` : "none", whiteSpace: "nowrap", verticalAlign: "middle" }}>
                  {bloque.bloque}-{lec.leccion}
                </td>
                <td style={{ padding: "9px 14px", fontSize: 13, fontWeight: 700, borderBottom: i < bloque.lecciones.length - 1 ? `1px solid ${C.surface}` : "none", verticalAlign: "middle" }}>
                  {lec.temaProtagonista}
                </td>
                <td style={{ padding: "9px 14px", borderBottom: i < bloque.lecciones.length - 1 ? `1px solid ${C.surface}` : "none", verticalAlign: "middle" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {lec.temasSecundarios.length > 0
                      ? lec.temasSecundarios.map((t) => (
                          <span key={t} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: C.surface, color: C.mute, fontWeight: 600 }}>{t}</span>
                        ))
                      : <span style={{ fontSize: 12, color: C.mute2 }}>—</span>}
                  </div>
                </td>
                <td style={{ padding: "9px 14px", borderBottom: i < bloque.lecciones.length - 1 ? `1px solid ${C.surface}` : "none", verticalAlign: "middle" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: C.orangeBg, color: C.orange }}>
                      {lec.totalFrases}
                    </span>
                  </div>
                </td>
                <td style={{ padding: "9px 14px", fontSize: 12, color: C.mute2, borderBottom: i < bloque.lecciones.length - 1 ? `1px solid ${C.surface}` : "none", verticalAlign: "middle" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: C.surface, color: C.mute2 }}>0</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
