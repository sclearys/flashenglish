"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function RefuerzoPerfectoInterno() {
  const router = useRouter();
  const params = useSearchParams();
  const tema = decodeURIComponent(params.get("tema") ?? "");
  const total = params.get("total") ?? "0";

  // Si llegamos aquí sin datos válidos, volvemos a inicio
  if (!tema) {
    router.replace("/");
    return null;
  }

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">

        <span className="text-6xl">🌟</span>

        <div className="flex flex-col gap-2">
          <p className="text-[22px] font-semibold text-ink">
            ¡{total} de {total} en {tema}!
          </p>
          <p className="text-base text-body leading-relaxed">
            Parece que tienes la regla controlada.
          </p>
          <p className="text-[13px] text-mute leading-relaxed">
            Ahora demuéstralo cuando aparezca en una sesión normal.
          </p>
        </div>

        <div className="w-full flex flex-col gap-2">
          <button
            onClick={() => router.push("/mi-trayectoria")}
            className="w-full h-12 rounded-md bg-brand-500 text-white text-sm font-semibold hover:brightness-95 transition-all"
          >
            Volver a Mi trayectoria
          </button>
          <button
            onClick={() =>
              router.push(
                `/sesion?tipo=refuerzo&tema=${encodeURIComponent(tema)}&frases=${total}&nueva=1`
              )
            }
            className="w-full h-12 rounded-md bg-white border border-brand-100 text-ink text-sm font-semibold hover:border-brand-300 transition-all"
          >
            Otra sesión de refuerzo
          </button>
        </div>

      </div>
    </main>
  );
}

export default function RefuerzoPerfecto() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-body text-sm">Cargando...</p>
      </main>
    }>
      <RefuerzoPerfectoInterno />
    </Suspense>
  );
}
