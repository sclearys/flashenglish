"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BLOQUES_ORDENADOS } from "@/lib/catalogo";
import { RespuestaSesion } from "@/lib/types";

interface TemaRepasar {
  tema: string;
  count: number;
}

interface ResumenData {
  total: number;
  respuestas: RespuestaSesion[];
  frases_aprendidas: number;
  en_repaso_manana: number;
  // campos de sesión normal de bloque (opcionales para compatibilidad)
  bloque?: string;
  aprendidas_antes?: number;
  aprendidas_despues?: number;
  porcentaje_antes?: number;
  porcentaje_despues?: number;
  temas_sesion?: string[];
  temas_repasar?: TemaRepasar[];
  // campos de refuerzo
  tipo?: "refuerzo";
  tema?: string;
  tamano?: number;
}

function emojiPorcentaje(pct: number): string {
  if (pct >= 80) return "🎯";
  if (pct >= 50) return "💪";
  return "📖";
}

export default function Resumen() {
  const router = useRouter();
  const [datos, setDatos] = useState<ResumenData | null>(null);
  const [animado, setAnimado] = useState(false);
  const inicializado = useRef(false);

  useEffect(() => {
    // useRef evita que el efecto se ejecute dos veces en StrictMode (desarrollo)
    if (inicializado.current) return;
    inicializado.current = true;

    const raw = localStorage.getItem("flashenglish.resumen");
    if (raw) {
      setDatos(JSON.parse(raw));
      localStorage.removeItem("flashenglish.resumen");
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimado(true)));
    } else {
      router.replace("/");
    }
  }, [router]);

  if (!datos) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-body">Cargando...</p>
      </main>
    );
  }

  const esRefuerzo = datos.tipo === "refuerzo";
  const { total, respuestas } = datos;
  const perfectas = respuestas.filter((r) => r.resultado === "perfecto").length;
  const casi = respuestas.filter((r) => r.resultado === "casi").length;
  const incorrectas = respuestas.filter((r) => r.resultado === "incorrecto").length;
  const porcentaje = total > 0 ? Math.round((perfectas / total) * 100) : 0;

  const bloqueInfo = datos.bloque
    ? BLOQUES_ORDENADOS.find((b) => b.codigo === datos.bloque)
    : null;
  const delta =
    datos.aprendidas_despues !== undefined && datos.aprendidas_antes !== undefined
      ? datos.aprendidas_despues - datos.aprendidas_antes
      : null;

  const totalFallos = datos.temas_repasar?.reduce((s, t) => s + t.count, 0) ?? 0;

  return (
    <main className="min-h-screen bg-white flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-sm flex flex-col gap-5">

        {/* Cabecera */}
        <div className="flex flex-col gap-1">
          <span className="text-5xl leading-tight">{emojiPorcentaje(porcentaje)}</span>
          {esRefuerzo ? (
            <>
              <h1 className="text-[22px] font-semibold text-ink mt-1">
                Refuerzo de {datos.tema}
              </h1>
              <p className="text-[13px] text-mute">{total} frases</p>
            </>
          ) : (
            <>
              <h1 className="text-[22px] font-semibold text-ink mt-1">Sesión completada</h1>
              <p className="text-[13px] text-mute">{total} frases</p>
            </>
          )}
        </div>

        {/* 3 chips de resultado */}
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center gap-1 bg-success/10 rounded-xl py-3">
            <span className="text-[22px] font-semibold text-success tabular-nums leading-none">
              {perfectas}
            </span>
            <span className="text-[11px] text-success font-medium">Perfecto</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-xl py-3" style={{ backgroundColor: "#FFC85726" }}>
            <span className="text-[22px] font-semibold tabular-nums leading-none" style={{ color: "#5C3F00" }}>
              {casi}
            </span>
            <span className="text-[11px] font-medium" style={{ color: "#5C3F00" }}>Casi</span>
          </div>
          <div className="flex flex-col items-center gap-1 bg-danger/10 rounded-xl py-3">
            <span className="text-[22px] font-semibold text-danger tabular-nums leading-none">
              {incorrectas}
            </span>
            <span className="text-[11px] text-danger font-medium">Fallo</span>
          </div>
        </div>

        {/* Card de progreso del bloque — solo en sesión normal */}
        {!esRefuerzo &&
          bloqueInfo &&
          datos.aprendidas_antes !== undefined &&
          datos.aprendidas_despues !== undefined &&
          datos.porcentaje_antes !== undefined &&
          datos.porcentaje_despues !== undefined && (
          <div className="bg-brand-50 rounded-xl px-5 py-4 flex flex-col gap-3">
            <p className="text-eyebrow font-semibold uppercase text-mute">TU BLOQUE</p>
            <p className="text-[20px] font-semibold text-ink">{bloqueInfo.nombre}</p>
            <div className="flex items-center justify-between">
              <p className="text-sm text-body tabular-nums">
                {datos.aprendidas_antes} → {datos.aprendidas_despues} aprendidas
              </p>
              {delta !== null && delta > 0 && (
                <span className="text-xs font-semibold text-success bg-success/10 rounded-full px-2.5 py-0.5">
                  +{delta}
                </span>
              )}
            </div>
            <div className="h-2 rounded-full bg-brand-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-[600ms] ease-out"
                style={{
                  width: animado
                    ? `${datos.porcentaje_despues}%`
                    : `${datos.porcentaje_antes}%`,
                }}
              />
            </div>
            <p className="text-xs text-mute tabular-nums text-right">
              {datos.porcentaje_despues}%
            </p>
          </div>
        )}

        {/* Por repasar */}
        {datos.temas_repasar && datos.temas_repasar.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-eyebrow font-semibold uppercase text-mute">POR REPASAR</p>
              <span className="text-xs font-semibold text-danger bg-danger/10 rounded-full px-2.5 py-0.5">
                {totalFallos} {totalFallos === 1 ? "fallo" : "fallos"}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {datos.temas_repasar.map(({ tema, count }) => (
                <div
                  key={tema}
                  className="flex items-center justify-between border-l-2 border-danger pl-3 py-1"
                >
                  <p className="text-sm font-semibold text-ink">{tema}</p>
                  <span className="text-sm text-mute tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Temas de esta sesión — solo en sesión normal */}
        {!esRefuerzo && datos.temas_sesion && datos.temas_sesion.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-eyebrow font-semibold uppercase text-mute">
              TEMAS DE ESTA SESIÓN
            </p>
            <div className="flex flex-wrap gap-2">
              {datos.temas_sesion.map((tema) => (
                <span
                  key={tema}
                  className="text-xs font-medium text-body bg-surface rounded-full px-3 py-1"
                >
                  {tema}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Botones */}
        <div className="flex flex-col gap-2 pt-1">
          {esRefuerzo ? (
            <>
              <button
                onClick={() =>
                  router.push(
                    `/sesion?tipo=refuerzo&tema=${encodeURIComponent(datos.tema ?? "")}&frases=${datos.tamano ?? 15}&nueva=1`
                  )
                }
                className="w-full h-12 rounded-md bg-brand-500 text-white text-sm font-semibold hover:brightness-95 transition-all"
              >
                Otra sesión
              </button>
              <button
                onClick={() => router.push("/mi-trayectoria")}
                className="w-full h-12 rounded-md bg-white border border-brand-100 text-ink text-sm font-semibold hover:border-brand-300 transition-all"
              >
                Volver a Mi trayectoria
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => router.push("/sesion?frases=25&nueva=1")}
                className="w-full h-12 rounded-md bg-brand-500 text-white text-sm font-semibold hover:brightness-95 transition-all"
              >
                Otra sesión
              </button>
              <button
                onClick={() => router.push("/")}
                className="w-full h-12 rounded-md bg-white border border-brand-100 text-ink text-sm font-semibold hover:border-brand-300 transition-all"
              >
                Terminar
              </button>
            </>
          )}
        </div>

      </div>
    </main>
  );
}
