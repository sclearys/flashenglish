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

        {/* Bloque 1 — Para quien acompaña */}
        <div className="flex flex-col gap-2">
          <span className="text-eyebrow font-semibold uppercase text-mute">Para quien acompaña</span>
          <p className="text-[14px] font-medium text-body leading-relaxed">
            FlashEnglish está pensada para usarse con un adulto al lado, sobre todo al principio. Una niña o niño puede usarla solo después, pero la herramienta funciona mejor cuando alguien escucha, da pie y ayuda a ser honesto en la autoevaluación.
          </p>
          <p className="text-[14px] font-medium text-body leading-relaxed">
            Tú decides cuánto acompañar: a veces sentarte a hacer una sesión juntos, otras veces dejar que vaya solo y repasar de vez en cuando.
          </p>
        </div>

        {/* Bloque 2 — Cómo se usa */}
        <div className="flex flex-col gap-2">
          <span className="text-eyebrow font-semibold uppercase text-mute">Cómo se usa</span>
          <p className="text-[14px] font-medium text-body leading-relaxed">
            Si juegas solo, lees la frase, la dices en alto y te autoevalúas. Si juegas con un adulto, el adulto puede leer la frase, escucharte y pulsar la evaluación por ti.
          </p>
          <p className="text-[14px] font-medium text-body leading-relaxed">
            Decirlas en voz alta ayuda a automatizar estructuras y ganar velocidad mental en inglés. No vale pensar la respuesta y darla por buena: el objetivo es reproducirla en voz alta, no reconocerla con la cabeza.
          </p>
        </div>

        {/* Bloque 3 — La mecánica */}
        <div className="flex flex-col gap-2">
          <span className="text-eyebrow font-semibold uppercase text-mute">La mecánica</span>
          <p className="text-[14px] font-medium text-body leading-relaxed">
            Ves una frase en español. La dices en alto en inglés, lo mejor que puedas. Pulsas «Revelar» y la app te muestra y te lee la respuesta correcta. Comparas lo que dijiste con la respuesta y te autoevalúas con uno de los tres botones.
          </p>
        </div>

        {/* Bloque 4 — Cómo te autoevalúas */}
        <div className="flex flex-col gap-3">
          <span className="text-eyebrow font-semibold uppercase text-mute">Cómo te autoevalúas</span>

          <div className="flex flex-col gap-5">

            {/* Fluido */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0 bg-success" />
                <span className="text-[14px] font-semibold text-ink">Fluido</span>
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
                No supiste cómo arrancar, te quedaste atascado, o la estructura general no era la correcta. La repetiremos en próximos días hasta que se asiente.
              </p>
            </div>

          </div>
        </div>

        {/* Bloque 5 — Por qué la honestidad importa */}
        <div className="flex flex-col gap-2">
          <span className="text-eyebrow font-semibold uppercase text-mute">Por qué la honestidad importa</span>
          <p className="text-[14px] font-medium text-body leading-relaxed">
            La app no oye lo que dices: confía en tu evaluación. El que se autoevalúa con honestidad es el que de verdad aprende, porque la app le devuelve justo las frases que necesita repetir.
          </p>
          <p className="text-[14px] font-medium text-body leading-relaxed">
            Si acompañas a un peque, ayúdale a ver que pulsar «Fallo» no es perder: es decirle a la app qué practicar.
          </p>
        </div>

        {/* Bloque 6 — Por qué repetimos las frases */}
        <div className="flex flex-col gap-2">
          <span className="text-eyebrow font-semibold uppercase text-mute">Por qué repetimos las frases</span>
          <p className="text-[14px] font-medium text-body leading-relaxed">
            Aprender a hablar un idioma no es memorizar respuestas, es automatizar estructuras hasta que salen solas. Eso pide repetición espaciada: ver la misma estructura varias veces, repartida en distintos días.
          </p>
          <p className="text-[14px] font-medium text-body leading-relaxed">
            Por eso algunas frases vuelven a aparecer, aunque ya las hayas dado bien una vez. No es un error ni que vayas mal: es exactamente así como se asienta lo aprendido.
          </p>
        </div>

      </div>
    </main>
  );
}
