"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { UsuarioResumen, PerfilResumen, DetalleUsuario, PerfilDetalle, ConsumoGlobal, SesionHistorial, FraseContenido, UsageStats } from "./types";
import PanelSalud from "./contenido/PanelSalud";
import ExplorarFrases from "./contenido/ExplorarFrases";
import MapaMaestro from "./contenido/MapaMaestro";
import AnadirFrase from "./contenido/AnadirFrase";
import {
  obtenerDetalleUsuario,
  borrarSesionEnCurso,
  borrarUltimaVez,
  corregirRacha,
  retrocederBloque,
  resetearBloqueActivo,
  avanzarBloque,
  setTutorActivo,
  setBloqueado,
  eliminarCuenta,
} from "./actions";

// ── Paleta ────────────────────────────────────────────────────────────────────
const C = {
  orange: "#FF7A45", orangeBg: "#FFF1EB",
  ink: "#1A1A1A", ink2: "#3D3D3D",
  mute: "#6B6B6B", mute2: "#9A9A9A",
  line: "#E8E2D9", surface: "#F7F3EC", bg: "#FCFAF6",
  green: "#1A9C6B", greenBg: "#E6F6EF",
  amber: "#C77A11", amberBg: "#FBF0DC",
  red: "#D14343", redBg: "#FBE9E9",
};

// ── Tipos internos ────────────────────────────────────────────────────────────

type ModalConfig = {
  titulo: string;
  cuerpo: React.ReactNode;
  confirmLabel: string;
  esPeligroso: boolean;
  inputInicial?: number;             // si está definido, muestra input numérico
  confirmarTexto?: string;           // si está definido, el botón exige escribir este texto exacto
  refreshTrasConfirmar?: boolean;    // si true, hace router.refresh() en vez de recargar el detalle
  onConfirm: (inputVal?: number) => Promise<void>;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatUltimaSesion(isoString: string | null): string {
  if (!isoString) return "Nunca";
  const diff = Date.now() - new Date(isoString).getTime();
  const min = Math.floor(diff / 1000 / 60);
  const h = Math.floor(min / 60);
  const dias = Math.floor(h / 24);
  if (min < 60) return "Hace < 1h";
  if (h < 24) return `Hace ${h}h`;
  if (dias === 1) return "Hace 1 día";
  return `Hace ${dias} días`;
}

function formatFechaCorta(isoDate: string | null): string {
  if (!isoDate) return "—";
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-ES", {
    day: "numeric", month: "short",
  });
}

function tieneSesionAtascada(perfiles: PerfilResumen[]): boolean {
  return perfiles.some((p) => {
    if (!p.sesionEnCurso || !p.sesionInicio) return false;
    return (Date.now() - new Date(p.sesionInicio).getTime()) / 3600000 > 2;
  });
}
function tieneSesionEnCurso(perfiles: PerfilResumen[]): boolean {
  return perfiles.some((p) => p.sesionEnCurso);
}

function obtenerEstado(u: UsuarioResumen): { color: string; label: string } {
  if (tieneSesionAtascada(u.perfiles)) return { color: C.amber, label: "⚠️ Sesión atascada" };
  if (tieneSesionEnCurso(u.perfiles)) return { color: C.green, label: "● Sesión en curso" };
  const d = u.diasDesdeUltima;
  if (d === 0) return { color: C.green, label: "Activo hoy" };
  if (d <= 3) return { color: C.amber, label: "Reciente" };
  if (d <= 7) return { color: C.amber, label: `${d}d inactivo` };
  return { color: C.red, label: `${d}d inactivo` };
}

function getBloqueColor(pct: number, estado: string) {
  if (estado === "locked") return C.line;
  if (pct >= 100) return C.green;
  if (pct >= 50) return C.orange;
  if (pct > 0) return C.amber;
  return C.line;
}
function getTopicColor(pct: number) {
  if (pct >= 80) return C.green;
  if (pct >= 50) return C.orange;
  return C.amber;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ config, onCerrar }: { config: ModalConfig; onCerrar: () => void }) {
  const [inputVal, setInputVal] = useState(config.inputInicial ?? 0);
  const [textoConfirm, setTextoConfirm] = useState("");
  const [ejecutando, setEjecutando] = useState(false);

  const confirmDeshabilitado = ejecutando ||
    (config.confirmarTexto !== undefined && textoConfirm !== config.confirmarTexto);

  async function handleConfirm() {
    if (confirmDeshabilitado) return;
    setEjecutando(true);
    try {
      await config.onConfirm(config.inputInicial !== undefined ? inputVal : undefined);
      onCerrar();
    } catch {
      onCerrar();
    } finally {
      setEjecutando(false);
    }
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.35)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 200, backdropFilter: "blur(3px)",
      }}
    >
      <div style={{
        background: "#fff", borderRadius: 14, padding: 28,
        maxWidth: 440, width: "90%",
        boxShadow: "0 4px 12px rgba(0,0,0,.08), 0 16px 40px rgba(0,0,0,.06)",
        animation: "modalIn .2s ease-out",
      }}>
        <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8 }}>
          {config.titulo}
        </div>
        <div style={{ fontSize: 14, color: C.mute, lineHeight: 1.6, marginBottom: 4 }}>
          {config.cuerpo}
        </div>

        {config.inputInicial !== undefined && (
          <div style={{ marginTop: 14, marginBottom: 8 }}>
            <input
              type="number" min={0} max={365}
              value={inputVal}
              onChange={(e) => setInputVal(Math.max(0, parseInt(e.target.value) || 0))}
              style={{
                width: 100, fontSize: 18, fontWeight: 700, padding: "8px 12px",
                border: `2px solid ${C.orange}`, borderRadius: 8,
                textAlign: "center", fontFamily: "inherit", color: C.ink, outline: "none",
              }}
            />
            <span style={{ fontSize: 14, color: C.mute, marginLeft: 8 }}>días</span>
          </div>
        )}

        {config.confirmarTexto !== undefined && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, color: C.mute, marginBottom: 6 }}>
              Escribe el email de la cuenta para confirmar:
            </div>
            <input
              type="email"
              placeholder={config.confirmarTexto}
              value={textoConfirm}
              onChange={(e) => setTextoConfirm(e.target.value)}
              style={{
                width: "100%", fontSize: 13, padding: "9px 12px",
                border: `1.5px solid ${textoConfirm === config.confirmarTexto ? C.red : C.line}`,
                borderRadius: 8, fontFamily: "inherit", color: C.ink, outline: "none",
              }}
            />
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
          <button
            onClick={onCerrar} disabled={ejecutando}
            style={{
              padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit", border: "none",
              background: C.surface, color: C.ink,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm} disabled={confirmDeshabilitado}
            style={{
              padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 700,
              cursor: confirmDeshabilitado ? "default" : "pointer",
              fontFamily: "inherit", border: "none",
              background: config.esPeligroso ? C.red : C.orange,
              color: "#fff", opacity: confirmDeshabilitado ? 0.4 : 1,
              transition: "opacity .15s",
            }}
          >
            {ejecutando ? "Aplicando…" : config.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ msg, tipo }: { msg: string; tipo: "ok" | "warn" }) {
  return (
    <div style={{
      position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
      background: tipo === "ok" ? C.green : C.amber,
      color: "#fff", padding: "12px 20px", borderRadius: 8,
      fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
      boxShadow: "0 4px 12px rgba(0,0,0,.15)", zIndex: 300,
    }}>
      {msg}
    </div>
  );
}

// ── KPI ───────────────────────────────────────────────────────────────────────

function KpiCard({ num, label, color, sub }: { num: number | string; label: string; color?: string; sub?: string }) {
  return (
    <div style={{
      background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14,
      padding: "18px 20px",
      boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.04)",
    }}>
      <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, color: color ?? C.ink }}>{num}</div>
      <div style={{ fontSize: 12, color: C.mute, marginTop: 4, fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: C.mute2, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ── Fila de usuario ───────────────────────────────────────────────────────────

function FilaUsuario({
  usuario, seleccionado, onVer,
}: {
  usuario: UsuarioResumen; seleccionado: boolean; onVer: () => void;
}) {
  const [hover, setHover] = useState(false);
  const perfilActivo = usuario.perfiles.find((p) => p.id === usuario.perfilActivoId) ?? usuario.perfiles[0];
  const estado = obtenerEstado(usuario);
  const bg = seleccionado ? C.orangeBg : hover ? "#FFFDFB" : "transparent";

  const td: React.CSSProperties = {
    padding: "14px 16px", fontSize: 13,
    borderBottom: `1px solid ${C.surface}`,
    verticalAlign: "middle", background: bg, transition: "background .1s",
  };

  return (
    <tr onClick={onVer} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ cursor: "pointer" }}>
      <td style={td}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: perfilActivo?.color ?? C.mute2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
            {usuario.email[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>{usuario.nombreDisplay}</div>
            <div style={{ fontSize: 11, color: C.mute }}>{usuario.email}</div>
          </div>
        </div>
      </td>
      <td style={td}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {usuario.perfiles.map((p) => (
            <span key={p.id} title={p.nombre} style={{ width: 22, height: 22, borderRadius: "50%", background: p.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#fff", marginRight: -4, border: "2px solid #fff" }}>{p.nombre[0]}</span>
          ))}
          {usuario.perfiles.length > 0 && <span style={{ marginLeft: 10, fontSize: 12, color: C.mute }}>{usuario.perfiles.length}</span>}
          {!usuario.tieneEstado && <span style={{ fontSize: 12, color: C.mute2 }}>Sin datos</span>}
        </div>
      </td>
      <td style={td}>
        {perfilActivo
          ? <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: C.surface, color: C.ink2, fontFamily: "monospace" }}>{perfilActivo.bloqueActivo}</span>
          : <span style={{ color: C.mute2 }}>—</span>}
      </td>
      <td style={td}>
        {perfilActivo ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 80, height: 6, background: C.surface, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 4, width: `${perfilActivo.progresoBloque}%`, background: perfilActivo.progresoBloque >= 100 ? C.green : C.orange }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.mute }}>{perfilActivo.progresoBloque}%</span>
          </div>
        ) : <span style={{ color: C.mute2 }}>—</span>}
      </td>
      <td style={td}>
        <span style={{ fontWeight: 700, fontSize: 13 }}>{usuario.sesionesTotal > 0 ? usuario.sesionesTotal : <span style={{ color: C.mute2 }}>—</span>}</span>
      </td>
      <td style={td}>
        {perfilActivo ? <span style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 700 }}>🔥 {perfilActivo.racha}</span> : <span style={{ color: C.mute2 }}>—</span>}
      </td>
      <td style={td}><span style={{ fontSize: 12, color: C.mute2 }}>{formatUltimaSesion(usuario.ultimaActualizacion)}</span></td>
      <td style={td}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: estado.color, display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontSize: 12 }}>{estado.label}</span>
          </span>
          {usuario.evaluacionesHoy > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: C.amberBg, color: C.amber, width: "fit-content" }}>
              IA: {usuario.evaluacionesHoy} eval.
            </span>
          )}
          {usuario.bloqueado && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: C.redBg, color: C.red, width: "fit-content" }}>
              Bloqueado
            </span>
          )}
        </div>
      </td>
      <td style={td}>
        <button onClick={(e) => { e.stopPropagation(); onVer(); }} style={{ fontSize: 12, fontWeight: 600, padding: "5px 11px", borderRadius: 6, border: `1px solid ${seleccionado ? C.ink2 : C.orange}`, background: seleccionado ? C.surface : C.orange, color: seleccionado ? C.ink : "#fff", cursor: "pointer", fontFamily: "inherit" }}>
          {seleccionado ? "Cerrar" : "Ver →"}
        </button>
      </td>
    </tr>
  );
}

// ── Sección de acciones ───────────────────────────────────────────────────────

function SeccionAcciones({
  perfil, userId, onAction,
}: {
  perfil: PerfilDetalle;
  userId: string;
  onAction: (config: ModalConfig) => void;
}) {
  const haySesion = !!perfil.sesion;
  const fechaCorta = formatFechaCorta(perfil.ultimaVezFecha);

  const subsectionTitle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: C.mute,
    textTransform: "uppercase", letterSpacing: "0.04em",
    marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${C.surface}`,
  };

  function cardAccion(
    icono: string,
    titulo: string,
    desc: React.ReactNode,
    disabled: boolean,
    peligroso: boolean,
    onClick: () => void
  ) {
    return (
      <div
        onClick={disabled ? undefined : onClick}
        style={{
          border: `1px solid ${peligroso ? C.redBg : C.line}`,
          borderRadius: 8, padding: "14px 16px",
          cursor: disabled ? "default" : "pointer",
          background: "#fff", transition: "all .15s",
          opacity: disabled ? 0.45 : 1,
          pointerEvents: disabled ? "none" : "auto",
        }}
        onMouseEnter={(e) => {
          if (!disabled) (e.currentTarget as HTMLDivElement).style.borderColor = peligroso ? C.red : C.orange;
          if (!disabled) (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 0 3px ${peligroso ? C.redBg : C.orangeBg}`;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = peligroso ? C.redBg : C.line;
          (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
        }}
      >
        <div style={{ fontSize: 20, marginBottom: 8 }}>{icono}</div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3, color: peligroso ? C.red : C.ink }}>{titulo}</div>
        <div style={{ fontSize: 12, color: C.mute, lineHeight: 1.4 }}>{desc}</div>
      </div>
    );
  }

  return (
    <div style={{ borderTop: `1px solid ${C.line}`, padding: "20px 24px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.mute, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 16 }}>
        Intervenciones disponibles
      </div>

      {/* Sección sesión */}
      <div style={subsectionTitle}>🗓 Acciones de sesión</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 24 }}>

        {cardAccion(
          "🧹", "Borrar sesión en curso",
          haySesion
            ? <span>Limpia <code>sesion_en_curso</code>. La alumna empieza nueva sesión limpia.</span>
            : "No hay sesión activa ahora mismo.",
          !haySesion, false,
          () => onAction({
            titulo: "Borrar sesión en curso",
            cuerpo: <span>Limpiar <code>sesion_en_curso</code> de <strong>{perfil.nombre}</strong>. La próxima vez que abra la app empezará sesión nueva desde cero.</span>,
            confirmLabel: "Borrar sesión",
            esPeligroso: false,
            onConfirm: async () => {
              const r = await borrarSesionEnCurso(userId, perfil.id);
              if (!r.ok) throw new Error(r.error);
            },
          })
        )}

        {cardAccion(
          "⏮", "Borrar última vez",
          perfil.ultimaVezFecha
            ? <span>Elimina las <strong>{perfil.ultimaVezEntradas} entradas</strong> de <strong>{fechaCorta}</strong> de <code>progreso_frases</code>.</span>
            : "No hay entradas de progreso todavía.",
          !perfil.ultimaVezFecha, true,
          () => onAction({
            titulo: "Borrar última vez",
            cuerpo: (
              <span>
                Se eliminarán <strong>{perfil.ultimaVezEntradas} entradas de <code>progreso_frases</code> del {fechaCorta}</strong> para el perfil <strong>{perfil.nombre}</strong>.<br /><br />
                Si ese día hizo varias sesiones, todas se borrarán. El avance previo a ese día queda intacto.
              </span>
            ),
            confirmLabel: "Borrar entradas",
            esPeligroso: true,
            onConfirm: async () => {
              const r = await borrarUltimaVez(userId, perfil.id);
              if (!r.ok) throw new Error(r.error);
            },
          })
        )}

        {cardAccion(
          "🔥", "Corregir racha",
          <span>Racha actual: <strong>{perfil.racha} días</strong>. Introduce el valor correcto.</span>,
          false, false,
          () => onAction({
            titulo: "Corregir racha",
            cuerpo: <span>Introduce la racha correcta para <strong>{perfil.nombre}</strong> (racha actual: <strong>{perfil.racha} días</strong>).</span>,
            confirmLabel: "Guardar racha",
            esPeligroso: false,
            inputInicial: perfil.racha,
            onConfirm: async (val) => {
              const r = await corregirRacha(userId, perfil.id, val ?? perfil.racha);
              if (!r.ok) throw new Error(r.error);
            },
          })
        )}
      </div>

      {/* Sección bloques */}
      {(() => {
        // Posición del bloque activo en el array ordenado de 8 bloques
        const idx = perfil.bloques.findIndex((b) => b.cod === perfil.bloqueActivo);
        const bloqueAnterior = idx > 0 ? perfil.bloques[idx - 1].cod : null;
        const bloqueSiguiente = idx < perfil.bloques.length - 1 ? perfil.bloques[idx + 1].cod : null;
        const totalBorrar = perfil.punteroBloque + perfil.enRepasoBloque;

        return (
          <>
            <div style={subsectionTitle}>📦 Acciones de bloque</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 8 }}>

              {cardAccion(
                "⬅️", "Retroceder bloque",
                bloqueAnterior
                  ? <span>Bloque activo pasará de <strong>{perfil.bloqueActivo}</strong> a <strong>{bloqueAnterior}</strong>. {perfil.bloqueActivo} se bloqueará de nuevo.</span>
                  : "Ya está en el primer bloque.",
                !bloqueAnterior, true,
                () => onAction({
                  titulo: "Retroceder bloque",
                  cuerpo: (
                    <span>
                      El bloque activo de <strong>{perfil.nombre}</strong> pasará de <strong>{perfil.bloqueActivo}</strong> a <strong>{bloqueAnterior}</strong>.<br /><br />
                      <strong>{perfil.bloqueActivo}</strong> quedará bloqueado de nuevo. El progreso dentro de ese bloque (frases en repaso, puntero) se conserva.
                    </span>
                  ),
                  confirmLabel: `Retroceder a ${bloqueAnterior}`,
                  esPeligroso: true,
                  onConfirm: async () => {
                    const r = await retrocederBloque(userId, perfil.id);
                    if (!r.ok) throw new Error(r.error);
                  },
                })
              )}

              {cardAccion(
                "🔄", "Resetear bloque",
                <span>Borra todo el progreso de <strong>{perfil.bloqueActivo}</strong>: puntero ({perfil.punteroBloque}) y entradas en repaso ({perfil.enRepasoBloque}). Empieza desde 0.</span>,
                false, true,
                () => onAction({
                  titulo: `Resetear ${perfil.bloqueActivo}`,
                  cuerpo: (
                    <span>
                      Se borrará <strong>todo el progreso del bloque {perfil.bloqueActivo}</strong> para <strong>{perfil.nombre}</strong>:<br /><br />
                      · Puntero de frases nuevas → 0<br />
                      · {perfil.enRepasoBloque} entradas en <code>progreso_frases</code> eliminadas<br /><br />
                      Total: <strong>{totalBorrar} frases</strong> reseteadas. <strong>Esta acción es irreversible.</strong>
                    </span>
                  ),
                  confirmLabel: "Resetear bloque",
                  esPeligroso: true,
                  onConfirm: async () => {
                    const r = await resetearBloqueActivo(userId, perfil.id);
                    if (!r.ok) throw new Error(r.error);
                  },
                })
              )}

              {cardAccion(
                "➡️", "Avanzar bloque",
                bloqueSiguiente
                  ? <span>Bloque activo pasará de <strong>{perfil.bloqueActivo}</strong> a <strong>{bloqueSiguiente}</strong>. Se desbloqueará si no lo estaba.</span>
                  : "Ya está en el último bloque.",
                !bloqueSiguiente, false,
                () => onAction({
                  titulo: "Avanzar bloque",
                  cuerpo: (
                    <span>
                      El bloque activo de <strong>{perfil.nombre}</strong> pasará de <strong>{perfil.bloqueActivo}</strong> a <strong>{bloqueSiguiente}</strong>.<br /><br />
                      Si <strong>{bloqueSiguiente}</strong> no estaba desbloqueado, se desbloqueará ahora. La sesión en curso (si la hay) se limpiará.
                    </span>
                  ),
                  confirmLabel: `Avanzar a ${bloqueSiguiente}`,
                  esPeligroso: false,
                  onConfirm: async () => {
                    const r = await avanzarBloque(userId, perfil.id);
                    if (!r.ok) throw new Error(r.error);
                  },
                })
              )}

            </div>
          </>
        );
      })()}
    </div>
  );
}

// ── Panel de detalle ──────────────────────────────────────────────────────────

function PanelDetalle({
  detalle, onCerrar, onAction, userId, tutorActivoInicial, bloqueadoInicial, evaluacionesHoy,
}: {
  detalle: DetalleUsuario;
  onCerrar: () => void;
  onAction: (config: ModalConfig) => void;
  userId: string;
  tutorActivoInicial: boolean;
  bloqueadoInicial: boolean;
  evaluacionesHoy: number;
}) {
  const [perfilIdx, setPerfilIdx] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const perfil: PerfilDetalle = detalle.perfiles[perfilIdx] ?? detalle.perfiles[0];
  // Estado local para las acciones de IA: se actualiza optimistamente sin reload de página.
  const [tutorActivo, setTutorActivoLocal] = useState(tutorActivoInicial);
  const [bloqueado, setBloqueadoLocal] = useState(bloqueadoInicial);

  useEffect(() => { panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [detalle.id]);
  useEffect(() => { setPerfilIdx(0); }, [detalle.id]);

  if (!perfil) return null;

  const card: React.CSSProperties = { background: C.surface, borderRadius: 8, padding: "16px 18px" };
  const cardTitle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: C.mute, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 };
  const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0" };

  return (
    <div ref={panelRef} style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, boxShadow: "0 4px 12px rgba(0,0,0,.08), 0 16px 40px rgba(0,0,0,.06)", overflow: "hidden", marginTop: 16 }}>

      {/* Cabecera */}
      <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: perfil.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
          {detalle.email[0].toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>{detalle.nombreDisplay}</div>
          <div style={{ fontSize: 13, color: C.mute }}>{detalle.email}</div>
        </div>
        <button onClick={onCerrar} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 20, color: C.mute, lineHeight: 1, padding: 4 }}>✕</button>
      </div>

      {/* Barra de control de tutor IA */}
      <div style={{ padding: "14px 24px", borderBottom: `1px solid ${C.surface}`, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.mute, textTransform: "uppercase", letterSpacing: "0.04em", marginRight: 4 }}>Tutor IA</div>

        {/* Eval hoy */}
        <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 20, background: evaluacionesHoy > 0 ? C.amberBg : C.surface, color: evaluacionesHoy > 0 ? C.amber : C.mute }}>
          {evaluacionesHoy} eval. hoy
        </span>

        {/* Toggle tutor activo */}
        <button
          onClick={() => onAction({
            titulo: tutorActivo ? "Desactivar tutor" : "Activar tutor",
            cuerpo: tutorActivo
              ? <span>El botón &ldquo;Con tutor&rdquo; quedará <strong>deshabilitado</strong> para <strong>{detalle.nombreDisplay}</strong>. Podrá seguir usando la app en modo autoevaluación.</span>
              : <span>El tutor virtual quedará <strong>activado</strong> de nuevo para <strong>{detalle.nombreDisplay}</strong>.</span>,
            confirmLabel: tutorActivo ? "Desactivar" : "Activar",
            esPeligroso: false,
            onConfirm: async () => {
              const r = await setTutorActivo(userId, !tutorActivo);
              if (!r.ok) throw new Error(r.error);
              setTutorActivoLocal(!tutorActivo);
            },
          })}
          style={{ fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${tutorActivo ? C.green : C.line}`, background: tutorActivo ? C.greenBg : C.surface, color: tutorActivo ? C.green : C.mute }}
        >
          {tutorActivo ? "✓ Tutor activo" : "✗ Tutor off"}
        </button>

        {/* Toggle bloqueado */}
        <button
          onClick={() => onAction({
            titulo: bloqueado ? "Desbloquear cuenta" : "Bloquear cuenta",
            cuerpo: bloqueado
              ? <span>La cuenta de <strong>{detalle.nombreDisplay}</strong> quedará <strong>desbloqueada</strong>. Podrá usar el tutor con normalidad.</span>
              : <span>La cuenta de <strong>{detalle.nombreDisplay}</strong> quedará <strong>bloqueada</strong>. Cualquier llamada al tutor será rechazada.</span>,
            confirmLabel: bloqueado ? "Desbloquear" : "Bloquear cuenta",
            esPeligroso: !bloqueado,
            onConfirm: async () => {
              const r = await setBloqueado(userId, !bloqueado);
              if (!r.ok) throw new Error(r.error);
              setBloqueadoLocal(!bloqueado);
            },
          })}
          style={{ fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${bloqueado ? C.red : C.line}`, background: bloqueado ? C.redBg : C.surface, color: bloqueado ? C.red : C.mute }}
        >
          {bloqueado ? "⛔ Bloqueado" : "Bloquear"}
        </button>

        <div style={{ width: 1, height: 24, background: C.line, margin: "0 4px" }} />

        {/* Eliminar cuenta */}
        <button
          onClick={() => onAction({
            titulo: "Eliminar cuenta",
            cuerpo: (
              <span>
                <div style={{ background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 8, padding: "12px 14px", marginBottom: 14 }}>
                  <strong style={{ color: C.red }}>⚠️ Acción irreversible.</strong> Se eliminará permanentemente la cuenta de <strong>{detalle.nombreDisplay}</strong> ({detalle.email}) y todo su progreso. No hay vuelta atrás.
                </div>
              </span>
            ),
            confirmLabel: "Eliminar para siempre",
            esPeligroso: true,
            confirmarTexto: detalle.email,
            refreshTrasConfirmar: true,
            onConfirm: async () => {
              const r = await eliminarCuenta(userId);
              if (!r.ok) throw new Error(r.error);
            },
          })}
          style={{ fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${C.red}`, background: C.redBg, color: C.red }}
        >
          Eliminar cuenta
        </button>
      </div>

      {/* Pestañas de perfil */}
      {detalle.perfiles.length > 1 && (
        <div style={{ padding: "16px 24px 0", borderBottom: `1px solid ${C.surface}`, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {detalle.perfiles.map((p, i) => (
            <button key={p.id} onClick={() => setPerfilIdx(i)} style={{ padding: "6px 14px", fontSize: 12, fontWeight: 700, borderRadius: 20, border: `1.5px solid ${i === perfilIdx ? p.color : C.line}`, background: "#fff", cursor: "pointer", fontFamily: "inherit", color: i === perfilIdx ? p.color : C.mute, display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, display: "inline-block" }} />
              {p.nombre}
            </button>
          ))}
        </div>
      )}

      {/* Grid 2×2 */}
      <div style={{ padding: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>

          {/* Stats */}
          <div style={card}>
            <div style={cardTitle}>Resumen del perfil</div>
            {[
              ["Frases aprendidas", `${perfil.frasesAprendidas} / ${perfil.totalFrases}`],
              ["Progreso total", `${perfil.progresoTotal}%`],
              ["Racha actual", `🔥 ${perfil.racha} días`],
              ["Bloque activo", null],
              ["Bloques desbloqueados", `${perfil.bloquesDesbloqueados.length} / 8`],
            ].map(([label, value]) => (
              <div key={label as string} style={row}>
                <span style={{ fontSize: 13, color: C.mute }}>{label}</span>
                {value ? (
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{value}</span>
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "#fff", color: C.ink2, fontFamily: "monospace" }}>{perfil.bloqueActivo}</span>
                )}
              </div>
            ))}
            {/* Test de nivel */}
            <div style={row}>
              <span style={{ fontSize: 13, color: C.mute }}>Test de nivel</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {perfil.testNivelEstado === "completado" ? (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "#D1FAE5", color: "#065F46" }}>✓ hecho</span>
                ) : perfil.testNivelEstado === "omitido" ? (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "#FEF3C7", color: "#92400E" }}>omitido</span>
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: C.surface, color: C.mute }}>pendiente</span>
                )}
                {perfil.testNivelFecha && (
                  <span style={{ fontSize: 12, color: C.mute2 }}>
                    {new Date(perfil.testNivelFecha).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Bloques */}
          <div style={card}>
            <div style={cardTitle}>Progreso por bloque</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {perfil.bloques.map((b) => (
                <div key={b.cod} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 56, fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: C.ink2, flexShrink: 0 }}>{b.cod}</span>
                  <div style={{ flex: 1, height: 8, background: C.line, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 4, width: `${b.pct}%`, background: getBloqueColor(b.pct, b.estado) }} />
                  </div>
                  <span style={{ width: 34, textAlign: "right", fontSize: 12, fontWeight: 700, color: C.mute }}>{b.pct}%</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap", background: b.estado === "active" ? C.orangeBg : b.estado === "done" ? C.greenBg : C.surface, color: b.estado === "active" ? C.orange : b.estado === "done" ? C.green : C.mute2 }}>
                    {b.estado === "active" ? "Activo" : b.estado === "done" ? "✓" : "🔒"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Temas */}
          <div style={card}>
            <div style={cardTitle}>Dominio temático (top 6)</div>
            {perfil.temas.length === 0
              ? <div style={{ fontSize: 13, color: C.mute2 }}>Sin datos todavía</div>
              : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {perfil.temas.map((t) => (
                    <div key={t.nombre} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, flex: 1, color: C.ink2 }}>{t.nombre}</span>
                      <div style={{ width: 80, height: 6, background: C.line, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 3, width: `${t.pct}%`, background: getTopicColor(t.pct) }} />
                      </div>
                      <span style={{ width: 32, textAlign: "right", fontSize: 11, fontWeight: 700, color: C.mute }}>{t.pct}%</span>
                    </div>
                  ))}
                </div>
              )}
          </div>

          {/* Sesión */}
          <div style={card}>
            <div style={cardTitle}>Sesión en curso</div>
            {perfil.sesion ? (() => {
              const diffMin = perfil.sesion.inicio
                ? Math.round((Date.now() - new Date(perfil.sesion.inicio).getTime()) / 60000)
                : null;
              const diffTexto = diffMin !== null
                ? diffMin > 60 ? `${Math.floor(diffMin / 60)}h ${diffMin % 60}min` : `${diffMin} min`
                : "tiempo desconocido";
              const atascada = diffMin !== null && diffMin > 120;
              return (
                <div style={{ background: atascada ? C.amberBg : C.greenBg, borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: atascada ? C.amber : C.green, marginBottom: 6 }}>
                    {atascada ? "⚠️ Posiblemente atascada" : "● En curso"}
                  </div>
                  <div style={{ fontSize: 13 }}><strong>Tipo:</strong> {perfil.sesion.tipo === "refuerzo" ? `Refuerzo · ${perfil.sesion.temaId ?? "—"}` : "Sesión de bloque"}</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}><strong>Frases pendientes:</strong> {perfil.sesion.frasesPendientes}</div>
                  {diffMin !== null && <div style={{ fontSize: 13, marginTop: 4 }}><strong>Iniciada:</strong> hace {diffTexto}</div>}
                </div>
              );
            })() : <div style={{ fontSize: 13, color: C.mute2, padding: "8px 0" }}>Sin sesión activa</div>}
          </div>

        </div>

        {/* Historial de sesiones (Pieza H) */}
        {perfil.historialSesiones.length > 0 && (
          <div style={{ ...card, margin: "0 24px 24px" }}>
            <div style={cardTitle}>Historial de sesiones · trenzado</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 60px 70px", gap: "4px 12px", alignItems: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.mute, textTransform: "uppercase" }}>Fecha</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.mute, textTransform: "uppercase" }}>Bloque</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.mute, textTransform: "uppercase", textAlign: "right" }}>Frases</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.mute, textTransform: "uppercase", textAlign: "right" }}>Saltadas</span>
              {perfil.historialSesiones.slice(0, 10).map((s: SesionHistorial) => {
                const diffMs = Date.now() - new Date(s.creadoEn).getTime();
                const diffH = Math.floor(diffMs / 3600000);
                const diffD = Math.floor(diffMs / 86400000);
                const fechaTexto = diffH < 1 ? "< 1h" : diffH < 24 ? `${diffH}h` : `${diffD}d`;
                return (
                  <>
                    <span key={`f-${s.id}`} style={{ fontSize: 12, color: C.ink2 }}>hace {fechaTexto}</span>
                    <span key={`b-${s.id}`} style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace", color: C.mute }}>{s.bloque}</span>
                    <span key={`t-${s.id}`} style={{ fontSize: 12, textAlign: "right" }}>{s.frasesTotal}</span>
                    <span key={`s-${s.id}`} style={{ fontSize: 12, textAlign: "right", color: s.frasesSaltadas > 0 ? C.amber : C.mute2 }}>{s.frasesSaltadas}</span>
                  </>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* Acciones */}
      <SeccionAcciones perfil={perfil} userId={userId} onAction={onAction} />
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

type Tab = "usuarios" | "contenido" | "gramatica";
type SubTabContenido = "salud" | "explorar" | "mapa" | "anadir";

// ── Panel de Contenido ────────────────────────────────────────────────────────

function PanelContenido({ frases, usagePorFrase }: { frases: FraseContenido[]; usagePorFrase: Record<string, UsageStats> }) {
  const [subTab, setSubTab] = useState<SubTabContenido>("salud");

  const bloques = Array.from(new Set(frases.map((f) => f.bloque)));
  const lecciones = Array.from(new Set(frases.map((f) => f.leccion)));

  const subTabs: { id: SubTabContenido; label: string }[] = [
    { id: "salud",   label: "Panel de salud" },
    { id: "explorar", label: "Explorar frases" },
    { id: "mapa",    label: "Mapa Maestro" },
    { id: "anadir",  label: "Añadir frase" },
  ];

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 22, borderBottom: `1px solid ${C.line}` }}>
        {subTabs.map((s) => (
          <button
            key={s.id}
            onClick={() => setSubTab(s.id)}
            style={{
              padding: "10px 20px", fontSize: 13, fontWeight: 600,
              color: subTab === s.id ? C.orange : C.mute,
              background: "none", border: "none",
              borderBottom: subTab === s.id ? `2px solid ${C.orange}` : "2px solid transparent",
              cursor: "pointer", fontFamily: "inherit",
              marginBottom: -1, transition: "all .15s",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Banner de datos */}
      <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "9px 14px", fontSize: 13, color: "#2563EB", marginBottom: 20, display: "flex", gap: 8 }}>
        ℹ️ <span>Catálogo cargado: <strong>{frases.length} frases</strong> en <strong>{bloques.length} bloques</strong> y <strong>{lecciones.length} lecciones</strong>. Datos de uso por perfil: disponibles en Iteración 4.</span>
      </div>

      {/* Contenido por sub-tab */}
      {subTab === "salud" && <PanelSalud frases={frases} usagePorFrase={usagePorFrase} />}
      {subTab === "explorar" && <ExplorarFrases frases={frases} usagePorFrase={usagePorFrase} />}
      {subTab === "mapa" && <MapaMaestro frases={frases} />}
      {subTab === "anadir" && <AnadirFrase frases={frases} />}
    </div>
  );
}


export default function AdminPanel({ usuarios, consumoGlobal, frases, usagePorFrase }: { usuarios: UsuarioResumen[]; consumoGlobal: ConsumoGlobal; frases: FraseContenido[]; usagePorFrase: Record<string, UsageStats> }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [filtroBloque, setFiltroBloque] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [sortCol, setSortCol] = useState<string>("ultimaActividad");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [tabActiva, setTabActiva] = useState<Tab>("usuarios");
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<DetalleUsuario | null>(null);
  const [cargando, setCargando] = useState(false);
  const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "warn" } | null>(null);

  const totalCuentas = usuarios.length;
  const activasEnSiete = usuarios.filter((u) => u.diasDesdeUltima <= 7).length;
  const totalPerfiles = usuarios.reduce((acc, u) => acc + u.perfiles.length, 0);
  const rachaMaxima = Math.max(0, ...usuarios.flatMap((u) => u.perfiles.map((p) => p.racha)));
  const sesionesEnCurso = usuarios.filter((u) => tieneSesionEnCurso(u.perfiles)).length;

  const usuariosFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    return usuarios.filter((u) => {
      // Texto libre: email, nombre display o nombre de perfil
      const matchTexto = !q ||
        u.email.toLowerCase().includes(q) ||
        u.nombreDisplay.toLowerCase().includes(q) ||
        u.perfiles.some((p) => p.nombre.toLowerCase().includes(q));

      // Bloque activo de cualquier perfil del usuario
      const matchBloque = !filtroBloque ||
        u.perfiles.some((p) => p.bloqueActivo === filtroBloque);

      // Estado derivado del usuario
      let matchEstado = true;
      if (filtroEstado === "hoy") matchEstado = u.diasDesdeUltima === 0;
      else if (filtroEstado === "reciente") matchEstado = u.diasDesdeUltima > 0 && u.diasDesdeUltima <= 7;
      else if (filtroEstado === "inactivo") matchEstado = u.diasDesdeUltima > 7;
      else if (filtroEstado === "sesion") matchEstado = tieneSesionEnCurso(u.perfiles);
      else if (filtroEstado === "atascado") matchEstado = tieneSesionAtascada(u.perfiles);
      else if (filtroEstado === "bloqueado") matchEstado = u.bloqueado;

      return matchTexto && matchBloque && matchEstado;
    }).sort((a, b) => {
      const perfilA = a.perfiles.find((p) => p.id === a.perfilActivoId) ?? a.perfiles[0];
      const perfilB = b.perfiles.find((p) => p.id === b.perfilActivoId) ?? b.perfiles[0];
      let diff = 0;
      if (sortCol === "usuario")          diff = a.nombreDisplay.localeCompare(b.nombreDisplay);
      else if (sortCol === "perfiles")    diff = a.perfiles.length - b.perfiles.length;
      else if (sortCol === "bloque")      diff = (perfilA?.bloqueActivo ?? "").localeCompare(perfilB?.bloqueActivo ?? "");
      else if (sortCol === "progreso")    diff = (perfilA?.progresoBloque ?? 0) - (perfilB?.progresoBloque ?? 0);
      else if (sortCol === "racha")       diff = (perfilA?.racha ?? 0) - (perfilB?.racha ?? 0);
      else if (sortCol === "ultimaActividad") diff = a.diasDesdeUltima - b.diasDesdeUltima;
      else if (sortCol === "estado")      diff = a.diasDesdeUltima - b.diasDesdeUltima;
      return sortDir === "asc" ? diff : -diff;
    });
  }, [usuarios, busqueda, filtroBloque, filtroEstado, sortCol, sortDir]);

  function handleSort(col: string) {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  function mostrarToast(msg: string, tipo: "ok" | "warn" = "ok") {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 2800);
  }

  async function recargarDetalle(userId: string) {
    const datos = await obtenerDetalleUsuario(userId);
    setDetalle(datos);
  }

  async function handleVerUsuario(userId: string) {
    if (seleccionadoId === userId) {
      setSeleccionadoId(null);
      setDetalle(null);
      return;
    }
    setSeleccionadoId(userId);
    setDetalle(null);
    setCargando(true);
    try {
      const datos = await obtenerDetalleUsuario(userId);
      setDetalle(datos);
    } finally {
      setCargando(false);
    }
  }

  function abrirModal(config: ModalConfig) {
    const onConfirmConExtra = async (val?: number) => {
      await config.onConfirm(val);
      mostrarToast(
        config.refreshTrasConfirmar ? "Cuenta eliminada." : "Acción aplicada correctamente.",
        config.refreshTrasConfirmar ? "warn" : "ok"
      );
      if (config.refreshTrasConfirmar) {
        setSeleccionadoId(null);
        setDetalle(null);
        router.refresh();
      } else if (seleccionadoId) {
        await recargarDetalle(seleccionadoId);
      }
    };
    setModalConfig({ ...config, onConfirm: onConfirmConExtra });
  }

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: C.bg, minHeight: "100vh" }}>

      {/* Header */}
      <header style={{ background: "#fff", borderBottom: `1px solid ${C.line}`, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "14px 28px", display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.orange, letterSpacing: "-0.03em", whiteSpace: "nowrap" }}>
            Flash<span style={{ color: C.ink }}>English</span>{" "}
            <span style={{ color: C.line, fontWeight: 300 }}>·</span>{" "}
            <span style={{ fontSize: 13, fontWeight: 600, color: C.mute }}>Backoffice</span>
          </div>
          <nav style={{ display: "flex", gap: 2, marginLeft: 28 }}>
            {(["usuarios", "contenido", "gramatica"] as Tab[]).map((tab) => (
              <button key={tab} onClick={() => setTabActiva(tab)} style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, color: tabActiva === tab ? C.orange : C.mute, background: tabActiva === tab ? C.orangeBg : "none", border: "none", cursor: "pointer", borderRadius: 8, fontFamily: "inherit" }}>
                {tab === "gramatica" ? "Gramática" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
          <div style={{ marginLeft: "auto" }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: C.greenBg, color: C.green, letterSpacing: "0.02em" }}>PROD</span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main style={{ maxWidth: 1280, margin: "0 auto", width: "100%", padding: "28px 28px 80px" }}>
        {tabActiva === "usuarios" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14, marginBottom: 28 }}>
              <KpiCard num={totalCuentas} label="Cuentas totales" color={C.orange} />
              <KpiCard num={activasEnSiete} label="Activas (7 días)" color={C.green} />
              <KpiCard num={totalPerfiles} label="Perfiles en uso" />
              <KpiCard num={rachaMaxima} label="Racha máxima (días)" color={C.green} />
              <KpiCard num={sesionesEnCurso} label="Sesiones en curso" color={sesionesEnCurso > 0 ? C.amber : undefined} />
              <KpiCard
                num={consumoGlobal.totalHoy}
                label={consumoGlobal.alerta ? "⚠️ Eval. IA hoy — ALERTA" : "Eval. IA hoy"}
                color={consumoGlobal.alerta ? C.red : C.amber}
                sub={`~€${consumoGlobal.costeEstimadoEurHoy.toFixed(3)} estimado`}
              />
            </div>

            <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.04)", overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.surface}`, display: "flex", gap: 10, alignItems: "center" }}>
                <input type="text" placeholder="Buscar por email o nombre de perfil…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={{ flex: 1, maxWidth: 260, fontSize: 13, padding: "8px 12px", border: `1px solid ${C.line}`, borderRadius: 8, background: C.surface, color: C.ink, fontFamily: "inherit", outline: "none" }} />
                <select value={filtroBloque} onChange={(e) => setFiltroBloque(e.target.value)} style={{ fontSize: 13, padding: "8px 11px", border: `1px solid ${C.line}`, borderRadius: 8, background: C.surface, color: C.ink, fontFamily: "inherit", cursor: "pointer" }}>
                  <option value="">Todos los bloques</option>
                  {["BASIC1","BASIC2","INT1","INT2","INT3","INT4","ADV1","ADV2"].map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={{ fontSize: 13, padding: "8px 11px", border: `1px solid ${C.line}`, borderRadius: 8, background: C.surface, color: C.ink, fontFamily: "inherit", cursor: "pointer" }}>
                  <option value="">Todos los estados</option>
                  <option value="hoy">Activo hoy</option>
                  <option value="reciente">Reciente (≤7 días)</option>
                  <option value="inactivo">Inactivo (&gt;7 días)</option>
                  <option value="sesion">Sesión en curso</option>
                  <option value="atascado">Sesión atascada</option>
                  <option value="bloqueado">Bloqueado</option>
                </select>
                <span style={{ marginLeft: "auto", fontSize: 12, color: C.mute, background: C.surface, padding: "4px 10px", borderRadius: 20, fontWeight: 600, whiteSpace: "nowrap" }}>
                  {usuariosFiltrados.length} {usuariosFiltrados.length !== 1 ? "cuentas" : "cuenta"}{(busqueda || filtroBloque || filtroEstado) && ` de ${totalCuentas}`}
                </span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {([
                      { label: "Usuario",        col: "usuario" },
                      { label: "Perfiles",       col: "perfiles" },
                      { label: "Bloque activo",  col: "bloque" },
                      { label: "Progreso",       col: "progreso" },
                      { label: "Sesiones",       col: null },
                      { label: "Racha",          col: "racha" },
                      { label: "Última sesión",  col: "ultimaActividad" },
                      { label: "Estado",         col: "estado" },
                      { label: "",               col: null },
                    ] as { label: string; col: string | null }[]).map(({ label, col }) => (
                      <th
                        key={label}
                        onClick={col ? () => handleSort(col) : undefined}
                        style={{
                          textAlign: "left", fontSize: 11, fontWeight: 700,
                          color: col && sortCol === col ? C.orange : C.mute,
                          padding: "10px 16px", background: C.surface,
                          textTransform: "uppercase", letterSpacing: "0.04em",
                          borderBottom: `1px solid ${C.line}`,
                          cursor: col ? "pointer" : "default",
                          userSelect: "none",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {label}
                        {col && sortCol === col && (
                          <span style={{ marginLeft: 4 }}>{sortDir === "asc" ? "↑" : "↓"}</span>
                        )}
                        {col && sortCol !== col && label && (
                          <span style={{ marginLeft: 4, opacity: 0.3 }}>↕</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {usuariosFiltrados.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: "center", padding: 32, color: C.mute, fontSize: 14 }}>Sin resultados para &ldquo;{busqueda}&rdquo;</td></tr>
                  ) : (
                    usuariosFiltrados.map((u) => (
                      <FilaUsuario key={u.id} usuario={u} seleccionado={seleccionadoId === u.id} onVer={() => handleVerUsuario(u.id)} />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {cargando && (
              <div style={{ marginTop: 16, padding: 24, textAlign: "center", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, color: C.mute, fontSize: 14 }}>
                Cargando datos…
              </div>
            )}

            {!cargando && detalle && seleccionadoId && (() => {
              const usuarioSel = usuarios.find((u) => u.id === seleccionadoId);
              return (
                <PanelDetalle
                  detalle={detalle}
                  onCerrar={() => { setSeleccionadoId(null); setDetalle(null); }}
                  onAction={abrirModal}
                  userId={seleccionadoId}
                  tutorActivoInicial={usuarioSel?.tutorActivo ?? true}
                  bloqueadoInicial={usuarioSel?.bloqueado ?? false}
                  evaluacionesHoy={usuarioSel?.evaluacionesHoy ?? 0}
                />
              );
            })()}
          </>
        )}

        {tabActiva === "contenido" && <PanelContenido frases={frases} usagePorFrase={usagePorFrase} />}

        {tabActiva === "gramatica" && (
          <div style={{ textAlign: "center", padding: "80px 24px", color: C.mute }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📚</div>
            <p style={{ fontWeight: 700, fontSize: 18, color: C.ink, marginBottom: 8 }}>Tips gramaticales</p>
            <p style={{ fontSize: 14 }}>Este panel estará disponible en una versión futura.</p>
          </div>
        )}
      </main>

      {/* Modal */}
      {modalConfig && <Modal config={modalConfig} onCerrar={() => setModalConfig(null)} />}

      {/* Toast */}
      {toast && <Toast msg={toast.msg} tipo={toast.tipo} />}
    </div>
  );
}
