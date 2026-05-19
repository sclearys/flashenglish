"use client";

import { useRouter } from "next/navigation";

export default function ComoFunciona() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-white flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-sm flex flex-col gap-8">

        {/* Header: botón back + título */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 rounded-sm bg-surface flex items-center justify-center text-body hover:bg-brand-100 transition-colors shrink-0"
            aria-label="Volver"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <h1 className="text-[18px] font-semibold text-ink">Cómo funciona</h1>
        </div>

        {/* Bloque 1 — Cómo se usa */}
        <div className="flex flex-col gap-2">
          <span className="text-eyebrow font-semibold uppercase text-mute">Cómo se usa</span>
          <p className="text-[14px] font-medium text-body leading-relaxed">
            FlashEnglish se puede hacer solo o con un adulto al lado. Si juegas solo, lees la frase, la dices en alto y te autoevalúas. Si juegas con un adulto, el adulto puede leer la frase, escucharte y pulsar la evaluación por ti.
          </p>
          <p className="text-[14px] font-medium text-body leading-relaxed">
            Decirlas en voz alta ayuda a automatizar estructuras y ganar velocidad mental en inglés.
          </p>
        </div>

        {/* Bloque 2 — La mecánica */}
        <div className="flex flex-col gap-2">
          <span className="text-eyebrow font-semibold uppercase text-mute">La mecánica</span>
          <p className="text-[14px] font-medium text-body leading-relaxed">
            Ves una frase en español. La dices en alto en inglés, lo mejor que puedas. Pulsas «Revelar» y la app te muestra y te lee la respuesta correcta. Comparas lo que dijiste con la respuesta y te autoevalúas con uno de los tres botones.
          </p>
        </div>

        {/* Bloque 3 — Cómo te autoevalúas */}
        <div className="flex flex-col gap-3">
          <span className="text-eyebrow font-semibold uppercase text-mute">Cómo te autoevalúas</span>

          <div className="flex flex-col gap-5">

            {/* Perfecto */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0 bg-success" />
                <span className="text-[14px] font-semibold text-ink">Perfecto</span>
              </div>
              <p className="text-[14px] font-medium text-body leading-relaxed pl-5">
                La dijiste rápido, sin dudar, y básicamente igual que la respuesta modelo.
              </p>
            </div>

            {/* Casi */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0 bg-warn" />
                <span className="text-[14px] font-semibold text-ink">Casi</span>
              </div>
              <p className="text-[14px] font-medium text-body leading-relaxed pl-5">
                O dudaste / tardaste, o tuviste algún detalle suelto (una preposición, un tiempo verbal aproximado, un pronombre), pero la estructura general la sabías. La repasaremos en próximos días.
              </p>
            </div>

            {/* Fallo */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0 bg-danger" />
                <span className="text-[14px] font-semibold text-ink">Fallo</span>
              </div>
              <p className="text-[14px] font-medium text-body leading-relaxed pl-5">
                No supiste cómo arrancar, te quedaste atascada, o la estructura general no era la correcta. La repetiremos en próximos días hasta que se asiente.
              </p>
            </div>

          </div>
        </div>

      </div>
    </main>
  );
}
