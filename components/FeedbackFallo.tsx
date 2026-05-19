"use client";

import { useEffect, useState } from "react";
import { ResultadoEval } from "@/lib/types";

interface Props {
  fraseEspanol: string;
  traduccionIngles: string;
  temasGramaticales: string[];
  resultado: ResultadoEval; // "casi" o "incorrecto"
  onContinuar: () => void;
}

const DURACION_SEGUNDOS = 3;

export default function FeedbackFallo({
  fraseEspanol,
  traduccionIngles,
  temasGramaticales,
  onContinuar,
}: Props) {
  const [segundosRestantes, setSegundosRestantes] = useState(DURACION_SEGUNDOS);

  // Temporizador: cuenta atrás y avanza automáticamente al llegar a 0
  useEffect(() => {
    if (segundosRestantes <= 0) {
      onContinuar();
      return;
    }
    const timer = setTimeout(() => setSegundosRestantes((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [segundosRestantes, onContinuar]);

  const progresoCirulo = ((DURACION_SEGUNDOS - segundosRestantes) / DURACION_SEGUNDOS) * 100;

  return (
    <div
      className="w-full flex flex-col items-center gap-4 cursor-pointer"
      onClick={onContinuar}
    >
      {/* Frase en español */}
      <div className="w-full max-w-sm bg-brand-50 rounded-lg px-[14px] py-[18px] flex flex-col gap-2">
        <span className="text-eyebrow font-semibold uppercase text-mute">
          DILO EN VOZ ALTA
        </span>
        <p className="text-[15px] font-semibold text-body leading-snug">
          {fraseEspanol}
        </p>
      </div>

      {/* Respuesta en inglés — más grande, es la importante */}
      <div className="w-full max-w-sm bg-brand-100 rounded-lg px-[14px] py-[18px] border border-brand-500/20 flex flex-col gap-2">
        <span className="text-eyebrow font-semibold uppercase text-brand-700">
          ENGLISH
        </span>
        <p className="text-[18px] font-semibold text-ink leading-snug">
          {traduccionIngles}
        </p>
      </div>

      {/* Bloque "A REPASAR" */}
      <div className="w-full max-w-sm bg-brand-50 rounded-lg px-[14px] py-[18px] flex flex-col gap-2">
        {/* Icono + eyebrow */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
            <span className="text-brand-700 text-[11px] font-semibold">!</span>
          </div>
          <span className="text-eyebrow font-semibold uppercase text-mute">
            A REPASAR
          </span>
        </div>

        {/* Temas gramaticales */}
        <div className="flex flex-col gap-1">
          {temasGramaticales.map((tema) => (
            <p key={tema} className="text-[16px] font-semibold text-ink leading-snug">
              {tema}
            </p>
          ))}
        </div>

        {/* Mensaje colaborativo — no comunicamos cuántas veces se repite (política de copy) */}
        <p className="text-sm font-medium text-body mt-1">
          La repasaremos en próximos días
        </p>
      </div>

      {/* Pie: temporizador circular + texto */}
      <div className="w-full max-w-sm flex items-center gap-3 px-1">
        {/* Mini-temporizador circular */}
        <svg width="24" height="24" viewBox="0 0 24 24" className="shrink-0 -rotate-90">
          <circle cx="12" cy="12" r="10" fill="none" stroke="#FFEDDE" strokeWidth="2.5" />
          <circle
            cx="12" cy="12" r="10"
            fill="none"
            stroke="#FF7A45"
            strokeWidth="2.5"
            strokeDasharray={`${2 * Math.PI * 10}`}
            strokeDashoffset={`${2 * Math.PI * 10 * (progresoCirulo / 100)}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
        </svg>
        <p className="text-sm font-medium text-body">
          Tocar para continuar →
        </p>
      </div>
    </div>
  );
}
