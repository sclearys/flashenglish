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

        {/* Intro */}
        <div className="flex flex-col gap-4">
          <p className="text-[14px] font-medium text-body leading-relaxed">
            FlashEnglish entrena y agiliza tu capacidad para responder en inglés de forma automática.
          </p>
          <p className="text-[14px] font-medium text-body leading-relaxed">
            Practicarás diciendo frases en voz alta y repitiéndolas a lo largo del tiempo hasta que salgan de forma natural. Aplica técnicas de memorización y aprendizaje más naturales.
          </p>
          <p className="text-[14px] font-medium text-body leading-relaxed">
            Antes de cada sesión (si estás registrado) podrás decidir dos modalidades:
          </p>
        </div>

        {/* Tutor virtual */}
        <div className="flex flex-col gap-2">
          <span className="text-[14px] font-semibold text-ink">🤖 Tutor virtual</span>
          <p className="text-[14px] font-medium text-body leading-relaxed">
            Grabas tu respuesta y recibes corrección y orientación personalizada.
          </p>
        </div>

        {/* Autoevaluación */}
        <div className="flex flex-col gap-3">
          <span className="text-[14px] font-semibold text-ink">🟢 Autoevaluación</span>
          <p className="text-[14px] font-medium text-body leading-relaxed">
            Después de responder, indica si ha sido:
          </p>

          <div className="flex flex-col gap-2 pl-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full shrink-0 bg-success" />
              <span className="text-[14px] font-semibold text-ink">Dominado</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full shrink-0 bg-warn" />
              <span className="text-[14px] font-semibold text-ink">Casi</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full shrink-0 bg-danger" />
              <span className="text-[14px] font-semibold text-ink">Fallo</span>
            </div>
          </div>

          <p className="text-[14px] font-medium text-body leading-relaxed">
            La app adaptará las siguientes repeticiones según tu resultado.
          </p>
        </div>

        {/* Petición de feedback */}
        <p className="text-[13px] font-medium text-mute text-center pb-2">
          Por favor ayúdame a mejorar usando el{" "}
          <a
            href="https://forms.gle/aApWeQmSRG2iYagTA"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-500 hover:text-brand-700 transition-colors underline"
          >
            cuestionario de feedback
          </a>
          {" "}de la home.
        </p>

      </div>
    </main>
  );
}
