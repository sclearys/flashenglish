"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  cargarEstado,
  guardarEstado,
  obtenerPerfilActivo,
  actualizarPerfilActivo,
  avanzarBloqueActivo,
} from "@/lib/storage";
import { porcentajeBloque, BLOQUES_ORDENADOS, temasGrandesPorFrase } from "@/lib/catalogo";
import { construirSesion, construirSesionRefuerzo, obtenerFrasePorId } from "@/lib/sesion";
import { evaluarFrase, avanzarPunterosAlTerminar, actualizarRacha } from "@/lib/aprendizaje";
import { temasARepasar } from "@/lib/stats";
import { AppState, Frase, ResultadoEval, SesionEnCurso } from "@/lib/types";
import FeedbackFallo from "@/components/FeedbackFallo";
import { leerFraseEnIngles, detenerAudio, tieneWebSpeech } from "@/lib/audio";
import { track } from "@vercel/analytics";

type Pantalla = "tarjeta" | "feedback";

interface DatosFeedback {
  resultado: ResultadoEval;
  frase: Frase;
}

export default function SesionInterna() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [estado, setEstado] = useState<AppState | null>(null);
  const [sesion, setSesion] = useState<SesionEnCurso | null>(null);
  const [revelada, setRevelada] = useState(false);
  const [pantalla, setPantalla] = useState<Pantalla>("tarjeta");
  const [datosFeedback, setDatosFeedback] = useState<DatosFeedback | null>(null);
  const [animandoPerfecto, setAnimandoPerfecto] = useState(false);
  // Snapshot del estado justo antes de la última evaluación (permite deshacer)
  const [snapshotAnterior, setSnapshotAnterior] = useState<{
    estado: AppState;
    sesion: SesionEnCurso;
  } | null>(null);

  // Soporte de Web Speech API — se detecta en cliente, nunca en SSR
  const [speechDisponible, setSpeechDisponible] = useState(false);
  useEffect(() => {
    setSpeechDisponible(tieneWebSpeech());
  }, []);

  // Leer la respuesta en inglés automáticamente al revelar (y también al retroceder)
  useEffect(() => {
    if (!sesion || !revelada) return;
    const fraseId = sesion.frases_ids[sesion.indice_actual];
    const frase = obtenerFrasePorId(fraseId);
    if (frase) leerFraseEnIngles(frase.en);
  // sesion.indice_actual + revelada cubren todos los casos: revelar, retroceder, avanzar
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesion?.indice_actual, revelada]);

  // Detener audio al salir de la pantalla de sesión
  useEffect(() => {
    return () => { detenerAudio(); };
  }, []);

  useEffect(() => {
    const estadoCargado = cargarEstado();
    const perfil = obtenerPerfilActivo(estadoCargado);
    const bloqueAlIniciar = perfil.bloque_activo;
    const forzarNueva = searchParams.get("nueva") === "1";
    const tamanyoParam = parseInt(searchParams.get("frases") ?? "15", 10);
    const tamanyoSesion = [10, 15, 20, 25].includes(tamanyoParam) ? tamanyoParam : 15;

    // Detectar si es una sesión de refuerzo
    const tipoParam = searchParams.get("tipo");
    const temaParam = searchParams.get("tema") ?? "";
    const esRefuerzo = tipoParam === "refuerzo";

    // Guard de sesión guardada: criterio distinto según el modo
    const sesionGuardadaValida =
      !forzarNueva &&
      perfil.sesion_en_curso &&
      perfil.sesion_en_curso.frases_ids.length > 0 &&
      (esRefuerzo
        ? perfil.sesion_en_curso.tipo === "refuerzo" &&
          perfil.sesion_en_curso.temaId === temaParam
        : perfil.sesion_en_curso.frases_ids[0].startsWith(perfil.bloque_activo + "-"));

    const sesionActiva = sesionGuardadaValida
      ? perfil.sesion_en_curso!
      : esRefuerzo
      ? construirSesionRefuerzo(perfil, temaParam, tamanyoSesion)
      : construirSesion(perfil, tamanyoSesion);

    // Sesión vacía
    if (sesionActiva.frases_ids.length === 0) {
      if (esRefuerzo) {
        // Sin frases de refuerzo disponibles — volver a Mi trayectoria
        router.push("/mi-trayectoria");
        return;
      }
      // Punto A (bloque): sesión vacía — puede ser bloque al 100% o sin frases disponibles hoy
      const pct = porcentajeBloque(perfil, bloqueAlIniciar);
      const hayBloqueSiguiente =
        BLOQUES_ORDENADOS.findIndex((b) => b.codigo === bloqueAlIniciar) <
        BLOQUES_ORDENADOS.length - 1;
      if (pct >= 100 && hayBloqueSiguiente) {
        const perfilSinSesion = { ...perfil, sesion_en_curso: null };
        const estadoSinSesion = actualizarPerfilActivo(estadoCargado, perfilSinSesion);
        avanzarBloqueActivo(estadoSinSesion);
        router.push(`/fin-de-bloque?bloque=${bloqueAlIniciar}`);
        return;
      }
      router.push("/");
      return;
    }

    const perfilActualizado = { ...perfil, sesion_en_curso: sesionActiva };
    const estadoActualizado = actualizarPerfilActivo(estadoCargado, perfilActualizado);
    guardarEstado(estadoActualizado);
    setEstado(estadoActualizado);
    setSesion(sesionActiva);
    track("sesion_iniciada", { perfil: perfil.nombre, bloque: perfil.bloque_activo });
  }, [searchParams, router]);

  const terminarSesion = useCallback(
    (estadoFinal: AppState, sesionFinal: SesionEnCurso) => {
      const perfilActual = obtenerPerfilActivo(estadoFinal);
      const esRefuerzo = sesionFinal.tipo === "refuerzo";

      if (esRefuerzo) {
        // ── Modo refuerzo: solo actualiza racha; no toca punteros ni progreso_frases ──
        const racha = actualizarRacha(perfilActual);
        const perfilTerminado = {
          ...perfilActual,
          racha_dias: racha.racha_dias,
          ultima_sesion_fecha: racha.ultima_sesion_fecha,
          sesion_en_curso: null,
        };
        const estadoTerminado = actualizarPerfilActivo(estadoFinal, perfilTerminado);
        guardarEstado(estadoTerminado);

        const temaId = sesionFinal.temaId ?? "";
        const hayFallo = sesionFinal.respuestas.some((r) => r.resultado === "incorrecto");

        const resumen = {
          total: sesionFinal.frases_ids.length,
          respuestas: sesionFinal.respuestas,
          frases_aprendidas: 0,
          en_repaso_manana: 0,
          tipo: "refuerzo",
          tema: temaId,
          tamano: sesionFinal.frases_ids.length,
          temas_repasar: temasARepasar(sesionFinal.respuestas, obtenerFrasePorId),
        };

        localStorage.setItem("flashenglish.resumen", JSON.stringify(resumen));

        if (!hayFallo) {
          router.push(
            `/refuerzo-perfecto?tema=${encodeURIComponent(temaId)}&total=${sesionFinal.frases_ids.length}`
          );
        } else {
          router.push("/resumen");
        }
        return;
      }

      // ── Modo bloque: lógica original ──────────────────────────────────────────
      const bloqueCompletado = perfilActual.bloque_activo;

      const punteroAntes = perfilActual.puntero_frase_nueva[bloqueCompletado] ?? 0;
      const enRepasoAntes = Object.keys(perfilActual.progreso_frases).filter(
        (id) => id.startsWith(bloqueCompletado + "-")
      ).length;
      const aprendidasAntes = Math.max(0, punteroAntes - enRepasoAntes);
      const porcentajeAntes = porcentajeBloque(perfilActual, bloqueCompletado);

      const punterosActualizados = avanzarPunterosAlTerminar(perfilActual, sesionFinal);
      const racha = actualizarRacha(perfilActual);
      const perfilTerminado = {
        ...perfilActual,
        puntero_frase_nueva: punterosActualizados,
        racha_dias: racha.racha_dias,
        ultima_sesion_fecha: racha.ultima_sesion_fecha,
        sesion_en_curso: null,
      };
      const estadoTerminado = actualizarPerfilActivo(estadoFinal, perfilTerminado);
      guardarEstado(estadoTerminado);

      const perfilFinal = obtenerPerfilActivo(estadoTerminado);
      const nuevasPerfectas = sesionFinal.respuestas.filter(
        (r) => r.resultado === "perfecto" && !sesionFinal.ids_repaso.includes(r.id)
      ).length;
      const repasoCompletadas = (sesionFinal.ids_repaso ?? []).filter(
        (id) => !(id in perfilFinal.progreso_frases)
      ).length;
      const frasesAprendidas = nuevasPerfectas + repasoCompletadas;
      const enRepasoManana = Object.keys(perfilFinal.progreso_frases).length;

      const punteroDespues = perfilFinal.puntero_frase_nueva[bloqueCompletado] ?? 0;
      const enRepasoDespues = Object.keys(perfilFinal.progreso_frases).filter(
        (id) => id.startsWith(bloqueCompletado + "-")
      ).length;
      const aprendidasDespues = Math.max(0, punteroDespues - enRepasoDespues);
      const porcentajeDespues = porcentajeBloque(perfilFinal, bloqueCompletado);

      const temasEnSesion = new Set<string>();
      for (const fraseId of sesionFinal.frases_ids) {
        for (const tema of (temasGrandesPorFrase.get(fraseId) ?? [])) {
          temasEnSesion.add(tema);
        }
      }

      const resumen = {
        total: sesionFinal.frases_ids.length,
        respuestas: sesionFinal.respuestas,
        frases_aprendidas: frasesAprendidas,
        en_repaso_manana: enRepasoManana,
        bloque: bloqueCompletado,
        aprendidas_antes: aprendidasAntes,
        aprendidas_despues: aprendidasDespues,
        porcentaje_antes: porcentajeAntes,
        porcentaje_despues: porcentajeDespues,
        temas_sesion: Array.from(temasEnSesion),
        temas_repasar: temasARepasar(sesionFinal.respuestas, obtenerFrasePorId),
      };

      const pct = porcentajeBloque(perfilFinal, bloqueCompletado);
      const hayBloqueSiguiente =
        BLOQUES_ORDENADOS.findIndex((b) => b.codigo === bloqueCompletado) <
        BLOQUES_ORDENADOS.length - 1;

      if (pct >= 100 && hayBloqueSiguiente) {
        avanzarBloqueActivo(estadoTerminado);
        localStorage.setItem("flashenglish.resumen", JSON.stringify(resumen));
        router.push(`/fin-de-bloque?bloque=${bloqueCompletado}`);
        return;
      }

      localStorage.setItem("flashenglish.resumen", JSON.stringify(resumen));
      router.push("/resumen");
    },
    [router]
  );

  const avanzarTarjeta = useCallback(
    (estadoActual: AppState, sesionActual: SesionEnCurso) => {
      detenerAudio();
      const siguienteIndice = sesionActual.indice_actual + 1;

      if (siguienteIndice >= sesionActual.frases_ids.length) {
        terminarSesion(estadoActual, sesionActual);
      } else {
        const sesionAvanzada = { ...sesionActual, indice_actual: siguienteIndice };
        const perfilActual = obtenerPerfilActivo(estadoActual);
        const perfilConSesion = { ...perfilActual, sesion_en_curso: sesionAvanzada };
        const estadoAvanzado = actualizarPerfilActivo(estadoActual, perfilConSesion);
        guardarEstado(estadoAvanzado);
        setEstado(estadoAvanzado);
        setSesion(sesionAvanzada);
        setRevelada(false);
        setPantalla("tarjeta");
        setDatosFeedback(null);
      }
    },
    [terminarSesion]
  );

  function retrocederTarjeta() {
    if (!estado || !sesion || !snapshotAnterior) return;
    guardarEstado(snapshotAnterior.estado);
    setEstado(snapshotAnterior.estado);
    setSesion(snapshotAnterior.sesion);
    setSnapshotAnterior(null);
    setRevelada(true);
    setPantalla("tarjeta");
    setAnimandoPerfecto(false);
  }

  function manejarEvaluacion(resultado: ResultadoEval) {
    if (!estado || !sesion) return;

    setSnapshotAnterior({ estado, sesion });

    const perfil = obtenerPerfilActivo(estado);
    const fraseId = sesion.frases_ids[sesion.indice_actual];
    const fraseActual = obtenerFrasePorId(fraseId);
    const esRefuerzo = sesion.tipo === "refuerzo";

    let perfilActualizado: typeof perfil;
    if (esRefuerzo) {
      // Refuerzo: no tocar progreso_frases; solo sumar aciertos si fue perfecto
      perfilActualizado =
        resultado === "perfecto"
          ? { ...perfil, aciertos_totales: perfil.aciertos_totales + 1 }
          : perfil;
    } else {
      perfilActualizado = evaluarFrase(perfil, fraseId, resultado, sesion);
    }

    const sesionConRespuesta: SesionEnCurso = {
      ...sesion,
      respuestas: [...sesion.respuestas, { id: fraseId, resultado }],
    };

    const perfilConSesion = { ...perfilActualizado, sesion_en_curso: sesionConRespuesta };
    const estadoActualizado = actualizarPerfilActivo(estado, perfilConSesion);
    guardarEstado(estadoActualizado);
    setEstado(estadoActualizado);
    setSesion(sesionConRespuesta);

    if (resultado === "perfecto") {
      setAnimandoPerfecto(true);
      setTimeout(() => {
        setAnimandoPerfecto(false);
        avanzarTarjeta(estadoActualizado, sesionConRespuesta);
      }, 250);
    } else {
      setDatosFeedback({ resultado, frase: fraseActual! });
      setPantalla("feedback");
    }
  }

  if (!estado || !sesion) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-body text-sm">Cargando...</p>
      </main>
    );
  }

  const perfil = obtenerPerfilActivo(estado);
  const totalFrases = sesion.frases_ids.length;
  const indice = sesion.indice_actual;
  const fraseActualId = sesion.frases_ids[indice];
  const fraseActual: Frase | undefined = obtenerFrasePorId(fraseActualId);
  const porcentaje = totalFrases > 0 ? Math.round((indice / totalFrases) * 100) : 0;
  const esRefuerzo = sesion.tipo === "refuerzo";

  if (!fraseActual) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-body text-sm">No hay frases disponibles.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-10">

      {/* Cabecera */}
      <div className="w-full max-w-sm flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => esRefuerzo ? router.push("/mi-trayectoria") : router.push("/")}
            className="text-sm font-semibold text-brand-500 hover:text-brand-700 transition-colors"
          >
            ← Salir
          </button>
          <span className="font-sans font-medium text-sm text-ink tabular-nums">
            🔥 {perfil.racha_dias} {perfil.racha_dias === 1 ? "día" : "días"}
          </span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="font-sans font-medium text-sm text-ink tabular-nums">
            {indice + 1} / {totalFrases}
          </span>
          {/* Chip de modo refuerzo con el nombre del tema */}
          {esRefuerzo && sesion.temaId && (
            <span className="text-[10px] font-semibold text-brand-500 bg-brand-50 rounded-full px-2 py-0.5 leading-none">
              Refuerzo · {sesion.temaId}
            </span>
          )}
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="w-full max-w-sm flex gap-[3px] mb-10">
        <div
          className="h-1 rounded-full bg-brand-500 transition-all duration-[400ms] ease-out"
          style={{ width: `${Math.max(porcentaje, 2)}%` }}
        />
        <div className="h-1 rounded-full bg-brand-100 flex-1" />
      </div>

      {pantalla === "feedback" && datosFeedback ? (
        <FeedbackFallo
          fraseEspanol={datosFeedback.frase.es}
          traduccionIngles={datosFeedback.frase.en}
          temasGramaticales={datosFeedback.frase.temas_gramaticales}
          resultado={datosFeedback.resultado}
          onContinuar={() => avanzarTarjeta(estado, sesion)}
        />
      ) : (
        <div key={fraseActualId} className="w-full flex flex-col items-center animate-slide-in">
          <div className={`w-full max-w-sm bg-brand-50 rounded-lg px-[14px] py-[22px] min-h-[120px] flex flex-col gap-2 mb-3 ${animandoPerfecto ? "animate-scale-perfecto" : ""}`}>
            <span className="text-eyebrow font-semibold uppercase text-mute">Tradúcelo en voz alta</span>
            <p className="text-[18px] font-semibold text-body leading-snug">{fraseActual.es}</p>
          </div>

          {revelada && (
            <div className={`w-full max-w-sm bg-brand-100 rounded-lg px-[14px] py-[18px] border border-brand-500/20 flex flex-col gap-2 mb-6 ${animandoPerfecto ? "animate-scale-perfecto" : ""}`}>
              <span className="text-eyebrow font-semibold uppercase text-brand-700">ENGLISH</span>
              <div className="flex items-center gap-2">
                <p className="text-[18px] font-semibold text-ink leading-snug flex-1">
                  {fraseActual.en}
                </p>
                {speechDisponible && (
                  <button
                    onClick={() => leerFraseEnIngles(fraseActual.en)}
                    className="shrink-0 text-mute hover:text-ink transition-colors"
                    aria-label="Escuchar pronunciación"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    </svg>
                  </button>
                )}
              </div>
              {!speechDisponible && (
                <p className="text-[13px] font-normal text-mute">
                  Tu navegador no reproduce audio
                </p>
              )}
            </div>
          )}

          {!revelada ? (
            <button
              onClick={() => setRevelada(true)}
              className="w-full max-w-sm h-12 rounded-md bg-brand-500 text-white text-sm font-semibold hover:brightness-95 transition-all mt-3"
            >
              Revelar
            </button>
          ) : (
            <div className={`w-full max-w-sm grid gap-[7px] ${snapshotAnterior ? "grid-cols-4" : "grid-cols-3"}`}>
              {snapshotAnterior && (
                <button
                  onClick={retrocederTarjeta}
                  className="h-12 rounded-md bg-white border border-brand-100 text-body text-2xl font-semibold hover:border-brand-300 transition-all flex items-center justify-center"
                >
                  ‹
                </button>
              )}
              <button
                onClick={() => manejarEvaluacion("incorrecto")}
                className="h-12 rounded-md bg-white border border-danger text-danger text-sm font-semibold hover:brightness-95 transition-all"
              >
                Fallo
              </button>
              <button
                onClick={() => manejarEvaluacion("casi")}
                className="h-12 rounded-md bg-warn text-[#5C3F00] text-sm font-semibold hover:brightness-95 transition-all"
              >
                Casi
              </button>
              <button
                onClick={() => manejarEvaluacion("perfecto")}
                className="h-12 rounded-md bg-success text-white text-sm font-semibold hover:brightness-95 transition-all"
              >
                Fluido
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
