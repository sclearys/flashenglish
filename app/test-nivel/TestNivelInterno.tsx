"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cargarEstado, aplicarResultadoTest } from "@/lib/storage";
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

type PantallaUI = "inicio" | "test" | "resultado";

export default function TestNivelInterno() {
  const router = useRouter();
  const [appState, setAppState] = useState<AppState | null>(null);
  const [pantallaUI, setPantallaUI] = useState<PantallaUI>("inicio");
  const [estadoTest, setEstadoTest] = useState<EstadoTest | null>(null);
  const [resultado, setResultado] = useState<ResultadoTest | null>(null);
  const [fraseActual, setFraseActual] = useState<FraseTest | null>(null);
  const [indiceFraseActual, setIndiceFraseActual] = useState(0);

  useEffect(() => {
    setAppState(cargarEstado());
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
    aplicarResultadoTest(appState!, "BASIC1");
    router.push("/");
  }

  function empezarTest() {
    const estado = iniciarTest();
    setEstadoTest(estado);
    setIndiceFraseActual(0);
    setFraseActual(getFraseTest(estado.frasesActuales[0]));
    setPantallaUI("test");
  }

  function responder(sabe: boolean) {
    if (!estadoTest || !fraseActual) return;

    const idActual = fraseActual.id;
    let nuevoEstado = registrarRespuesta(estadoTest, idActual, sabe);

    if (testCompletado(nuevoEstado)) {
      if (nuevoEstado.fase === "fase1") {
        nuevoEstado = calcularSiguienteFase(nuevoEstado);
        setEstadoTest(nuevoEstado);
        setIndiceFraseActual(0);
        setFraseActual(getFraseTest(nuevoEstado.frasesActuales[0]));
      } else {
        // fase2 completada → calcular resultado
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
              Vamos a mostrarte unas frases. Di si las sabes o no. El test dura
              unos 2 minutos y no hay trampa: cuanto más honesto seas, mejor el
              resultado.
            </p>
          </div>

          <button
            onClick={empezarTest}
            className="w-full h-12 rounded-md bg-brand-500 text-white text-sm font-semibold hover:brightness-95 transition-all"
          >
            Empezar
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
            onClick={() => router.push("/")}
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

      {/* Tarjeta */}
      <div key={fraseActual.id} className="w-full flex flex-col items-center animate-slide-in">
        <div className="w-full max-w-sm bg-brand-50 rounded-lg px-[14px] py-[22px] min-h-[120px] flex flex-col gap-2 mb-6">
          <span className="text-eyebrow font-semibold uppercase text-mute">
            ¿Lo sabes?
          </span>
          <p className="text-[18px] font-semibold text-body leading-snug">
            {fraseActual.es}
          </p>
        </div>

        <div className="w-full max-w-sm grid grid-cols-2 gap-[7px]">
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
    </main>
  );
}
