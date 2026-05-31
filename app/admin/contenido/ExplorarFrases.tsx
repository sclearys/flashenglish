"use client";

import { useMemo, useState } from "react";
import type { FraseContenido, UsageStats } from "../types";

const C = {
  orange: "#FF7A45", orangeBg: "#FFF1EB", orange100: "#FFE0D2",
  ink: "#1A1A1A", ink2: "#3D3D3D",
  mute: "#6B6B6B", mute2: "#9A9A9A",
  line: "#E8E2D9", surface: "#F7F3EC", bg: "#FCFAF6",
  green: "#1A9C6B", greenBg: "#E6F6EF",
  amber: "#C77A11", amberBg: "#FBF0DC",
  red: "#D14343", redBg: "#FBE9E9",
};

const ID_RE = /^(BASIC[12]|INT[1-4]|ADV[12])-L\d{2}-\d{2}-V\d+$/;
const BLOQUES_ORDEN = ["BASIC1", "BASIC2", "INT1", "INT2", "INT3", "INT4", "ADV1", "ADV2"];

type Flags = { dup: boolean; idIrregular: boolean };

function buildFlagsMap(frases: FraseContenido[]): Map<string, Flags> {
  const vistos = new Map<string, string[]>();
  for (const f of frases) {
    const clave = f.es.trim() + "|||" + f.en.trim();
    if (!vistos.has(clave)) vistos.set(clave, []);
    vistos.get(clave)!.push(f.id);
  }
  const dupIds = new Set<string>();
  Array.from(vistos.values()).forEach((ids) => {
    if (ids.length > 1) ids.forEach((id: string) => dupIds.add(id));
  });
  const map = new Map<string, Flags>();
  for (const f of frases) {
    map.set(f.id, { dup: dupIds.has(f.id), idIrregular: !ID_RE.test(f.id) });
  }
  return map;
}

// ── Mini-barra de uso ─────────────────────────────────────────────────────────

function UsageMiniBar({ usage }: { usage: UsageStats | undefined }) {
  if (!usage || usage.enRepaso === 0) {
    return <span style={{ color: C.mute2, fontSize: 12 }}>—</span>;
  }
  const total = usage.enRepaso;
  const falloPct = Math.round((usage.fallo / total) * 100);
  const casiPct = Math.round((usage.casi / total) * 100);
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
      <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
        {usage.fallo > 0 && <div style={{ width: Math.max(6, falloPct * 0.4), height: 13, borderRadius: 2, background: C.red }} title={`${usage.fallo} fallo`} />}
        {usage.casi > 0 && <div style={{ width: Math.max(6, casiPct * 0.4), height: 13, borderRadius: 2, background: C.amber }} title={`${usage.casi} casi`} />}
      </div>
      <span style={{ fontSize: 11, color: C.mute, fontWeight: 600 }}>{total}</span>
    </div>
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────────

function DrawerFrase({
  frase,
  flags,
  usage,
  onCerrar,
}: {
  frase: FraseContenido;
  flags: Flags;
  usage: UsageStats | undefined;
  onCerrar: () => void;
}) {
  const [outputVisible, setOutputVisible] = useState<"sql" | "tsv" | null>(null);
  const [copiado, setCopiado] = useState(false);

  const tsvRow = [
    frase.id, frase.bloque, frase.leccion, String(frase.orden),
    frase.es, frase.en,
    frase.temas_gramaticales[0] ?? "",
    frase.temas_gramaticales[1] ?? "",
    frase.temas_gramaticales[2] ?? "",
  ].join("\t");

  const sqlRow =
    `UPDATE frases SET\n` +
    `  es = '${frase.es.replace(/'/g, "''")}',\n` +
    `  en = '${frase.en.replace(/'/g, "''")}'\n` +
    `WHERE id = '${frase.id}';`;

  function copiar(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    });
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%", fontSize: 13, padding: "9px 12px",
    border: `1px solid ${C.line}`, borderRadius: 8,
    background: C.surface, color: C.ink, fontFamily: "inherit",
    opacity: 0.75, cursor: "default",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block", color: C.ink2,
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: C.mute,
    textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10,
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onCerrar}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.25)",
          zIndex: 200, backdropFilter: "blur(2px)",
        }}
      />

      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: 540, maxWidth: "95vw",
        background: "#fff", zIndex: 201,
        boxShadow: "-8px 0 40px rgba(0,0,0,.12)",
        display: "flex", flexDirection: "column",
        overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "flex-start", gap: 12, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: C.mute, marginBottom: 3 }}>{frase.id}</div>
            <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>{frase.es}</div>
            <div style={{ fontSize: 13, color: C.ink2, marginTop: 3, fontStyle: "italic" }}>{frase.en}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {flags.dup && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: C.redBg, color: C.red }}>DUP</span>}
              {flags.idIrregular && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: C.amberBg, color: C.amber }}>ID irregular</span>}
            </div>
          </div>
          <button onClick={onCerrar} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: C.mute, lineHeight: 1, padding: 4, flexShrink: 0 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: 22, flex: 1 }}>

          {/* Campos del catálogo */}
          <div style={{ marginBottom: 22 }}>
            <div style={sectionTitle}>Campos del catálogo</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Bloque</label>
                <input readOnly value={frase.bloque} style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>Lección</label>
                <input readOnly value={frase.leccion} style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>Orden</label>
                <input readOnly value={String(frase.orden)} style={fieldStyle} />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Español</label>
              <input readOnly value={frase.es} style={fieldStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Inglés</label>
              <input readOnly value={frase.en} style={fieldStyle} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Temas gramaticales</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {frase.temas_gramaticales.map((t) => (
                  <span key={t} style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 6, background: C.orangeBg, color: C.orange }}>{t}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Campos pendientes de v10 */}
          <div style={{ marginBottom: 22 }}>
            <div style={sectionTitle}>Campos pendientes (Excel v10 completo)</div>
            <div style={{ background: C.surface, borderRadius: 8, padding: "12px 14px", fontSize: 13, color: C.mute, lineHeight: 1.6 }}>
              <code style={{ fontSize: 12 }}>uso · tema_prot · registro · subtema · problema</code>
              <br />
              Disponibles cuando se actualice el catálogo con el Excel v10 completo.
            </div>
          </div>

          {/* Uso por perfil */}
          <div style={{ marginBottom: 22 }}>
            <div style={sectionTitle}>Uso en repaso activo</div>
            {!usage || usage.enRepaso === 0 ? (
              <p style={{ fontSize: 13, color: C.mute, background: C.surface, borderRadius: 8, padding: "12px 14px" }}>
                Esta frase no está en repaso activo en ningún perfil. Puede ser que nadie la haya visto aún, o que ya esté dominada por todos los que la vieron.
              </p>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 9, marginBottom: 12 }}>
                  {([["En repaso", usage.enRepaso, C.orange], ["Estado casi", usage.casi, C.amber], ["Estado fallo", usage.fallo, C.red]] as [string, number, string][]).map(([label, num, color]) => (
                    <div key={label} style={{ background: C.surface, borderRadius: 8, padding: "11px 13px", textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color, letterSpacing: "-0.02em" }}>{num}</div>
                      <div style={{ fontSize: 10, color: C.mute, fontWeight: 500, marginTop: 2 }}>{label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {usage.perfilDetalle.map((p, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 11px", background: C.surface, borderRadius: 8 }}>
                      <span style={{ width: 9, height: 9, borderRadius: "50%", background: p.color, flexShrink: 0, display: "inline-block" }} />
                      <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{p.nombre}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: p.estado === "incorrecto" ? C.redBg : C.amberBg, color: p.estado === "incorrecto" ? C.red : C.amber }}>
                        {p.estado === "incorrecto" ? "fallo" : "casi"}
                      </span>
                      <span style={{ fontSize: 11, color: C.mute, whiteSpace: "nowrap" }}>{p.pendientes} pend.</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Output */}
          <div>
            <div style={sectionTitle}>Generar output</div>
            <div style={{ display: "flex", gap: 8, marginBottom: outputVisible ? 12 : 0 }}>
              <button
                onClick={() => setOutputVisible(outputVisible === "tsv" ? null : "tsv")}
                style={{ fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 7, border: `1px solid ${outputVisible === "tsv" ? C.orange : C.line}`, background: outputVisible === "tsv" ? C.orangeBg : C.surface, color: outputVisible === "tsv" ? C.orange : C.ink2, cursor: "pointer", fontFamily: "inherit" }}
              >
                Fila TSV (Excel)
              </button>
              <button
                onClick={() => setOutputVisible(outputVisible === "sql" ? null : "sql")}
                style={{ fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 7, border: `1px solid ${outputVisible === "sql" ? C.orange : C.line}`, background: outputVisible === "sql" ? C.orangeBg : C.surface, color: outputVisible === "sql" ? C.orange : C.ink2, cursor: "pointer", fontFamily: "inherit" }}
              >
                UPDATE SQL
              </button>
            </div>

            {outputVisible && (
              <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>
                <div style={{ padding: "7px 12px", background: C.orangeBg, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.orange }}>
                    {outputVisible === "tsv" ? "Fila TSV" : "UPDATE SQL"}
                  </span>
                  <button
                    onClick={() => copiar(outputVisible === "tsv" ? tsvRow : sqlRow)}
                    style={{ background: C.orange, color: "#fff", border: "none", padding: "3px 10px", borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    {copiado ? "✓ Copiado" : "Copiar"}
                  </button>
                </div>
                <pre style={{ padding: "11px 13px", fontFamily: "monospace", fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-all", lineHeight: 1.6, margin: 0 }}>
                  {outputVisible === "tsv" ? tsvRow : sqlRow}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ExplorarFrases({ frases, usagePorFrase }: { frases: FraseContenido[]; usagePorFrase: Record<string, UsageStats> }) {
  const [busqueda, setBusqueda] = useState("");
  const [filtroBloque, setFiltroBloque] = useState("todos");
  const [filtroTema, setFiltroTema] = useState("todos");
  const [filtroFlags, setFiltroFlags] = useState("todos");
  const [filtroUso, setFiltroUso] = useState("todos");
  const [seleccionada, setSeleccionada] = useState<FraseContenido | null>(null);

  const flagsMap = useMemo(() => buildFlagsMap(frases), [frases]);

  const temasDisponibles = useMemo(() => {
    const set = new Set(frases.map((f) => f.temas_gramaticales[0]).filter(Boolean));
    return Array.from(set).sort();
  }, [frases]);

  const frasesFiltradas = useMemo(() => {
    let resultado = frases;

    if (filtroBloque !== "todos") {
      resultado = resultado.filter((f) => f.bloque === filtroBloque);
    }
    if (filtroTema !== "todos") {
      resultado = resultado.filter((f) => f.temas_gramaticales[0] === filtroTema);
    }
    if (filtroFlags === "dup") {
      resultado = resultado.filter((f) => flagsMap.get(f.id)?.dup);
    } else if (filtroFlags === "id") {
      resultado = resultado.filter((f) => flagsMap.get(f.id)?.idIrregular);
    } else if (filtroFlags === "ok") {
      resultado = resultado.filter((f) => {
        const fl = flagsMap.get(f.id);
        return fl && !fl.dup && !fl.idIrregular;
      });
    }
    if (filtroUso === "enRepaso") {
      resultado = resultado.filter((f) => (usagePorFrase[f.id]?.enRepaso ?? 0) > 0);
    } else if (filtroUso === "fallo") {
      resultado = resultado.filter((f) => (usagePorFrase[f.id]?.fallo ?? 0) > 0);
    } else if (filtroUso === "sinDatos") {
      resultado = resultado.filter((f) => !usagePorFrase[f.id]);
    }
    // filtroUso ya aplicado arriba
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      resultado = resultado.filter(
        (f) =>
          f.es.toLowerCase().includes(q) ||
          f.en.toLowerCase().includes(q) ||
          f.id.toLowerCase().includes(q)
      );
    }

    return resultado;
  }, [frases, filtroBloque, filtroTema, filtroFlags, filtroUso, busqueda, flagsMap, usagePorFrase]);

  const selectStyle: React.CSSProperties = {
    fontSize: 13, padding: "8px 11px",
    border: `1px solid ${C.line}`, borderRadius: 8,
    background: C.surface, color: C.ink, fontFamily: "inherit", cursor: "pointer",
  };

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Buscar por español, inglés o ID…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{
            flex: 1, minWidth: 200, maxWidth: 320, fontSize: 13,
            padding: "8px 12px", border: `1px solid ${C.line}`, borderRadius: 8,
            background: C.surface, color: C.ink, fontFamily: "inherit",
            outline: "none",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = C.orange; e.currentTarget.style.background = "#fff"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.background = C.surface; }}
        />

        <select value={filtroBloque} onChange={(e) => setFiltroBloque(e.target.value)} style={selectStyle}>
          <option value="todos">Todos los bloques</option>
          {BLOQUES_ORDEN.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>

        <select value={filtroTema} onChange={(e) => setFiltroTema(e.target.value)} style={selectStyle}>
          <option value="todos">Todos los temas</option>
          {temasDisponibles.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <select value={filtroFlags} onChange={(e) => setFiltroFlags(e.target.value)} style={selectStyle}>
          <option value="todos">Todos</option>
          <option value="dup">Solo duplicadas</option>
          <option value="id">IDs irregulares</option>
          <option value="ok">Sin flags</option>
        </select>

        <select value={filtroUso} onChange={(e) => setFiltroUso(e.target.value)} style={selectStyle}>
          <option value="todos">Todo uso</option>
          <option value="enRepaso">En repaso activo</option>
          <option value="fallo">Con estado fallo</option>
          <option value="sinDatos">Sin datos de repaso</option>
        </select>

        <span style={{ marginLeft: "auto", fontSize: 12, color: C.mute, background: C.surface, padding: "4px 10px", borderRadius: 20, fontWeight: 600, whiteSpace: "nowrap" }}>
          {frasesFiltradas.length.toLocaleString("es-ES")} frases
          {frasesFiltradas.length !== frases.length && ` de ${frases.length.toLocaleString("es-ES")}`}
        </span>
      </div>

      {/* Tabla */}
      <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.04)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto", maxHeight: "calc(100vh - 300px)", overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
              <tr>
                {["ID", "Español", "Inglés", "Tema protagonista", "Uso", "Flags"].map((h) => (
                  <th key={h} style={{ textAlign: "left", fontSize: 11, fontWeight: 700, color: C.mute, padding: "9px 13px", background: C.surface, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `1px solid ${C.line}`, whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {frasesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 40, color: C.mute, fontSize: 14 }}>
                    Sin resultados para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                frasesFiltradas.map((f) => {
                  const flags = flagsMap.get(f.id)!;
                  const seleccionado = seleccionada?.id === f.id;
                  const td: React.CSSProperties = {
                    padding: "10px 13px", fontSize: 13,
                    borderBottom: `1px solid ${C.surface}`,
                    verticalAlign: "middle",
                    background: seleccionado ? C.orangeBg : undefined,
                  };
                  return (
                    <tr
                      key={f.id}
                      onClick={() => setSeleccionada(seleccionado ? null : f)}
                      style={{ cursor: "pointer" }}
                      onMouseEnter={(e) => { if (!seleccionado) (e.currentTarget as HTMLTableRowElement).style.background = "#FFFDFB"; }}
                      onMouseLeave={(e) => { if (!seleccionado) (e.currentTarget as HTMLTableRowElement).style.background = ""; }}
                    >
                      <td style={{ ...td, fontFamily: "monospace", fontSize: 11, color: C.mute, whiteSpace: "nowrap" }}>{f.id}</td>
                      <td style={{ ...td, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.es}</td>
                      <td style={{ ...td, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: C.ink2, fontStyle: "italic" }}>{f.en}</td>
                      <td style={td}>
                        {f.temas_gramaticales[0]
                          ? <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 5, background: C.orangeBg, color: C.orange }}>{f.temas_gramaticales[0]}</span>
                          : <span style={{ color: C.mute2 }}>—</span>}
                      </td>
                      <td style={td}><UsageMiniBar usage={usagePorFrase[f.id]} /></td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: 4 }}>
                          {flags.dup && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: C.redBg, color: C.red }}>DUP</span>}
                          {flags.idIrregular && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: C.amberBg, color: C.amber }}>ID</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer */}
      {seleccionada && (
        <DrawerFrase
          frase={seleccionada}
          flags={flagsMap.get(seleccionada.id)!}
          usage={usagePorFrase[seleccionada.id]}
          onCerrar={() => setSeleccionada(null)}
        />
      )}
    </div>
  );
}
