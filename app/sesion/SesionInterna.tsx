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
import { construirSesion, obtenerFrasePorId } from "@/lib/sesion";
import { evaluarFrase, avanzarPunterosAlTerminar, actualizarRacha } from "@/lib/aprendizaje";
import { temasARepasar } from "@/lib/stats";
import { AppState, Frase, ResultadoEval, SesionEnCurso } from "@/lib/types";
import FeedbackFallo from "@/components/FeedbackFallo";

type Pantalla = "tarjeta" | "feedback";

interface DatosFeedback {
  resultado: ResultadoEval;
  pendientes: number;
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

  useEffect(() => {
    const estadoCargado = cargarEstado();
    const perfil = obtenerPerfilActivo(estadoCargado);
    const bloqueAlIniciar = perfil.bloque_activo;
    const forzarNueva = searchParams.get("nueva") === "1";
    const tamanyoParam = parseInt(searchParams.get("frases") ?? "25", 10);
    const tamanyoSesion = [10, 15, 20, 25].includes(tamanyoParam) ? tamanyoParam : 25;

    // Ignorar sesión guardada si es de otro bloque o está vacía
    const sesionGuardadaValida =
      !forzarNueva &&
      perfil.sesion_en_curso &&
      perfil.sesion_en_curso.frases_ids.length > 0 &&
      perfil.sesion_en_curso.frases_ids[0].startsWith(perfil.bloque_activo + "-");

    const sesionActiva = sesionGuardadaValida
      ? perfil.sesion_en_curso!
      : construirSesion(perfil, tamanyoSesion);

    // Punto A: sesión vacía — puede ser bloque al 100% o sin frases disponibles hoy
    if (sesionActiva.frases_ids.length === 0) {
      const pct = porcentajeBloque(perfil, bloqueAlIniciar);
      const hayBloqueSiguiente =
        BLOQUES_ORDENADOS.findIndex((b) => b.codigo === bloqueAlIniciar) <
        BLOQUES_ORDENADOS.length - 1;
      if (pct >= 100 && hayBloqueSiguiente) {
        // Bloque completado: limpiar sesión y avanzar
        const perfilSinSesion = { ...perfil, sesion_en_curso: null };
        const estadoSinSesion = actualizarPerfilActivo(estadoCargado, perfilSinSesion);
        avanzarBloqueActivo(estadoSinSesion);
        router.push(`/fin-de-bloque?bloque=${bloqueAlIniciar}`);
        return;
      }
      // Sin frases disponibles (todo practicado hoy, o último bloque terminado)
      // No guardar sesión vacía en localStorage
      router.push("/");
      return;
    }

    const perfilActualizado = { ...perfil, sesion_en_curso: sesionActiva };
    const estadoActualizado = actualizarPerfilActivo(estadoCargado, perfilActualizado);
    guardarEstado(estadoActualizado);
    setEstado(estadoActualizado);
    setSesion(sesionActiva);
  }, [searchParams, router]);

  const terminarSesion = useCallback(
    (estadoFinal: AppState, sesionFinal: SesionEnCurso) => {
      const perfilActual = obtenerPerfilActivo(estadoFinal);
      const bloqueCompletado = perfilActual.bloque_activo;

      // Snapshot del bloque ANTES de actualizar punteros
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

      // Snapshot del bloque DESPUÉS de actualizar punteros
      const punteroDespues = perfilFinal.puntero_frase_nueva[bloqueCompletado] ?? 0;
      const enRepasoDespues = Object.keys(perfilFinal.progreso_frases).filter(
        (id) => id.startsWith(bloqueCompletado + "-")
      ).length;
      const aprendidasDespues = Math.max(0, punteroDespues - enRepasoDespues);
      const porcentajeDespues = porcentajeBloque(perfilFinal, bloqueCompletado);

      // Temas grandes únicos tocados en la sesión
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

      // Punto B: detectar si esta sesión completó el bloque activo
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
    // Restaura el estado previo a la última evaluación
    guardarEstado(snapshotAnterior.estado);
    setEstado(snapshotAnterior.estado);
    setSesion(snapshotAnterior.sesion);
    setSnapshotAnterior(null);
    setRevelada(true); // muestra la tarjeta anterior ya revelada
    setPantalla("tarjeta");
    setAnimandoPerfecto(false);
  }

  function manejarEvaluacion(resultado: ResultadoEval) {
    if (!estado || !sesion) return;

    // Guarda snapshot antes de evaluar (permite retroceder una vez)
    setSnapshotAnterior({ estado, sesion });

    const perfil = obtenerPerfilActivo(estado);
    const fraseId = sesion.frases_ids[sesion.indice_actual];
    const fraseActual = obtenerFrasePorId(fraseId);

    const perfilActualizado = evaluarFrase(perfil, fraseId, resultado, sesion);
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
      // Escala breve en la card antes de avanzar
      setAnimandoPerfecto(true);
      setTimeout(() => {
        setAnimandoPerfecto(false);
        avanzarTarjeta(estadoActualizado, sesionConRespuesta);
      }, 250);
    } else {
      const progreso = perfilActualizado.progreso_frases[fraseId];
      setDatosFeedback({
        resultado,
        pendientes: progreso?.pendientes ?? (resultado === "casi" ? 2 : 3),
        frase: fraseActual!,
      });
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
            onClick={() => router.push("/")}
            className="text-sm font-semibold text-brand-500 hover:text-brand-700 transition-colors"
          >
            ← Salir
          </button>
          <span className="font-sans font-medium text-sm text-ink tabular-nums">
            🔥 {perfil.racha_dias} {perfil.racha_dias === 1 ? "día" : "días"}
          </span>
        </div>
        <span className="font-sans font-medium text-sm text-ink tabular-nums">
          {indice + 1} / {totalFrases}
        </span>
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
          pendientes={datosFeedback.pendientes}
          onContinuar={() => avanzarTarjeta(estado, sesion)}
        />
      ) : (
        // key en el wrapper: cuando cambia la frase, React re-monta y dispara el slide-in
        <div key={fraseActualId} className="w-full flex flex-col items-center animate-slide-in">
          <div className={`w-full max-w-sm bg-brand-50 rounded-lg px-[14px] py-[22px] min-h-[120px] flex flex-col gap-2 mb-3 ${animandoPerfecto ? "animate-scale-perfecto" : ""}`}>
            <span className="text-eyebrow font-semibold uppercase text-mute">TRADUCE</span>
            <p className="text-[18px] font-semibold text-body leading-snug">{fraseActual.es}</p>
          </div>

          {revelada && (
            <div className={`w-full max-w-sm bg-brand-100 rounded-lg px-[14px] py-[18px] border border-brand-500/20 flex flex-col gap-2 mb-6 ${animandoPerfecto ? "animate-scale-perfecto" : ""}`}>
              <span className="text-eyebrow font-semibold uppercase text-brand-700">ENGLISH</span>
              <p className="text-[18px] font-semibold text-ink leading-snug">
                {fraseActual.en}
              </p>
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
              {/* Botón retroceder: solo visible si hay una evaluación anterior que deshacer */}
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
                Perfecto
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
