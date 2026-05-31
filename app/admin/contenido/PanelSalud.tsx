"use client";

import { useMemo } from "react";
import type { FraseContenido, UsageStats } from "../types";

// ── Paleta (misma que AdminPanel) ─────────────────────────────────────────────
const C = {
  orange: "#FF7A45", orangeBg: "#FFF1EB",
  ink: "#1A1A1A", ink2: "#3D3D3D",
  mute: "#6B6B6B", mute2: "#9A9A9A",
  line: "#E8E2D9", surface: "#F7F3EC", bg: "#FCFAF6",
  green: "#1A9C6B", greenBg: "#E6F6EF",
  amber: "#C77A11", amberBg: "#FBF0DC",
  red: "#D14343", redBg: "#FBE9E9",
  blue: "#2563EB", blueBg: "#EFF6FF",
};

const ID_RE = /^(BASIC[12]|INT[1-4]|ADV[12])-L\d{2}-\d{2}-V\d+$/;

const BLOQUES_ORDEN = ["BASIC1", "BASIC2", "INT1", "INT2", "INT3", "INT4", "ADV1", "ADV2"];

// ── Subcomponentes ────────────────────────────────────────────────────────────

function KpiCard({
  num, label, color, sub,
}: {
  num: number | string; label: string; color?: string; sub?: string;
}) {
  return (
    <div style={{
      background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14,
      padding: "16px 18px",
      boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.04)",
    }}>
      <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, color: color ?? C.ink }}>{num}</div>
      <div style={{ fontSize: 11, color: C.mute, marginTop: 4, fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: C.mute2, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Card({ title, dot, children }: { title: string; dot?: "red" | "amber" | "green"; children: React.ReactNode }) {
  const dotColor = dot === "red" ? C.red : dot === "amber" ? C.amber : C.green;
  return (
    <div style={{
      background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14,
      padding: "18px 20px",
      boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.04)",
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 7 }}>
        {dot && <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, display: "inline-block", flexShrink: 0 }} />}
        {title}
      </div>
      {children}
    </div>
  );
}

function BarRow({ name, count, max, color }: { name: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0", fontSize: 13 }}>
      <span style={{ width: 56, flexShrink: 0, fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: C.ink2 }}>{name}</span>
      <div style={{ flex: 1, height: 8, background: C.surface, borderRadius: 6, overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 6, width: `${pct}%`, background: color }} />
      </div>
      <span style={{ width: 36, textAlign: "right", fontWeight: 700, color: C.mute, fontSize: 12 }}>{count}</span>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function PanelSalud({ frases, usagePorFrase }: { frases: FraseContenido[]; usagePorFrase: Record<string, UsageStats> }) {

  const stats = useMemo(() => {
    // Conteos básicos
    const bloqueSet = new Set(frases.map((f) => f.bloque));
    const leccionSet = new Set(frases.map((f) => f.leccion));

    // Temas protagonistas (primer tema de cada frase)
    const temaSet = new Set(frases.map((f) => f.temas_gramaticales[0]).filter(Boolean));

    // Duplicados: mismo español + inglés
    const vistos = new Map<string, FraseContenido[]>();
    for (const f of frases) {
      const clave = f.es.trim() + "|||" + f.en.trim();
      if (!vistos.has(clave)) vistos.set(clave, []);
      vistos.get(clave)!.push(f);
    }
    const duplicados = Array.from(vistos.values()).filter((grupo) => grupo.length > 1);

    // IDs irregulares
    const idsIrregulares = frases.filter((f) => !ID_RE.test(f.id));

    // Frases por bloque (en orden)
    const porBloque: Record<string, number> = {};
    for (const f of frases) {
      porBloque[f.bloque] = (porBloque[f.bloque] ?? 0) + 1;
    }

    // Temas: top 10 por frecuencia
    const temaCounts = new Map<string, number>();
    for (const f of frases) {
      for (const t of f.temas_gramaticales) {
        temaCounts.set(t, (temaCounts.get(t) ?? 0) + 1);
      }
    }
    const temasTop = Array.from(temaCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return { bloqueSet, leccionSet, temaSet, duplicados, idsIrregulares, porBloque, temasTop };
  }, [frases]);

  const maxPorBloque = Math.max(...BLOQUES_ORDEN.map((b) => stats.porBloque[b] ?? 0));
  const maxTema = stats.temasTop[0]?.[1] ?? 1;

  // Frases con más perfiles en repaso activo, ordenadas por fallo desc
  const frasesIdxMap = useMemo(() => {
    const m = new Map<string, FraseContenido>();
    for (const f of frases) m.set(f.id, f);
    return m;
  }, [frases]);

  const frasesEnRepaso = useMemo(() => {
    return Object.entries(usagePorFrase)
      .filter(([, u]) => u.enRepaso > 0)
      .sort(([, a], [, b]) => (b.fallo + b.casi) - (a.fallo + a.casi))
      .slice(0, 10);
  }, [usagePorFrase]);

  const totalFrasesConDatos = Object.keys(usagePorFrase).length;

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 24 }}>
        <KpiCard num={frases.length} label="Frases totales" color={C.orange} />
        <KpiCard num={stats.bloqueSet.size} label="Bloques" />
        <KpiCard num={stats.leccionSet.size} label="Lecciones" />
        <KpiCard num={stats.temaSet.size} label="Temas distintos" />
        <KpiCard
          num={stats.duplicados.length}
          label="Grupos duplicados"
          color={stats.duplicados.length > 0 ? C.red : C.green}
        />
        <KpiCard
          num={stats.idsIrregulares.length}
          label="IDs irregulares"
          color={stats.idsIrregulares.length > 0 ? C.amber : C.green}
        />
      </div>

      {/* Problemas detectados */}
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, letterSpacing: "-0.01em" }}>Problemas detectados</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>

        <Card title="Frases duplicadas" dot={stats.duplicados.length > 0 ? "red" : "green"}>
          {stats.duplicados.length === 0 ? (
            <p style={{ fontSize: 13, color: C.green }}>✓ Sin duplicados detectados.</p>
          ) : (
            <>
              <p style={{ fontSize: 12, color: C.mute, marginBottom: 10 }}>
                Mismo español + inglés en más de un ID. Se resuelven en el Excel.
              </p>
              <div>
                {stats.duplicados.slice(0, 8).map((grupo, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "7px 0", borderTop: i > 0 ? `1px solid ${C.surface}` : "none", fontSize: 13 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: C.redBg, color: C.red, whiteSpace: "nowrap", flexShrink: 0 }}>
                      {grupo.length}×
                    </span>
                    <div>
                      <div style={{ color: C.ink2 }}>{grupo[0].es}</div>
                      <div style={{ fontFamily: "monospace", fontSize: 11, color: C.mute, marginTop: 2 }}>
                        {grupo.map((f) => f.id).join(" · ")}
                      </div>
                    </div>
                  </div>
                ))}
                {stats.duplicados.length > 8 && (
                  <div style={{ fontSize: 12, color: C.mute, paddingTop: 8 }}>
                    …y {stats.duplicados.length - 8} grupos más.
                  </div>
                )}
              </div>
            </>
          )}
        </Card>

        <Card title="IDs con formato irregular" dot={stats.idsIrregulares.length > 0 ? "amber" : "green"}>
          {stats.idsIrregulares.length === 0 ? (
            <p style={{ fontSize: 13, color: C.green }}>✓ Todos los IDs tienen formato correcto.</p>
          ) : (
            <>
              <p style={{ fontSize: 12, color: C.mute, marginBottom: 10 }}>
                No cumplen <code style={{ fontFamily: "monospace", fontSize: 11 }}>BLOQUE-Lnn-nn-Vn</code>. Se corrigen en el Excel.
              </p>
              <div>
                {stats.idsIrregulares.slice(0, 10).map((f, i) => (
                  <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 0", borderTop: i > 0 ? `1px solid ${C.surface}` : "none", fontSize: 13 }}>
                    <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: C.amberBg, color: C.amber }}>
                      {f.id}
                    </span>
                    <span style={{ color: C.ink2, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.es}</span>
                  </div>
                ))}
                {stats.idsIrregulares.length > 10 && (
                  <div style={{ fontSize: 12, color: C.mute, paddingTop: 8 }}>…y {stats.idsIrregulares.length - 10} más.</div>
                )}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Cobertura por bloque */}
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, letterSpacing: "-0.01em" }}>Distribución por bloque</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
        <Card title="Frases por bloque">
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {BLOQUES_ORDEN.map((b) => (
              <BarRow key={b} name={b} count={stats.porBloque[b] ?? 0} max={maxPorBloque} color={C.orange} />
            ))}
          </div>
        </Card>

        <Card title="Distribución por registro">
          <div style={{ padding: "16px 0", textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>—</div>
            <p style={{ fontSize: 13, color: C.mute, lineHeight: 1.5 }}>
              Campo <code style={{ fontFamily: "monospace", fontSize: 12 }}>registro</code> no disponible en esta versión del catálogo.
              Se mostrará con el Excel v10 completo.
            </p>
          </div>
        </Card>
      </div>

      {/* Top temas */}
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, letterSpacing: "-0.01em" }}>Temas gramaticales más frecuentes</div>
      <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px", boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.04)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {stats.temasTop.map(([tema, count]) => (
            <div key={tema} style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0", fontSize: 13 }}>
              <span style={{ flex: 1, color: C.ink2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tema}</span>
              <div style={{ width: 160, height: 8, background: C.surface, borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
                <div style={{ height: "100%", borderRadius: 6, width: `${Math.round((count / maxTema) * 100)}%`, background: C.green }} />
              </div>
              <span style={{ width: 36, textAlign: "right", fontWeight: 700, color: C.mute, fontSize: 12, flexShrink: 0 }}>{count}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: C.mute2 }}>
          Total de temas distintos en el catálogo: <strong style={{ color: C.ink2 }}>{stats.temaSet.size}</strong>. Mostrando los 10 más frecuentes por aparición en cualquier posición (t1/t2/t3).
        </div>
      </div>

      {/* Analytics de uso */}
      <div style={{ fontSize: 15, fontWeight: 700, margin: "24px 0 12px", letterSpacing: "-0.01em" }}>Analytics de uso</div>

      {/* KPI de uso */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 18 }}>
        <KpiCard num={totalFrasesConDatos} label="Frases con datos de repaso" color={totalFrasesConDatos > 0 ? C.orange : C.mute} />
        <KpiCard
          num={Object.values(usagePorFrase).reduce((s, u) => s + u.fallo, 0)}
          label="Entradas en estado fallo"
          color={C.red}
        />
        <KpiCard
          num={Object.values(usagePorFrase).reduce((s, u) => s + u.casi, 0)}
          label="Entradas en estado casi"
          color={C.amber}
        />
      </div>

      {frasesEnRepaso.length === 0 ? (
        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: "24px 20px", textAlign: "center", color: C.mute, fontSize: 14 }}>
          Sin datos de repaso todavía. Aparecerán aquí cuando los perfiles empiecen a usar la app.
        </div>
      ) : (
        <Card title="Frases con más perfiles en repaso activo">
          <p style={{ fontSize: 12, color: C.mute, marginBottom: 12 }}>
            Solo frases en repaso activo (las dominadas se eliminan del registro). Ordenadas por mayor carga de fallo + casi.
          </p>
          <div>
            {frasesEnRepaso.map(([fraseId, u], i) => {
              const frase = frasesIdxMap.get(fraseId);
              return (
                <div key={fraseId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: i > 0 ? `1px solid ${C.surface}` : "none" }}>
                  <span style={{ fontFamily: "monospace", fontSize: 10, color: C.mute2, width: 160, flexShrink: 0 }}>{fraseId}</span>
                  <span style={{ flex: 1, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: C.ink2 }}>
                    {frase?.es ?? "—"}
                  </span>
                  <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                    {u.fallo > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: C.redBg, color: C.red }}>{u.fallo} fallo</span>}
                    {u.casi > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: C.amberBg, color: C.amber }}>{u.casi} casi</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
