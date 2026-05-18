"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BLOQUES_ORDENADOS } from "@/lib/catalogo";

function FinDeBloqueInterna() {
  const router = useRouter();
  const params = useSearchParams();
  const bloqueCompletado = params.get("bloque") ?? "";

  const idxCompletado = BLOQUES_ORDENADOS.findIndex((b) => b.codigo === bloqueCompletado);
  const infoCompletado = idxCompletado !== -1 ? BLOQUES_ORDENADOS[idxCompletado] : null;
  const infoNuevo =
    idxCompletado !== -1 && idxCompletado < BLOQUES_ORDENADOS.length - 1
      ? BLOQUES_ORDENADOS[idxCompletado + 1]
      : null;

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">

        <span className="text-6xl">🎉</span>

        <div className="flex flex-col gap-1">
          <p className="text-[22px] font-semibold text-ink">¡Bloque completado!</p>
          <p className="text-base text-mute">
            {infoCompletado?.nombre ?? bloqueCompletado}
          </p>
        </div>

        {infoNuevo && (
          <div className="w-full bg-brand-50 rounded-xl px-5 py-4 flex flex-col gap-1 text-left">
            <p className="text-eyebrow font-semibold uppercase text-mute">Siguiente bloque</p>
            <p className="text-[20px] font-semibold text-ink">{infoNuevo.nombre}</p>
          </div>
        )}

        <div className="w-full flex flex-col gap-2">
          <button
            onClick={() => router.push("/sesion?frases=25&nueva=1")}
            className="w-full h-12 rounded-md bg-brand-500 text-white text-sm font-semibold hover:brightness-95 transition-all"
          >
            Empezar {infoNuevo?.nombre ?? "siguiente bloque"}
          </button>
          <button
            onClick={() => router.push("/")}
            className="w-full h-12 rounded-md bg-white border border-brand-100 text-brand-700 text-sm font-semibold hover:border-brand-300 transition-all"
          >
            Volver al inicio
          </button>
        </div>

      </div>
    </main>
  );
}

export default function FinDeBloque() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-body text-sm">Cargando...</p>
      </main>
    }>
      <FinDeBloqueInterna />
    </Suspense>
  );
}
