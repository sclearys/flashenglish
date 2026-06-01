"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cargarEstado, aplicarResultadoTest, marcarTestCompletado } from "@/lib/storage";
import { BLOQUES_ORDENADOS } from "@/lib/catalogo";
import {
  EstadoTest,
  ResultadoTest,
  iniciarTest,
  registrarRespuesta,
  testCompletado,
  calcularSiguienteFase,
  calcularResultado,
  getFraseTest,
  FraseTest,
} from "@/lib/testNivel";
import { AppState } from "@/lib/types";
import { leerFraseEnIngles, detenerAudio } from "@/lib/audio";
import {
  tieneReconocimientoVoz,
  iniciarReconocimiento,
  detenerReconocimiento,
} from "@/lib/reconocimiento";

type PantallaUI = "inicio" | "test" | "resultado";
type EstadoGrabacion = "idle" | "grabando" | "confirmando" | "evaluando" | "veredicto";
type VeredictoPosible = "correcto" | "casi" | "fallo";

// Expande contracciones inglesas comunes antes de comparar.
// Sin esto "I've" vs "I have" o "don't" vs "do not" fallan injustamente.
function expandirContracciones(s: string): string {
  return s
    .replace(/\bi've\b/gi, "i have")
    .replace(/\bi'm\b/gi, "i am")
    .replace(/\bi'll\b/gi, "i will")
    .replace(/\bi'd\b/gi, "i would")
    .replace(/\bhe's\b/gi, "he is")
    .replace(/\bshe's\b/gi, "she is")
    .replace(/\bit's\b/gi, "it is")
    .replace(/\bwe're\b/gi, "we are")
    .replace(/\bthey're\b/gi, "they are")
    .replace(/\byou're\b/gi, "you are")
    .replace(/\bwe've\b/gi, "we have")
    .replace(/\bthey've\b/gi, "they have")
    .replace(/\byou've\b/gi, "you have")
    .replace(/\bwe'll\b/gi, "we will")
    .replace(/\bthey'll\b/gi, "they will")
    .replace(/\byou'll\b/gi, "you will")
    .replace(/\bwon't\b/gi, "will not")
    .replace(/\bcan't\b/gi, "cannot")
    .replace(/\bdon't\b/gi, "do not")
    .replace(/\bdoesn't\b/gi, "does not")
    .replace(/\bdidn't\b/gi, "did not")
    .replace(/\bwouldn't\b/gi, "would not")
    .replace(/\bcouldn't\b/gi, "could not")
    .replace(/\bshouldn't\b/gi, "should not")
    .replace(/\bisn't\b/gi, "is not")
    .replace(/\baren't\b/gi, "are not")
    .replace(/\bwasn't\b/gi, "was not")
    .replace(/\bweren't\b/gi, "were not")
    .replace(/\bhasn't\b/gi, "has not")
    .replace(/\bhaven't\b/gi, "have not")
    .replace(/\bhadn't\b/gi, "had not")
    .replace(/\bthere's\b/gi, "there is")
    .replace(/\bthere're\b/gi, "there are");
}

// Algoritmo interno de comparación de texto (no usa API de Anthropic).
// Expande contracciones, normaliza y calcula qué porcentaje de las palabras
// esperadas aparece en lo que dijo el usuario.
function evaluarTextoInternamente(
  transcripcion: string,
  fraseCorrecta: string
): { veredicto: VeredictoPosible; sabe: boolean } {
  const normalizar = (s: string) =>
    expandirContracciones(s).toLowerCase().replace(/[^\w\s]/g, "").trim();
  const palabrasEsperadas = normalizar(fraseCorrecta).split(/\s+/);
  const palabrasUsuario = new Set(normalizar(transcripcion).split(/\s+/));
  const coincidencias = palabrasEsperadas.filter((p) =>
    palabrasUsuario.has(p)
  ).length;
  const ratio = coincidencias / palabrasEsperadas.length;

  if (ratio >= 0.85) return { veredicto: "correcto", sabe: true };
  if (ratio >= 0.6) return { veredicto: "casi", sabe: false };
  return { veredicto: "fallo", sabe: false };
}

export default function TestNivelInterno() {
  const router = useRouter();
  const [appState, setAppState] = useState<AppState | null>(null);
  const [pantallaUI, setPantallaUI] = useState<PantallaUI>("inicio");
  const [estadoTest, setEstadoTest] = useState<EstadoTest | null>(null);
  const [resultado, setResultado] = useState<ResultadoTest | null>(null);
  const [fraseActual, setFraseActual] = useState<FraseTest | null>(null);
  const [indiceFraseActual, setIndiceFraseActual] = useState(0);

  // ── Estado de la grabación ────────────────────────────────────────────────
  const [reconocimientoDisponible, setReconocimientoDisponible] = useState(false);
  const [estadoGrabacion, setEstadoGrabacion] = useState<EstadoGrabacion>("idle");
  const [transcripcionUsuario, setTranscripcionUsuario] = useState<string | null>(null);
  const [veredictoGrabacion, setVeredictoGrabacion] = useState<{
    veredicto: VeredictoPosible;
    sabe: boolean;
  } | null>(null);
  // Cuenta fallos de STT en la frase actual (se reinicia al avanzar de frase)
  const [intentosSTT, setIntentosSTT] = useState(0);
  // Cuando el STT falla 2 veces, el usuario puede cambiar al modo manual para el resto del test
  const [modoFallback, setModoFallback] = useState(false);
  // true cuando el STT acaba de fallar y estamos mostrando el mensaje de error
  const [errorSTT, setErrorSTT] = useState(false);

  useEffect(() => {
    setAppState(cargarEstado());
    setReconocimientoDisponible(tieneReconocimientoVoz());
  }, []);


  // Limpieza al salir
  useEffect(() => {
    return () => {
      detenerAudio();
      detenerReconocimiento();
    };
  }, []);

  if (!appState) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-body text-sm">Cargando...</p>
      </main>
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function empezarDesdeElPrincipio() {
    const nuevoEstado = aplicarResultadoTest(appState!, "BASIC1");
    marcarTestCompletado(nuevoEstado);
    router.push("/");
  }

  function empezarTest() {
    const estado = iniciarTest();
    setEstadoTest(estado);
    setIndiceFraseActual(0);
    setFraseActual(getFraseTest(estado.frasesActuales[0]));
    resetGrabacion();
    setPantallaUI("test");
  }

  function resetGrabacion() {
    setEstadoGrabacion("idle");
    setTranscripcionUsuario(null);
    setVeredictoGrabacion(null);
    setIntentosSTT(0);
    setErrorSTT(false);
    // modoFallback NO se resetea: si el usuario eligió modo manual, se mantiene hasta el final del test
  }

  function responder(sabe: boolean) {
    if (!estadoTest || !fraseActual) return;

    detenerAudio();
    resetGrabacion();

    const idActual = fraseActual.id;
    let nuevoEstado = registrarRespuesta(estadoTest, idActual, sabe);

    if (testCompletado(nuevoEstado)) {
      if (nuevoEstado.fase === "fase1") {
        nuevoEstado = calcularSiguienteFase(nuevoEstado);
        setEstadoTest(nuevoEstado);
        setIndiceFraseActual(0);
        setFraseActual(getFraseTest(nuevoEstado.frasesActuales[0]));
      } else {
        const res = calcularResultado(nuevoEstado);
        const nuevoAppState = aplicarResultadoTest(appState!, res.bloqueAsignado);
        setAppState(nuevoAppState);
        setResultado(res);
        setPantallaUI("resultado");
      }
    } else {
      const siguienteIndice = indiceFraseActual + 1;
      setEstadoTest(nuevoEstado);
      setIndiceFraseActual(siguienteIndice);
      setFraseActual(getFraseTest(nuevoEstado.frasesActuales[siguienteIndice]));
    }
  }

  function iniciarGrabacion() {
    if (estadoGrabacion !== "idle" || !fraseActual) return;
    setTranscripcionUsuario(null);
    setEstadoGrabacion("grabando");

    iniciarReconocimiento({
      lang: "en-US",
      onResult: (texto: string) => {
        setTranscripcionUsuario(texto);
        setEstadoGrabacion("confirmando");
      },
      onError: () => {
        setIntentosSTT((prev) => prev + 1);
        setEstadoGrabacion("idle");
        setErrorSTT(true);
      },
      onEnd: () => {
        // onResult u onError ya gestionaron el resultado
      },
    });
  }

  function evaluarTranscripcionTest() {
    if (!transcripcionUsuario?.trim() || !fraseActual) return;
    setEstadoGrabacion("evaluando");

    const { veredicto, sabe } = evaluarTextoInternamente(
      transcripcionUsuario,
      fraseActual.en
    );

    setVeredictoGrabacion({ veredicto, sabe });
    setEstadoGrabacion("veredicto");

    // Reproduce la frase correcta en inglés y avanza cuando termina.
    // El timeout de 5s es un seguro: algunos navegadores no lanzan onEnd fiablemente.
    let avanzado = false;
    const avanzar = () => {
      if (avanzado) return;
      avanzado = true;
      responder(sabe);
    };
    leerFraseEnIngles(fraseActual.en, avanzar);
    setTimeout(avanzar, 5000);
  }

  // ── Pantalla de inicio ────────────────────────────────────────────────────

  if (pantallaUI === "inicio") {
    return (
      <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
          <div className="flex flex-col gap-3">
            <h1 className="text-[26px] font-semibold text-ink leading-tight">
              Encuentra tu punto de partida
            </h1>
            <p className="text-sm text-mute leading-relaxed">
              Vamos a mostrarte unas frases. Dílas en inglés en voz alta. El test
              dura unos 2 minutos.
            </p>
            <p className="text-sm font-medium text-body">
              Dirás las frases en voz alta. Prepara el micrófono.
            </p>
          </div>

          <button
            onClick={empezarTest}
            className="w-full h-12 rounded-md bg-brand-500 text-white text-sm font-semibold hover:brightness-95 transition-all"
          >
            Empezar el test
          </button>

          <button
            onClick={empezarDesdeElPrincipio}
            className="text-sm font-medium text-mute hover:text-ink transition-colors"
          >
            Prefiero empezar desde el principio
          </button>
        </div>
      </main>
    );
  }

  // ── Pantalla de resultado ─────────────────────────────────────────────────

  if (pantallaUI === "resultado" && resultado) {
    const bloqueInfo = BLOQUES_ORDENADOS.find(
      (b) => b.codigo === resultado.bloqueAsignado
    );
    const siguienteBloque = BLOQUES_ORDENADOS.find(
      (b) =>
        b.orden ===
        (BLOQUES_ORDENADOS.find((x) => x.codigo === resultado.bloqueAsignado)
          ?.orden ?? 0) +
          1
    );

    return (
      <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
          <div className="flex flex-col gap-3">
            <h1 className="text-[24px] font-semibold text-ink leading-tight">
              Hemos encontrado tu punto de partida.
            </h1>

            <p className="text-[18px] font-semibold text-ink">
              Comenzarás en {bloqueInfo?.nombre ?? resultado.bloqueAsignado}.
            </p>

            {resultado.esCasoExtremo && resultado.bloqueAsignado === "ADV2" ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-mute leading-relaxed">
                  Dominas un nivel alto de inglés. Comenzarás en el bloque más
                  avanzado del catálogo.
                </p>
                <p className="text-sm text-mute leading-relaxed">
                  Este será tu mayor reto.
                </p>
              </div>
            ) : resultado.esCasoExtremo && resultado.bloqueAsignado === "BASIC1" ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-mute leading-relaxed">
                  Vamos a empezar por el principio, que es el mejor sitio para
                  construir una base sólida.
                </p>
                <p className="text-sm text-mute leading-relaxed">
                  Las primeras frases son cortas y directas. Las dominarás antes
                  de lo que crees.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-mute leading-relaxed">
                  Ya dominas gran parte de los bloques anteriores. Este es el
                  mejor punto para avanzar con fluidez.
                </p>
                {siguienteBloque && (
                  <p className="text-sm text-mute leading-relaxed">
                    Tu siguiente reto será {siguienteBloque.nombre}.
                  </p>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => {
              marcarTestCompletado(appState!);
              router.push("/");
            }}
            className="w-full h-12 rounded-md bg-brand-500 text-white text-sm font-semibold hover:brightness-95 transition-all"
          >
            Empezar a entrenar
          </button>
        </div>
      </main>
    );
  }

  // ── Pantalla de test ──────────────────────────────────────────────────────

  if (!fraseActual) return null;

  const progresoDots = estadoTest!.frasesActuales.map((id) => id in estadoTest!.respuestas);

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
        {/* Indicador visual sin cifras: puntos */}
        <div className="flex gap-[5px] items-center">
          {progresoDots.map((hecho, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full transition-all ${
                hecho
                  ? "bg-brand-500"
                  : i === indiceFraseActual
                  ? "bg-brand-300"
                  : "bg-brand-100"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Tarjeta español */}
      <div
        key={fraseActual.id}
        className="w-full max-w-sm bg-brand-50 rounded-lg px-[14px] py-[22px] min-h-[120px] flex flex-col gap-2 mb-6 animate-slide-in"
      >
        <span className="text-eyebrow font-semibold uppercase text-mute">
          Tradúcelo en voz alta
        </span>
        <p className="text-[18px] font-semibold text-body leading-snug">
          {fraseActual.es}
        </p>
      </div>

      {/* ── Controles de grabación ─────────────────────────────────────────── */}

      <div className="w-full max-w-sm flex flex-col items-center">

        {/* VEREDICTO: resultado visible 1.5s antes del auto-avance */}
        {estadoGrabacion === "veredicto" && veredictoGrabacion && (
          <div className="w-full flex flex-col gap-3">
            {veredictoGrabacion.veredicto === "correcto" && (
              <div className="w-full bg-success/10 border border-success/20 rounded-xl px-4 py-4 flex items-center gap-3">
                <span className="text-2xl leading-none">✅</span>
                <span className="text-base font-bold text-success">Bien dicho</span>
              </div>
            )}
            {veredictoGrabacion.veredicto === "casi" && (
              <div className="w-full rounded-xl px-4 py-4 flex items-center gap-3" style={{ backgroundColor: "#FFF8E7", border: "1px solid #FFC85760" }}>
                <span className="text-2xl leading-none">〜</span>
                <span className="text-base font-bold" style={{ color: "#5C3F00" }}>Casi</span>
              </div>
            )}
            {veredictoGrabacion.veredicto === "fallo" && (
              <div className="w-full bg-danger/10 border border-danger/20 rounded-xl px-4 py-4 flex items-center gap-3">
                <span className="text-2xl leading-none">✗</span>
                <span className="text-base font-bold text-danger">Esta frase la practicaremos hasta que la domines</span>
              </div>
            )}
            {/* Frase correcta en EN: referencia discreta, sin protagonismo */}
            <p className="text-sm text-mute text-center leading-snug px-2">
              {fraseActual.en}
            </p>
          </div>
        )}

        {/* EVALUANDO: spinner muy breve (evaluación local < 100ms) */}
        {estadoGrabacion === "evaluando" && (
          <div className="flex flex-col items-center gap-2 mt-2">
            <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* CONFIRMANDO: transcripción editable + Evaluar + Repetir */}
        {estadoGrabacion === "confirmando" && transcripcionUsuario !== null && (
          <div className="w-full flex flex-col gap-3">
            <div className="rounded-xl border border-surface bg-[#FAFAF8] px-4 py-3 flex flex-col gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-mute">
                Dijiste
              </span>
              <textarea
                value={transcripcionUsuario}
                onChange={(e) => setTranscripcionUsuario(e.target.value)}
                className="w-full text-[18px] font-medium italic text-ink bg-transparent outline-none resize-none leading-snug border-b border-brand-500 pb-1"
                rows={2}
                spellCheck={false}
                autoFocus
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-mute">✏ Toca para corregir</span>
                <button
                  onClick={() => {
                    setEstadoGrabacion("idle");
                    setTranscripcionUsuario(null);
                  }}
                  className="text-[11px] font-medium text-body bg-surface rounded-full px-3 py-1 hover:bg-brand-50 transition-colors"
                >
                  ↺ Repetir
                </button>
              </div>
            </div>
            <button
              onClick={evaluarTranscripcionTest}
              disabled={!transcripcionUsuario.trim()}
              className="w-full h-12 rounded-md bg-brand-500 text-white text-sm font-semibold hover:brightness-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Evaluar
            </button>
          </div>
        )}

        {/* GRABANDO: botón rojo pulsando */}
        {estadoGrabacion === "grabando" && (
          <div className="flex flex-col items-center gap-4 mt-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
              <span className="text-sm font-semibold text-danger">Grabando…</span>
            </div>
            <button
              onClick={detenerReconocimiento}
              className="w-[72px] h-[72px] rounded-full bg-danger text-white flex items-center justify-center shadow-[0_4px_16px_rgba(199,62,42,0.35)] animate-pulse active:scale-95 transition-all select-none"
              aria-label="Terminar grabación"
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </button>
            <span className="text-[11px] font-semibold text-danger uppercase tracking-widest">
              Pulsa para terminar
            </span>
          </div>
        )}

        {/* IDLE: micrófono, error de STT, o modo fallback manual */}
        {estadoGrabacion === "idle" && !modoFallback && (
          <div className="flex flex-col items-center gap-4 mt-2">
            {!reconocimientoDisponible ? (
              <p className="text-sm text-mute text-center leading-snug">
                Tu navegador no soporta grabación de voz.<br />
                Usa Chrome o Edge para el test oral.
              </p>
            ) : errorSTT ? (
              // Error de STT: mensaje + reintentar (y opción de fallback tras 2 intentos)
              <div className="w-full flex flex-col items-center gap-3">
                <p className="text-sm text-body text-center leading-snug">
                  {intentosSTT >= 2
                    ? "Sigue sin funcionar el micrófono. ¿Prefieres continuar sin grabación?"
                    : "No he captado tu voz. ¿Lo intentamos de nuevo?"}
                </p>
                <button
                  onClick={() => {
                    setErrorSTT(false);
                    iniciarGrabacion();
                  }}
                  className="w-full h-12 rounded-md bg-brand-500 text-white text-sm font-semibold hover:brightness-95 transition-all"
                >
                  Reintentar
                </button>
                {intentosSTT >= 2 && (
                  <button
                    onClick={() => {
                      setModoFallback(true);
                      setErrorSTT(false);
                    }}
                    className="text-sm font-semibold text-brand-500 hover:text-brand-700 transition-colors text-center"
                  >
                    Continuar sin grabación
                  </button>
                )}
              </div>
            ) : (
              // Estado normal: botón de micrófono
              <>
                <p className="text-sm text-body text-center leading-snug">
                  Pulsa el botón y di la frase en inglés
                </p>
                <button
                  onClick={iniciarGrabacion}
                  className="w-[72px] h-[72px] rounded-full bg-brand-500 text-white flex items-center justify-center shadow-[0_4px_16px_rgba(255,122,69,0.35)] hover:brightness-95 active:scale-95 transition-all select-none"
                  aria-label="Grabar respuesta"
                >
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                </button>
                <span className="text-[11px] font-semibold text-mute uppercase tracking-widest">
                  Pulsa para grabar
                </span>
              </>
            )}
          </div>
        )}

        {/* FALLBACK MANUAL: el STT falló 2 veces y el usuario eligió autoevaluarse */}
        {modoFallback && (
          <div className="w-full flex flex-col gap-3 mt-2">
            <p className="text-sm text-mute text-center">¿Lo sabías?</p>
            <div className="grid grid-cols-2 gap-[7px]">
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
          </div>
        )}
      </div>
    </main>
  );
}
