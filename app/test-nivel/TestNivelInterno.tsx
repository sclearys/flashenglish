"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cargarEstado, aplicarResultadoTest } from "@/lib/storage";
import { BLOQUES_ORDENADOS } from "@/lib/catalogo";
import {
  FASES_TEST,
  MAX_FRASES_TEST,
  EstadoTest,
  iniciarTest,
  evaluarRespuesta,
  numeroPreguntaActual,
} from "@/lib/testNivel";
import { AppState } from "@/lib/types";

export default function TestNivelInterno() {
  const router = useRouter();
  const [appState, setAppState] = useState<AppState | null>(null);
  const [estadoTest, setEstadoTest] = useState<EstadoTest | null>(null);
  const [revelada, setRevelada] = useState(false);

  useEffect(() => {
    setAppState(cargarEstado());
    setEstadoTest(iniciarTest());
  }, []);

  if (!appState || !estadoTest) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-body text-sm">Cargando...</p>
      </main>
    );
  }

  // ── Pantalla de resultado ─────────────────────────────────────────────────

  if (estadoTest.terminado && estadoTest.bloqueResultado) {
    const bloqueInfo = BLOQUES_ORDENADOS.find(
      (b) => b.codigo === estadoTest.bloqueResultado
    );

    const confirmarResultado = () => {
      aplicarResultadoTest(appState, estadoTest.bloqueResultado!);
      router.push("/");
    };

    return (
      <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-eyebrow font-semibold uppercase text-mute">TU NIVEL</p>
            <h1 className="text-[28px] font-semibold text-ink leading-tight">
              {bloqueInfo?.nombre ?? estadoTest.bloqueResultado}
            </h1>
            <p className="text-sm text-mute">
              Empezarás directamente en este bloque.
            </p>
          </div>

          <button
            onClick={confirmarResultado}
            className="w-full h-12 rounded-md bg-brand-500 text-white text-sm font-semibold hover:brightness-95 transition-all"
          >
            Empezar a practicar
          </button>

          <button
            onClick={() => router.push("/")}
            className="text-sm font-medium text-mute hover:text-ink transition-colors"
          >
            Cancelar, volver al inicio
          </button>
        </div>
      </main>
    );
  }

  // ── Pantalla de test ──────────────────────────────────────────────────────

  const faseActual = FASES_TEST[estadoTest.fase];
  const fraseActual = faseActual.frases[estadoTest.indiceFrase];
  const numeroPregunta = numeroPreguntaActual(estadoTest);
  const porcentaje = Math.round(((numeroPregunta - 1) / MAX_FRASES_TEST) * 100);

  function responder(correcto: boolean) {
    setEstadoTest((prev) => evaluarRespuesta(prev!, correcto));
    setRevelada(false);
  }

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-10">

      {/* Cabecera */}
      <div className="w-full max-w-sm flex items-center justify-between mb-6">
        <button
          onClick={() => router.push("/")}
          className="text-sm font-semibold text-brand-500 hover:text-brand-700 transition-colors"
        >
          Saltar test
        </button>
        <span className="font-sans font-medium text-sm text-ink tabular-nums">
          {numeroPregunta} / {MAX_FRASES_TEST}
        </span>
      </div>

      {/* Barra de progreso */}
      <div className="w-full max-w-sm flex gap-[3px] mb-10">
        <div
          className="h-1 rounded-full bg-brand-500 transition-all duration-[400ms] ease-out"
          style={{ width: `${Math.max(porcentaje, 2)}%` }}
        />
        <div className="h-1 rounded-full bg-brand-100 flex-1" />
      </div>

      {/* Tarjeta */}
      <div key={fraseActual.id} className="w-full flex flex-col items-center animate-slide-in">
        <div className="w-full max-w-sm bg-brand-50 rounded-lg px-[14px] py-[22px] min-h-[120px] flex flex-col gap-2 mb-3">
          <span className="text-eyebrow font-semibold uppercase text-mute">TRADUCE</span>
          <p className="text-[18px] font-semibold text-body leading-snug">{fraseActual.es}</p>
        </div>

        {revelada && (
          <div className="w-full max-w-sm bg-brand-100 rounded-lg px-[14px] py-[18px] border border-brand-500/20 flex flex-col gap-2 mb-6">
            <span className="text-eyebrow font-semibold uppercase text-brand-700">ENGLISH</span>
            <p className="text-[18px] font-semibold text-ink leading-snug">{fraseActual.en}</p>
          </div>
        )}

        {!revelada ? (
          <button
            onClick={() => setRevelada(true)}
            className="w-full max-w-sm h-12 rounded-md bg-brand-500 text-white text-sm font-semibold hover:brightness-95 transition-all mt-3"
          >
            Revelar
          </button>
        ) : (
          <div className="w-full max-w-sm grid grid-cols-2 gap-[7px]">
            <button
              onClick={() => responder(false)}
              className="h-12 rounded-md bg-white border border-danger text-danger text-sm font-semibold hover:brightness-95 transition-all"
            >
              No lo sé
            </button>
            <button
              onClick={() => responder(true)}
              className="h-12 rounded-md bg-success text-white text-sm font-semibold hover:brightness-95 transition-all"
            >
              Lo sé
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
