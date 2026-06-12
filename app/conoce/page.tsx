import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import Link from "next/link";
import s from "./conoce.module.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
});

export const metadata: Metadata = {
  title: "GoToEnglish · Habla, no traduzcas",
  description:
    "Entrena el circuito oral que tu cerebro necesita para producir inglés sin traducir. 10 minutos al día, repetición espaciada, 100% oral.",
};

export default function Conoce() {
  return (
    <div className={`${dmSans.className} ${s.page}`}>

      {/* HERO */}
      <section className={s.hero}>
        <p className={s.heroEyebrow}>GoToEnglish</p>
        <h1 className={s.heroH1}>
          ¿Entiendes inglés<br />pero te cuesta <em>hablarlo?</em>
        </h1>
        <p className={s.heroP}>
          No es falta de vocabulario. Es que tu cerebro nunca ha practicado el circuito correcto.
        </p>
      </section>

      {/* CEREBRO */}
      <section className={s.brainSection}>
        <p className={s.sectionLabel}>La neurociencia explica</p>
        <h2>Tu cerebro tiene dos tipos de memoria.</h2>
        <p>
          Una te permite <em>reconocer</em> el inglés cuando lo lees o escuchas.
          La otra es la que necesitas para <strong>producirlo</strong> sin pensar —
          la que activa tus palabras antes de que tu mente &ldquo;traduzca&rdquo;.
        </p>
        <p>
          La mayoría de apps entrenan solo la primera. GoToEnglish entrena la segunda:
          el circuito oral que tu <span className={s.highlightPill}>hipocampo</span> necesita
          repetir para automatizar.
        </p>
      </section>

      {/* MECÁNICA */}
      <section className={s.mechanicSection}>
        <p className={s.sectionLabel}>Así funciona</p>
        <h2>10 minutos al día.<br />Un circuito completo.</h2>
        <p className={s.mechanicSub}>
          Cada tarjeta activa el mismo ciclo que usa el cerebro para consolidar memoria a largo plazo.
        </p>

        {/* Fake phone mockup */}
        <div className={s.phoneWrap}>
          <div className={s.phone}>
            <div className={s.phoneNotch}></div>

            <div className={s.phraseCard}>
              <div className={s.phraseLabel}>Di esto en inglés</div>
              <div className={s.phraseEs}>Me hubiera gustado llegar antes</div>
            </div>

            <div className={s.micRow}>
              <div className={s.micIcon}>
                <svg viewBox="0 0 24 24">
                  <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1 17.93V21h2v-2.07A8 8 0 0 0 20 11h-2a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.93z" />
                </svg>
              </div>
              <div className={s.micText}>
                <strong>Escuchando...</strong>
                I wish I had arrived earlier
              </div>
            </div>

            <div className={s.answerCard}>
              <div className={s.answerEn}>I wish I had arrived earlier</div>
              <div className={s.answerAudio}>🔊 Escucha el modelo correcto</div>
            </div>

            <div className={s.evalRow}>
              <div className={`${s.evalBtn} ${s.evalBtnDominado}`}>✓ Dominado</div>
              <div className={`${s.evalBtn} ${s.evalBtnCasi}`}>≈ Casi</div>
              <div className={`${s.evalBtn} ${s.evalBtnFallo}`}>✗ Fallo</div>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className={s.steps}>
          <div className={s.step}>
            <div className={s.stepNum}>1</div>
            <div className={s.stepContent}>
              <h3>Ves la frase en español</h3>
              <p>Tu cerebro activa la búsqueda — el hipocampo empieza a trabajar.</p>
            </div>
          </div>
          <div className={s.step}>
            <div className={s.stepNum}>2</div>
            <div className={s.stepContent}>
              <h3>La dices en voz alta</h3>
              <p>Producción oral real. El área de Broca crea la ruta que la lectura nunca crea.</p>
            </div>
          </div>
          <div className={s.step}>
            <div className={s.stepNum}>3</div>
            <div className={s.stepContent}>
              <h3>Escuchas el modelo correcto</h3>
              <p>Corrección inmediata. Tu memoria auditiva refuerza o corrige el patrón.</p>
            </div>
          </div>
          <div className={s.step}>
            <div className={s.stepNum}>4</div>
            <div className={s.stepContent}>
              <h3>Un algoritmo decide cuándo repetirla</h3>
              <p>
                Te evalúa el tutor virtual o te autoevalúas con honestidad. Esa respuesta
                alimenta un sistema de repetición espaciada: si la dominaste, tardará más en
                volver; si fallaste, vuelve antes — justo el ritmo que tu memoria a largo
                plazo necesita.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* QUOTE */}
      <section className={s.quoteSection}>
        <div className={s.quoteMark}>&ldquo;</div>
        <p className={s.quoteText}>
          Cada frase que dices en voz alta crea una ruta neural que la lectura sola nunca crea.
        </p>
        <p className={s.quoteAuthor}>Repetición espaciada · Producción oral · Memoria a largo plazo</p>
      </section>

      {/* DATOS */}
      <section className={s.dataSection}>
        <p className={s.dataSectionLabel}>El método</p>
        <h2>No es vocabulario.<br />Es automatización.</h2>
        <p className={s.dataIntro}>
          La repetición espaciada es el sistema de estudio más respaldado por la neurociencia.
          GoToEnglish lo aplica a la producción oral.
        </p>

        <div className={s.statGrid}>
          <div className={s.statCard}>
            <div className={s.statNumber}>10&apos;</div>
            <div className={s.statLabel}>al día es suficiente para construir el hábito</div>
          </div>
          <div className={s.statCard}>
            <div className={s.statNumber}>4×</div>
            <div className={s.statLabel}>más retención con repetición espaciada vs estudio masivo</div>
          </div>
          <div className={s.statCard}>
            <div className={s.statNumber}>100%</div>
            <div className={s.statLabel}>oral — no hay texto para escribir, solo para hablar</div>
          </div>
          <div className={s.statCard}>
            <div className={s.statNumber}>0€</div>
            <div className={s.statLabel}>gratis para empezar, sin tarjeta</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={s.ctaSection}>
        <h2>Empieza a <em>hablar</em>,<br />no a traducir.</h2>
        <p>5 minutos para hacer el test de nivel y empezar tu primera sesión. Sin descargas, desde el móvil.</p>
        <Link href="/" className={s.ctaBtn}>
          Empieza aquí →
        </Link>
        <p className={s.ctaSub}>Gratis · Sin instalación</p>
      </section>

    </div>
  );
}
