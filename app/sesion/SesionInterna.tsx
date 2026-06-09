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
import { porcentajeBloque, BLOQUES_ORDENADOS, temasGrandesPorFrase, dominioPorSubTema } from "@/lib/catalogo";
import { construirSesion, construirSesionRefuerzo, obtenerFrasePorId } from "@/lib/sesion";
import { evaluarFrase, avanzarPunterosAlTerminar, actualizarRacha } from "@/lib/aprendizaje";
import { temasARepasar } from "@/lib/stats";
import { AppState, Frase, ResultadoEval, SesionEnCurso } from "@/lib/types";
import FeedbackFallo from "@/components/FeedbackFallo";
import { leerFraseEnIngles, detenerAudio, tieneWebSpeech } from "@/lib/audio";
type ErrorSTT = "no-speech" | "not-allowed" | "network" | "otro";
import {
  tieneReconocimientoVoz,
  iniciarReconocimiento,
  detenerReconocimiento,
} from "@/lib/reconocimiento";
import { evaluarConTutor } from "./actions";
import { registrarSesionCompletada } from "@/lib/nube";
import { track } from "@vercel/analytics";

// "seleccion-modo" es la nueva pantalla inicial en sesiones nuevas (Pieza G).
type Pantalla = "seleccion-modo" | "tarjeta" | "feedback";

interface DatosFeedback {
  resultado: ResultadoEval;
  frase: Frase;
  explicacion: string | null;
}

interface Props {
  // Pieza G.4: el Server Component (page.tsx) lee este valor de estado_usuario
  // antes de renderizar. Si el admin ha desactivado el tutor, el botón "Con tutor"
  // aparece deshabilitado sin necesidad de que el usuario lo descubra al grabar.
  tutorActivo: boolean;
}

export default function SesionInterna({ tutorActivo }: Props) {
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

  // ── Soporte de Web Speech API: síntesis (TTS) y reconocimiento (STT) ──────
  const [speechDisponible, setSpeechDisponible] = useState(false);
  const [reconocimientoDisponible, setReconocimientoDisponible] = useState(false);
  useEffect(() => {
    setSpeechDisponible(tieneWebSpeech());
    setReconocimientoDisponible(tieneReconocimientoVoz());
  }, []);

  // ── Estado específico del modo tutor virtual (Pieza G) ────────────────────
  const [esInvitado, setEsInvitado] = useState(false);
  // Permite forzar el modo tutor desde la URL (?tutor=1) sin pasar por la selección de modo
  const [modoForzadoTutor, setModoForzadoTutor] = useState(false);
  // Blob de la grabación de audio del usuario (reservado para cuando se implemente MediaRecorder).
  // setBlobGrabacion se usará cuando se añada la grabación de audio paralela al STT.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [blobGrabacion, setBlobGrabacion] = useState<Blob | null>(null);
  // Estado de la grabación en curso: idle → grabando → procesando → idle
  const [estadoGrabacion, setEstadoGrabacion] = useState<
    "idle" | "grabando" | "confirmando" | "procesando"
  >("idle");
  const [veredictoIA, setVeredictoIA] = useState<ResultadoEval | null>(null);
  const [transcripcionUsuario, setTranscripcionUsuario] = useState<string | null>(null);
  // true si el STT no pudo escuchar al usuario
  const [errorGrabacion, setErrorGrabacion] = useState<ErrorSTT | null>(null);
  // true si el usuario pidió autoevaluar manualmente tras un fallo del STT o la IA
  const [fallbackAutoeval, setFallbackAutoeval] = useState(false);
  // Mensaje de error de la IA (anillo de control de coste: cap, tutor desactivado, etc.)
  // Distinto de errorGrabacion, que es un fallo del STT.
  const [mensajeErrorIA, setMensajeErrorIA] = useState<string | null>(null);
  // true si cap_diario fue alcanzado en esta sesión — todas las tarjetas siguientes usan autoevaluación silenciosa.
  const [capDiarioSesion, setCapDiarioSesion] = useState(false);
  // Explicación gramatical devuelta por la IA junto al veredicto (Pieza G.2).
  const [explicacionIA, setExplicacionIA] = useState<string | null>(null);

  // Leer la respuesta en inglés automáticamente al revelar (y también al retroceder)
  useEffect(() => {
    if (!sesion || !revelada) return;
    const fraseId = sesion.frases_ids[sesion.indice_actual];
    const frase = obtenerFrasePorId(fraseId);
    if (frase) leerFraseEnIngles(frase.en);
  // sesion.indice_actual + revelada cubren todos los casos: revelar, retroceder, avanzar
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesion?.indice_actual, revelada]);

  // Detener audio y reconocimiento al salir de la pantalla de sesión
  useEffect(() => {
    return () => {
      detenerAudio();
      detenerReconocimiento();
    };
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

    // Al rescatar una sesión guardada, eliminar frases ya evaluadas hoy para que no
    // reaparezcan en una segunda sesión del mismo día (bug: ultima_vez de hoy en progreso_frases).
    const fechaHoy = new Date().toISOString().slice(0, 10);
    const sesionRescatada = sesionGuardadaValida
      ? (() => {
          const sesion = perfil.sesion_en_curso!;
          const frasesFiltradas = sesion.frases_ids.filter((id) => {
            const prog = perfil.progreso_frases[id];
            return !prog || prog.ultima_vez.slice(0, 10) !== fechaHoy;
          });
          if (frasesFiltradas.length === 0) return null;
          return { ...sesion, frases_ids: frasesFiltradas };
        })()
      : null;

    const sesionActiva = sesionRescatada
      ? sesionRescatada
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

    // Detectar si el usuario es invitado mediante la cookie (síncrono).
    // El middleware garantiza que quien llega aquí tiene sesión Supabase O la cookie.
    const invitado = document.cookie
      .split(";")
      .some((c) => c.trim().startsWith("modo_invitado=1"));
    setEsInvitado(invitado);

    // ── Parámetros de testing (?tutor=1 y ?mock=1) ────────────────────────────
    // ?tutor=1: fuerza modo tutor sin pasar por la pantalla de selección
    // ?mock=1: carga un veredicto hardcodeado para validar el diseño visualmente
    const esTutorForzado = searchParams.get("tutor") === "1";
    const esMock = searchParams.get("mock") === "1";

    if (esTutorForzado) {
      setModoForzadoTutor(true);
    }

    if (esTutorForzado && esMock) {
      // Simular un veredicto de la IA para revisar el diseño sin grabar
      setVeredictoIA("casi");
      setTranscripcionUsuario("I have been working all day");
      setExplicacionIA(
        "Has usado el Present Simple, pero la situación pide el Present Perfect Continuous para indicar una acción que empezó en el pasado y continúa ahora."
      );
      setRevelada(true);
      setPantalla("tarjeta");
      return;
    }

    // Sesión nueva → mostrar pantalla de selección de modo.
    // Sesión retomada (modo ya guardado) → ir directamente a la tarjeta.
    if (!sesionGuardadaValida) {
      setPantalla("seleccion-modo");
    } else {
      setPantalla("tarjeta");
    }
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
          temas_repasar: temasARepasar(sesionFinal.respuestas, obtenerFrasePorId).map((t) => ({
            ...t,
            dominioPct: dominioPorSubTema(t.tema, perfilTerminado),
          })),
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

      // Pieza H: registrar sesión en Supabase para auditoría del trenzado (fire-and-forget)
      registrarSesionCompletada(
        estadoFinal.perfil_activo,
        bloqueCompletado,
        sesionFinal.frases_ids.length,
        sesionFinal.frases_saltadas ?? 0
      );

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
        temas_repasar: temasARepasar(sesionFinal.respuestas, obtenerFrasePorId).map((t) => ({
          ...t,
          dominioPct: dominioPorSubTema(t.tema, perfilFinal),
        })),
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
        // Limpiar estado del tutor para la próxima tarjeta
        setVeredictoIA(null);
        setExplicacionIA(null);
        setTranscripcionUsuario(null);
        setEstadoGrabacion("idle");
        setErrorGrabacion(null);
        setFallbackAutoeval(false);
        setMensajeErrorIA(null);
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
    // Limpiar estado del tutor
    setVeredictoIA(null);
    setExplicacionIA(null);
    setTranscripcionUsuario(null);
    setEstadoGrabacion("idle");
    setErrorGrabacion(null);
    setMensajeErrorIA(null);
    // Al retroceder en modo tutor, el usuario ya vio la respuesta correcta,
    // así que activamos el fallback para que se autoevalúe manualmente.
    setFallbackAutoeval(snapshotAnterior.sesion.modo === "tutor");
  }

  // Reproduce la grabación del usuario si existe un Blob en memoria.
  // Actualmente siempre es null (Web Speech API solo da texto).
  // Se implementará cuando se añada MediaRecorder.
  function reproducirGrabacion() {
    if (!blobGrabacion) return;
    const url = URL.createObjectURL(blobGrabacion);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audio.play();
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
    } else if (esTutor && !fallbackAutoeval && veredictoIA) {
      // En modo tutor el veredicto ya se mostró inline — no hay pantalla de feedback separada.
      avanzarTarjeta(estadoActualizado, sesionConRespuesta);
    } else {
      setDatosFeedback({ resultado, frase: fraseActual!, explicacion: explicacionIA });
      setPantalla("feedback");
    }
  }

  // ── Pantalla de selección de modo (Pieza G) ───────────────────────────────

  function seleccionarModo(modo: "tutor" | "autoevaluacion") {
    if (!estado || !sesion) return;
    const sesionConModo = { ...sesion, modo };
    const perfil = obtenerPerfilActivo(estado);
    const perfilConSesion = { ...perfil, sesion_en_curso: sesionConModo };
    const estadoActualizado = actualizarPerfilActivo(estado, perfilConSesion);
    guardarEstado(estadoActualizado);
    setEstado(estadoActualizado);
    setSesion(sesionConModo);
    setPantalla("tarjeta");
  }

  // ── Guard de carga ────────────────────────────────────────────────────────

  if (!estado || !sesion) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-body text-sm">Cargando...</p>
      </main>
    );
  }

  // ── Variables derivadas del estado ────────────────────────────────────────

  const perfil = obtenerPerfilActivo(estado);
  const totalFrases = sesion.frases_ids.length;
  const indice = sesion.indice_actual;
  const esRefuerzo = sesion.tipo === "refuerzo";
  const esTutor = sesion.modo === "tutor" || modoForzadoTutor;

  // ── Pantalla de selección de modo ─────────────────────────────────────────

  if (pantalla === "seleccion-modo") {
    return (
      <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm flex flex-col gap-5">
          <div>
            <span className="text-eyebrow font-semibold uppercase text-mute">
              Nueva sesión
            </span>
            {esInvitado ? (
              <>
                <h1 className="text-[22px] font-semibold text-ink mt-2 leading-snug">
                  Esta sesión no incluye tutor virtual
                </h1>
                <p className="text-[14px] text-body mt-2 leading-snug">
                  Practicarás en modo libre, sin corrección por voz con IA.
                  <br />
                  Crea una cuenta para activar el tutor virtual y guardar tu progreso.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-[22px] font-semibold text-ink mt-2 leading-snug">
                  ¿Hoy quieres tutor virtual?
                </h1>
                <p className="text-[14px] text-body mt-2 leading-snug">
                  Dices la frase, la app la escucha y te dice cómo lo has hecho.
                </p>
              </>
            )}
          </div>

          {esInvitado ? (
            <>
              <button
                onClick={() => seleccionarModo("autoevaluacion")}
                className="w-full h-12 rounded-md bg-brand-500 text-white text-sm font-semibold hover:brightness-95 transition-all"
              >
                Empezar
              </button>
              <button
                onClick={() => router.push("/entrar")}
                className="text-sm font-semibold text-brand-500 hover:text-brand-700 transition-colors text-center"
              >
                Crear cuenta →
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => seleccionarModo("tutor")}
                disabled={!reconocimientoDisponible || !tutorActivo}
                className="w-full h-12 rounded-md bg-brand-500 text-white text-sm font-semibold hover:brightness-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {/* Icono micrófono */}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
                Con tutor
              </button>
              {!reconocimientoDisponible && (
                <p className="text-[12px] text-mute -mt-3 text-center">
                  Requiere Chrome o Edge
                </p>
              )}
              {reconocimientoDisponible && !tutorActivo && (
                <p className="text-[12px] text-mute -mt-3 text-center">
                  El tutor está desactivado para tu cuenta
                </p>
              )}
              <button
                onClick={() => seleccionarModo("autoevaluacion")}
                className="w-full h-12 rounded-md bg-white border border-brand-100 text-body text-sm font-semibold hover:border-brand-300 transition-all"
              >
                Sin tutor · Autoevaluarme
              </button>
            </>
          )}
        </div>
      </main>
    );
  }

  // ── Guard de frase ────────────────────────────────────────────────────────

  const fraseActualId = sesion.frases_ids[indice];
  const fraseActual: Frase | undefined = obtenerFrasePorId(fraseActualId);
  const porcentaje = totalFrases > 0 ? Math.round((indice / totalFrases) * 100) : 0;

  if (!fraseActual) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-body text-sm">No hay frases disponibles.</p>
      </main>
    );
  }

  // ── Función de grabación (necesita fraseActual, por eso va aquí) ──────────

  function iniciarGrabacion() {
    if (estadoGrabacion !== "idle" || !fraseActual) return;
    // Detener el audio antes de grabar: en iOS, tener TTS y STT activos a la vez
    // puede provocar que el reconocedor falle inmediatamente.
    detenerAudio();
    setErrorGrabacion(null);
    setTranscripcionUsuario(null);
    setEstadoGrabacion("grabando");

    iniciarReconocimiento({
      lang: "en-US",
      onResult: (texto: string) => {
        // El STT transcribió algo: mostrarlo al usuario para que confirme/edite
        // antes de enviarlo a la IA. Esto es el paso de confirmación del nuevo flujo.
        setTranscripcionUsuario(texto);
        setEstadoGrabacion("confirmando");
      },
      onError: (tipoError: ErrorSTT) => {
        setEstadoGrabacion("idle");
        setErrorGrabacion(tipoError);
      },
      onEnd: () => {
        // No hacemos nada aquí; onResult u onError ya gestionaron el resultado.
      },
    });
  }

  async function evaluarTranscripcion() {
    if (!transcripcionUsuario?.trim() || !fraseActual) return;
    const frase = fraseActual;
    const texto = transcripcionUsuario;
    setEstadoGrabacion("procesando");
    try {
      const resultado = await evaluarConTutor(
        texto,
        frase.en,
        frase.temas_gramaticales,
        frase.id
      );
      if ("error" in resultado) {
        const error = resultado.error;
        const mensajes: Record<string, string> = {
          cap_diario:        "Has completado la práctica con IA de hoy 🎉 Evalúate tú por ahora — mañana vuelve el tutor.",
          bloqueado:         "El tutor no está disponible ahora mismo. Evalúate tú esta vez.",
          tutor_desactivado: "El tutor está pausado en tu cuenta. Escríbeme si quieres reactivarlo.",
          // no_autenticado: fallback silencioso — el usuario no puede hacer nada al respecto
        };
        if (error === "cap_diario") setCapDiarioSesion(true);
        if (error !== "no_autenticado") {
          setMensajeErrorIA(mensajes[error] ?? "El tutor no está disponible ahora mismo. Evalúate tú esta vez.");
        }
        setEstadoGrabacion("idle");
        setErrorGrabacion("otro");
      } else {
        setVeredictoIA(resultado.veredicto);
        setExplicacionIA(resultado.explicacion ?? null);
        setRevelada(true);
        setEstadoGrabacion("idle");
      }
    } catch {
      setMensajeErrorIA("El tutor no está disponible ahora mismo. Evalúate tú esta vez.");
      setEstadoGrabacion("idle");
      setErrorGrabacion("otro");
    }
  }

  // ── Render principal ──────────────────────────────────────────────────────

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
          {esRefuerzo && sesion.temaId && (
            <span className="text-[10px] font-semibold text-brand-500 bg-brand-50 rounded-full px-2 py-0.5 leading-none">
              Refuerzo · {sesion.temaId}
            </span>
          )}
          {esTutor && !esRefuerzo && (
            <span className="text-[10px] font-semibold text-brand-700 bg-brand-100 rounded-full px-2 py-0.5 leading-none">
              Con tutor
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
          explicacion={datosFeedback.explicacion}
          onContinuar={() => avanzarTarjeta(estado, sesion)}
        />
      ) : (
        <div key={fraseActualId} className="w-full flex flex-col items-center animate-slide-in">

          {/* Tarjeta español */}
          <div className={`w-full max-w-sm bg-brand-50 rounded-lg px-[14px] py-[22px] min-h-[120px] flex flex-col gap-2 mb-3 ${animandoPerfecto ? "animate-scale-perfecto" : ""}`}>
            <span className="text-eyebrow font-semibold uppercase text-mute">Tradúcelo en voz alta</span>
            <p className="text-[18px] font-semibold text-body leading-snug">{fraseActual.es}</p>
          </div>

          {/* "Dijiste" — solo en modo tutor cuando hay veredicto y transcripción.
              Va entre la tarjeta española y la inglesa, según el diseño del mockup. */}
          {esTutor && !fallbackAutoeval && revelada && veredictoIA && transcripcionUsuario && (
            <div className="w-full max-w-sm mb-3">
              <span className="text-eyebrow font-semibold uppercase text-mute block mb-1">Dijiste</span>
              <div className="flex items-start gap-2">
                <p className="text-sm italic text-mute leading-snug flex-1">
                  &ldquo;{transcripcionUsuario}&rdquo;
                </p>
                {/* ▶ solo cuando hay Blob — actualmente siempre null (Web Speech no graba audio) */}
                {blobGrabacion && (
                  <button
                    onClick={reproducirGrabacion}
                    className="shrink-0 w-7 h-7 rounded border border-surface flex items-center justify-center text-mute hover:text-ink transition-colors mt-0.5"
                    aria-label="Reproducir grabación"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Tarjeta inglés (visible tras revelar, igual en ambos modos) */}
          {revelada && (
            <div className={`w-full max-w-sm bg-brand-100 rounded-lg px-[14px] py-[18px] border border-brand-500/20 flex flex-col gap-2 mb-4 ${animandoPerfecto ? "animate-scale-perfecto" : ""}`}>
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

          {/* ── Controles según modo ─────────────────────────────────────── */}

          {esTutor && !fallbackAutoeval && !capDiarioSesion ? (
            // ── MODO TUTOR ────────────────────────────────────────────────
            revelada && veredictoIA ? (
              // Veredicto recibido: bloque de resultado + botones
              <>
                {/* Bloque de veredicto — card coloreada con icono, varía según resultado */}
                {veredictoIA === "perfecto" ? (
                  // DOMINADO: fondo verde suave, icono ✅, mensaje positivo
                  <div className="w-full max-w-sm bg-success/10 border border-success/20 rounded-xl px-4 py-3 mb-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base leading-none">✅</span>
                      <span className="text-sm font-bold text-success uppercase tracking-wide">Dominado</span>
                    </div>
                    <p className="text-sm italic text-success/80 leading-snug">
                      Perfecto. Estructura correcta, bien formada y sin dudas.
                    </p>
                  </div>
                ) : veredictoIA === "casi" ? (
                  // CASI: fondo ámbar, icono ⚠️, chips de temas + explicación + copy
                  <div className="w-full max-w-sm rounded-xl px-4 py-3 mb-5" style={{ backgroundColor: "#FFF8E7", border: "1px solid #FFC85760" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base leading-none">⚠️</span>
                      <span className="text-sm font-bold uppercase tracking-wide" style={{ color: "#5C3F00" }}>Casi</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {fraseActual.temas_gramaticales.map((t) => (
                        <span key={t} className="text-xs font-medium text-body bg-white/70 rounded-full px-2.5 py-0.5 border border-warn/30">
                          {t}
                        </span>
                      ))}
                    </div>
                    {explicacionIA && (
                      <p className="text-sm italic leading-snug mb-2" style={{ color: "#5C3F00" }}>
                        {explicacionIA}
                      </p>
                    )}
                    <p className="text-xs" style={{ color: "#8A6500" }}>
                      La repasaremos en próximos días
                    </p>
                  </div>
                ) : (
                  // FALLO: fondo rojo suave, icono ❌, chips de temas + explicación + copy
                  <div className="w-full max-w-sm bg-danger/10 border border-danger/20 rounded-xl px-4 py-3 mb-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base leading-none">❌</span>
                      <span className="text-sm font-bold text-danger uppercase tracking-wide">Fallo</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {fraseActual.temas_gramaticales.map((t) => (
                        <span key={t} className="text-xs font-medium text-body bg-white/70 rounded-full px-2.5 py-0.5 border border-danger/20">
                          {t}
                        </span>
                      ))}
                    </div>
                    {explicacionIA && (
                      <p className="text-sm italic text-danger/80 leading-snug mb-2">
                        {explicacionIA}
                      </p>
                    )}
                    <p className="text-xs text-danger/70">
                      La repetiremos hasta que se asiente
                    </p>
                  </div>
                )}

                {/* Botones: ‹ opcional + Continuar → */}
                <div className={`w-full max-w-sm grid gap-[7px] ${snapshotAnterior ? "grid-cols-2" : "grid-cols-1"}`}>
                  {snapshotAnterior && (
                    <button
                      onClick={retrocederTarjeta}
                      className="h-12 rounded-md bg-white border border-brand-100 text-body text-2xl font-semibold hover:border-brand-300 transition-all flex items-center justify-center"
                    >
                      ‹
                    </button>
                  )}
                  <button
                    onClick={() => manejarEvaluacion(veredictoIA)}
                    className="h-12 rounded-md bg-brand-500 text-white text-sm font-semibold hover:brightness-95 transition-all"
                  >
                    Continuar →
                  </button>
                </div>
              </>
            ) : !revelada ? (
              // No revelada: interfaz de grabación con paso de confirmación
              <>
                {/* ── IDLE: botón circular de micrófono ── */}
                {estadoGrabacion === "idle" && !errorGrabacion && (  // errorGrabacion es null cuando no hay error
                  <div className="w-full max-w-sm flex flex-col items-center gap-4 mt-2">
                    <p className="text-sm text-body text-center leading-snug">
                      Pulsa el botón, di la frase en inglés<br />y pulsa de nuevo para terminar
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
                  </div>
                )}

                {/* ── GRABANDO: botón rojo pulsando ── */}
                {estadoGrabacion === "grabando" && (
                  <div className="w-full max-w-sm flex flex-col items-center gap-4 mt-2">
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

                {/* ── CONFIRMANDO: transcripción editable + Evaluar ── */}
                {estadoGrabacion === "confirmando" && transcripcionUsuario !== null && (
                  <div className="w-full max-w-sm flex flex-col gap-3 mt-2">
                    {/* Zona de transcripción */}
                    <div className="rounded-xl border border-surface bg-[#FAFAF8] px-4 py-3 flex flex-col gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-mute">
                        Dijiste
                      </span>
                      <textarea
                        value={transcripcionUsuario}
                        onChange={(e) => setTranscripcionUsuario(e.target.value)}
                        className="w-full text-[18px] font-medium italic text-ink bg-transparent outline-none resize-none leading-snug border-b border-brand-500 pb-1 focus:border-brand-500"
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

                    {/* Botón Evaluar */}
                    <button
                      onClick={evaluarTranscripcion}
                      disabled={!transcripcionUsuario.trim()}
                      className="w-full h-12 rounded-md bg-brand-500 text-white text-sm font-semibold hover:brightness-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                      </svg>
                      Evaluar
                    </button>
                  </div>
                )}

                {/* ── PROCESANDO: spinner ── */}
                {estadoGrabacion === "procesando" && (
                  <div className="w-full max-w-sm flex flex-col items-center gap-2 mt-6">
                    <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-body">Evaluando...</span>
                  </div>
                )}

                {/* ── ERROR: STT no escuchó nada, o un anillo de control bloqueó la IA ── */}
                {estadoGrabacion === "idle" && errorGrabacion !== null && (
                  <div className="w-full max-w-sm flex flex-col gap-3 mt-3">
                    <p className="text-sm text-body text-center">
                      {mensajeErrorIA ?? (
                        errorGrabacion === "not-allowed"
                          ? "El micrófono no tiene permiso. Revisa los ajustes de Safari y vuelve a intentarlo."
                          : errorGrabacion === "network"
                          ? "Fallo de conexión. Safari necesita internet para transcribir voz. ¿Volvemos a intentarlo?"
                          : "No pude escucharte. ¿Volvemos a intentarlo?"
                      )}
                    </p>
                    {!mensajeErrorIA && errorGrabacion !== "not-allowed" && (
                      <button
                        onClick={iniciarGrabacion}
                        className="w-full h-12 rounded-md bg-brand-500 text-white text-sm font-semibold hover:brightness-95 transition-all"
                      >
                        Reintentar
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setFallbackAutoeval(true);
                        setErrorGrabacion(null);
                        setMensajeErrorIA(null);
                        setRevelada(true);
                      }}
                      className="text-sm font-semibold text-brand-500 hover:text-brand-700 transition-colors text-center"
                    >
                      Autoevaluar yo mismo
                    </button>
                  </div>
                )}
              </>
            ) : null
          ) : (
            // ── MODO AUTOEVALUACIÓN (o fallback) ──────────────────────────
            !revelada ? (
              <button
                onClick={() => setRevelada(true)}
                className="w-full max-w-sm h-12 rounded-md bg-brand-500 text-white text-sm font-semibold hover:brightness-95 transition-all mt-3"
              >
                Revelar
              </button>
            ) : (
              <>
                {/* Banner informativo cuando la IA falla (primera frase del error) */}
                {mensajeErrorIA && (
                  <div className="w-full max-w-sm rounded-xl border border-[#C77A11]/30 bg-[#FBF0DC] px-4 py-3 mb-3 text-sm text-[#5C3F00] leading-snug">
                    {mensajeErrorIA}
                  </div>
                )}
                {/* Chip pequeño en frases siguientes cuando cap_diario ya ocurrió */}
                {!mensajeErrorIA && capDiarioSesion && (
                  <p className="w-full max-w-sm text-[11px] text-mute mb-2 text-center">
                    Modo autoevaluación — límite de IA alcanzado hoy
                  </p>
                )}
                <p className="w-full max-w-sm text-eyebrow font-semibold text-mute mb-2">
                  ¿Cómo lo has hecho?
                </p>
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
                    Dominado
                  </button>
                </div>
              </>
            )
          )}
        </div>
      )}
    </main>
  );
}
