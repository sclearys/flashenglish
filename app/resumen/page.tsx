"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { obtenerFrasePorId } from "@/lib/sesion";
import { temasARepasar } from "@/lib/stats";
import { RespuestaSesion } from "@/lib/types";

interface ResumenData {
  total: number;
  respuestas: RespuestaSesion[];
  frases_aprendidas: number;
  en_repaso_manana: number;
}

function tituloPorPorcentaje(pct: number): string {
  if (pct >= 80) return "Buen trabajo";
  if (pct >= 50) return "¡Sigue así!";
  return "A practicar más";
}

export default function Resumen() {
  const router = useRouter();
  const [datos, setDatos] = useState<ResumenData | null>(null);
  const inicializado = useRef(false);

  useEffect(() => {
    // useRef evita que el efecto se ejecute dos veces en modo desarrollo (StrictMode)
    if (inicializado.current) return;
    inicializado.current = true;

    const raw = localStorage.getItem("flashenglish.resumen");
    if (raw) {
      setDatos(JSON.parse(raw));
      localStorage.removeItem("flashenglish.resumen");
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

  const { total, respuestas, frases_aprendidas, en_repaso_manana } = datos;
  const perfectas = respuestas.filter((r) => r.resultado === "perfecto").length;
  const casi = respuestas.filter((r) => r.resultado === "casi").length;
  const incorrectas = respuestas.filter((r) => r.resultado === "incorrecto").length;
  const porcentaje = total > 0 ? Math.round((perfectas / total) * 100) : 0;
  const temas = temasARepasar(respuestas, obtenerFrasePorId);

  // Anchos de la barra de 3 colores
  const anchoPerfecto = total > 0 ? (perfectas / total) * 100 : 0;
  const anchoCasi = total > 0 ? (casi / total) * 100 : 0;
  const anchoIncorrecto = total > 0 ? (incorrectas / total) * 100 : 0;

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-10 gap-5">

      {/* Cabecera */}
      <div className="w-full max-w-sm">
        <p className="text-eyebrow font-semibold uppercase text-mute mb-1">
          SESIÓN COMPLETADA
        </p>
        <h1 className="text-[26px] font-semibold text-ink tracking-[-0.02em]">
          {tituloPorPorcentaje(porcentaje)}
        </h1>
      </div>

      {/* Card de resultados con barra tricolor */}
      <div className="w-full max-w-sm bg-brand-50 rounded-xl px-5 py-4 flex flex-col gap-3">
        {/* Porcentaje */}
        <div className="flex items-baseline gap-1">
          <span className="text-[52px] font-semibold text-ink leading-none tabular-nums">
            {porcentaje}
          </span>
          <span className="text-[20px] font-semibold text-ink">%</span>
          <span className="text-sm font-medium text-body ml-1">perfectas</span>
        </div>

        {/* Barra tricolor */}
        <div className="flex gap-[3px] h-2 rounded-full overflow-hidden">
          {anchoPerfecto > 0 && (
            <div
              className="h-full bg-success rounded-full"
              style={{ width: `${anchoPerfecto}%` }}
            />
          )}
          {anchoCasi > 0 && (
            <div
              className="h-full bg-warn rounded-full"
              style={{ width: `${anchoCasi}%` }}
            />
          )}
          {anchoIncorrecto > 0 && (
            <div
              className="h-full bg-danger rounded-full"
              style={{ width: `${anchoIncorrecto}%` }}
            />
          )}
          {/* Fondo completo si todo es 0 */}
          {perfectas === 0 && casi === 0 && incorrectas === 0 && (
            <div className="h-full bg-brand-100 rounded-full w-full" />
          )}
        </div>

        {/* Leyenda */}
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5 text-xs font-medium text-body">
            <span className="w-2 h-2 rounded-full bg-success inline-block" />
            {perfectas} perfecto
          </span>
          <span className="flex items-center gap-1.5 text-xs font-medium text-body">
            <span className="w-2 h-2 rounded-full bg-warn inline-block" />
            {casi} casi
          </span>
          <span className="flex items-center gap-1.5 text-xs font-medium text-body">
            <span className="w-2 h-2 rounded-full bg-danger inline-block" />
            {incorrectas} incorrecto
          </span>
        </div>
      </div>

      {/* Dos stat cards */}
      <div className="w-full max-w-sm grid grid-cols-2 gap-3">
        <div className="bg-surface rounded-xl px-4 py-3 flex flex-col gap-0.5">
          <p className="text-[28px] font-semibold text-success leading-none tabular-nums">
            +{frases_aprendidas}
          </p>
          <p className="text-xs font-medium text-body mt-1">frases aprendidas</p>
        </div>
        <div className="bg-surface rounded-xl px-4 py-3 flex flex-col gap-0.5">
          <p className="text-[28px] font-semibold text-brand-500 leading-none tabular-nums">
            {en_repaso_manana}
          </p>
          <p className="text-xs font-medium text-body mt-1">en repaso para mañana</p>
        </div>
      </div>

      {/* Temas a repasar */}
      {temas.length > 0 && (
        <div className="w-full max-w-sm flex flex-col gap-2">
          <p className="text-eyebrow font-semibold uppercase text-mute">
            A REPASAR
          </p>
          <div className="flex flex-col gap-2">
            {temas.map(({ tema, count }) => (
              <div
                key={tema}
                className="flex items-center justify-between bg-white border border-brand-100 rounded-lg px-4 py-3"
              >
                <p className="text-sm font-semibold text-ink">{tema}</p>
                <span className="text-sm font-semibold text-brand-500 tabular-nums">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botones */}
      <div className="w-full max-w-sm grid grid-cols-2 gap-3">
        <button
          onClick={() => router.push("/")}
          className="h-12 rounded-md bg-white border border-brand-100 text-ink text-sm font-semibold hover:border-brand-300 transition-all"
        >
          Terminar
        </button>
        <button
          onClick={() => router.push("/sesion")}
          className="h-12 rounded-md bg-brand-500 text-white text-sm font-semibold hover:brightness-95 transition-all"
        >
          Siguiente sesión
        </button>
      </div>

    </main>
  );
}
