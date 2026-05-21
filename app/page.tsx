"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cargarEstado, obtenerPerfilActivo } from "@/lib/storage";
import { calcularStats } from "@/lib/stats";
import { BLOQUES_ORDENADOS, porcentajeBloque } from "@/lib/catalogo";
import { hayFrasesDisponibles, contarRepasoMañana } from "@/lib/sesion";
import { AppState } from "@/lib/types";
import BarraOchoSegmentos from "@/components/BarraOchoSegmentos";

export default function Inicio() {
  const router = useRouter();
  const [estado, setEstado] = useState<AppState | null>(null);

  useEffect(() => {
    if (!sessionStorage.getItem("perfilSeleccionado")) {
      router.push("/perfiles");
      return;
    }
    setEstado(cargarEstado());
  }, [router]);

  if (!estado) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-body">Cargando...</p>
      </main>
    );
  }

  const perfil = obtenerPerfilActivo(estado);
  const stats = calcularStats(perfil);
  const haySessionEnCurso =
    perfil.sesion_en_curso !== null &&
    perfil.sesion_en_curso.frases_ids.length > 0;
  const frasesDisponibles = hayFrasesDisponibles(perfil);
  const repasoParaMañana = frasesDisponibles ? 0 : contarRepasoMañana(perfil);
  const rachaTxt = stats.rachaDias === 1 ? "día" : "días";

  const bloqueActualInfo = BLOQUES_ORDENADOS.find(
    (b) => b.codigo === perfil.bloque_activo
  );

  const segmentos = BLOQUES_ORDENADOS.map((b) => ({
    codigo: b.codigo,
    porcentaje: porcentajeBloque(perfil, b.codigo),
    esActivo: b.codigo === perfil.bloque_activo,
    desbloqueado: perfil.bloques_desbloqueados.includes(b.codigo),
  }));

  function irAPerfiles() {
    sessionStorage.removeItem("perfilSeleccionado");
    router.push("/perfiles");
  }

  function empezar(nueva = false) {
    const params = new URLSearchParams();
    params.set("frases", "15");
    if (nueva) params.set("nueva", "1");
    router.push(`/sesion?${params.toString()}`);
  }

  return (
    <main className="min-h-screen bg-white flex flex-col items-center px-4 py-8 gap-5">
      <div className="w-full max-w-sm flex flex-col gap-5">

        {/* Cabecera: perfil activo + racha */}
        <div className="flex items-center justify-between">
          <button
            onClick={irAPerfiles}
            className="flex items-center gap-2 hover:opacity-75 transition-opacity"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
              style={{ background: perfil.color_acento }}
            >
              {perfil.nombre[0].toUpperCase()}
            </div>
            <span className="text-[18px] font-semibold text-ink">{perfil.nombre}</span>
          </button>
          <div className="flex items-center gap-1.5 bg-brand-50 rounded-full px-3 py-1">
            <span className="text-base">🔥</span>
            <span className="text-sm font-semibold text-ink tabular-nums">
              {stats.rachaDias} {rachaTxt}
            </span>
          </div>
        </div>

        {/* Card del bloque activo */}
        <div className="bg-brand-50 rounded-xl px-5 py-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-eyebrow font-semibold uppercase text-mute">TU BLOQUE</p>
            <p className="text-[22px] font-semibold text-ink leading-tight">
              {bloqueActualInfo?.nombre ?? perfil.bloque_activo}
            </p>
          </div>

          {/* Barra de progreso del bloque activo */}
          <div className="flex flex-col gap-1.5">
            <div className="w-full h-2 rounded-full bg-surface overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all duration-[400ms] ease-out"
                style={{ width: `${stats.porcentajeBloque}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-mute tabular-nums">
                {stats.aprendidas} / {stats.total} aprendidas
              </p>
              <p className="text-sm font-semibold text-ink tabular-nums">
                {stats.porcentajeBloque}%
              </p>
            </div>
          </div>
        </div>

        {/* CTA principal */}
        {haySessionEnCurso ? (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => empezar(false)}
              className="w-full h-12 rounded-md bg-brand-500 text-white text-sm font-semibold hover:brightness-95 transition-all flex items-center justify-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l15 8-15 8z"/></svg>
              Continuar sesión ({perfil.sesion_en_curso!.indice_actual}/{perfil.sesion_en_curso!.frases_ids.length})
            </button>
            <button
              onClick={() => empezar(true)}
              className="w-full h-12 rounded-md bg-white border border-brand-100 text-brand-700 text-sm font-semibold hover:border-brand-300 transition-all"
            >
              Empezar sesión nueva
            </button>
          </div>
        ) : frasesDisponibles ? (
          <button
            onClick={() => empezar()}
            className="w-full h-12 rounded-md bg-brand-500 text-white text-sm font-semibold hover:brightness-95 transition-all flex items-center justify-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l15 8-15 8z"/></svg>
            Empezar sesión
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <button
              disabled
              className="w-full h-12 rounded-md bg-brand-100 text-mute text-sm font-semibold cursor-not-allowed"
            >
              Empezar sesión
            </button>
            {repasoParaMañana > 0 && (
              <p className="text-center text-sm text-mute">
                {repasoParaMañana} {repasoParaMañana === 1 ? "frase espera" : "frases esperan"} mañana
              </p>
            )}
          </div>
        )}

        {/* Links de ayuda — agrupados, siempre visibles */}
        <div className="flex flex-col items-center gap-1">
          {frasesDisponibles && !haySessionEnCurso && (
            <button
              onClick={() => router.push("/test-nivel")}
              className="text-sm font-medium text-mute hover:text-ink transition-colors text-center py-1"
            >
              ¿Ya sabes inglés? → Haz el test de nivel
            </button>
          )}
          <button
            onClick={() => router.push("/como-funciona")}
            className="text-sm font-medium text-mute hover:text-ink transition-colors text-center py-1"
          >
            Cómo funciona
          </button>
        </div>

        {/* Tu camino: barra de 8 segmentos */}
        <div className="flex flex-col gap-2">
          <p className="text-eyebrow font-semibold uppercase text-mute">TU CAMINO</p>
          <BarraOchoSegmentos segmentos={segmentos} mostrarLabels />
        </div>

      </div>

      {/* Links de pie */}
      <div className="flex flex-col items-center gap-2 mt-2">
        <button
          onClick={() => router.push("/mi-trayectoria")}
          className="flex items-center gap-1.5 text-sm font-medium text-mute hover:text-ink transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>
          Mi trayectoria
        </button>
        <a
          href="https://forms.gle/aApWeQmSRG2iYagTA"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-brand-500 hover:text-brand-700 transition-colors"
        >
          ¡Dame feedback, por favor!
        </a>
      </div>
    </main>
  );
}
