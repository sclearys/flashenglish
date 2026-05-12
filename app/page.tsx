"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cargarEstado, obtenerPerfilActivo } from "@/lib/storage";
import { calcularStats } from "@/lib/stats";
import { AppState } from "@/lib/types";

const OPCIONES_FRASES = [10, 15, 20, 25];

export default function Inicio() {
  const router = useRouter();
  const [estado, setEstado] = useState<AppState | null>(null);
  const [frasesPorSesion, setFrasesPorSesion] = useState(25);

  useEffect(() => {
    setEstado(cargarEstado());
  }, []);

  if (!estado) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-body">Cargando...</p>
      </main>
    );
  }

  const perfil = obtenerPerfilActivo(estado);
  const stats = calcularStats(perfil);
  const haySessionEnCurso = perfil.sesion_en_curso !== null;
  const rachaTxt = stats.rachaDias === 1 ? "día" : "días";

  function empezar(nueva = false) {
    const params = new URLSearchParams();
    params.set("frases", String(frasesPorSesion));
    if (nueva) params.set("nueva", "1");
    router.push(`/sesion?${params.toString()}`);
  }

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-10 gap-5">

      {/* Cabecera */}
      <div className="w-full max-w-sm">
        <p className="text-eyebrow font-semibold uppercase text-mute mb-1">
          FLASHENGLISH
        </p>
        <h1 className="text-[26px] font-semibold text-ink tracking-[-0.02em]">
          Listo para una nueva sesión
        </h1>
      </div>

      {/* Card de racha */}
      <div className="w-full max-w-sm bg-brand-50 rounded-xl px-5 py-4 flex items-center gap-4">
        <span className="text-[32px]">🔥</span>
        <div>
          <p className="text-[22px] font-semibold text-ink tabular-nums leading-none">
            {stats.rachaDias} {rachaTxt}
          </p>
          <p className="text-sm font-medium text-mute mt-0.5">de racha</p>
        </div>
      </div>

      {/* Bloque Basic + barra de progreso */}
      <div className="w-full max-w-sm flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">Bloque Basic</p>
          <p className="text-sm font-medium text-mute tabular-nums">
            {stats.porcentajeBloque}%
          </p>
        </div>
        {/* Barra de progreso */}
        <div className="w-full flex gap-[3px]">
          <div
            className="h-1.5 rounded-full bg-brand-500 transition-all duration-[400ms] ease-out"
            style={{ width: `${Math.max(stats.porcentajeBloque, stats.porcentajeBloque > 0 ? 2 : 0)}%` }}
          />
          <div className="h-1.5 rounded-full bg-brand-100 flex-1" />
        </div>

        {/* Stats: aprendidas · en repaso · total */}
        <div className="flex items-center gap-6 mt-1">
          <div className="flex flex-col gap-0.5">
            <p className="text-[20px] font-semibold text-success tabular-nums leading-none">
              {stats.aprendidas}
            </p>
            <p className="text-eyebrow font-semibold uppercase text-mute">
              APRENDIDAS
            </p>
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-[20px] font-semibold text-brand-500 tabular-nums leading-none">
              {stats.enRepaso}
            </p>
            <p className="text-eyebrow font-semibold uppercase text-mute">
              EN REPASO
            </p>
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-[20px] font-semibold text-body tabular-nums leading-none">
              {stats.total}
            </p>
            <p className="text-eyebrow font-semibold uppercase text-mute">
              TOTAL
            </p>
          </div>
        </div>
      </div>

      {/* Selector de frases por sesión */}
      <div className="w-full max-w-sm flex flex-col gap-2">
        <p className="text-eyebrow font-semibold uppercase text-mute">
          FRASES POR SESIÓN
        </p>
        <div className="grid grid-cols-4 gap-2">
          {OPCIONES_FRASES.map((n) => (
            <button
              key={n}
              onClick={() => setFrasesPorSesion(n)}
              className={`h-11 rounded-md text-sm font-semibold transition-all ${
                frasesPorSesion === n
                  ? "bg-brand-500 text-white"
                  : "bg-white border border-brand-100 text-ink hover:border-brand-300"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Botones de acción */}
      {haySessionEnCurso ? (
        <div className="w-full max-w-sm flex flex-col gap-3">
          <button
            onClick={() => empezar(false)}
            className="w-full h-12 rounded-md bg-brand-500 text-white text-sm font-semibold hover:brightness-95 transition-all"
          >
            Continuar sesión ({perfil.sesion_en_curso!.indice_actual}/{perfil.sesion_en_curso!.frases_ids.length})
          </button>
          <button
            onClick={() => empezar(true)}
            className="w-full h-12 rounded-md bg-white border border-brand-100 text-brand-700 text-sm font-semibold hover:border-brand-300 transition-all"
          >
            Empezar sesión nueva
          </button>
        </div>
      ) : (
        <button
          onClick={() => empezar()}
          className="w-full max-w-sm h-12 rounded-md bg-brand-500 text-white text-sm font-semibold hover:brightness-95 transition-all"
        >
          Empezar sesión
        </button>
      )}

    </main>
  );
}
