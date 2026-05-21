"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cargarEstado, obtenerPerfilActivo } from "@/lib/storage";
import {
  calcularProgresoTemas,
  frasesDelTemaEnNivel,
  ProgresoPorTema,
  BLOQUES_ORDENADOS,
} from "@/lib/catalogo";
import { Perfil } from "@/lib/types";

const NIVELES = ["basic", "intermediate", "advanced"] as const;
const ETIQUETA_NIVEL: Record<string, string> = {
  basic: "Basic",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

interface TemaConRefuerzo extends ProgresoPorTema {
  frasesDisponibles: number; // frases en bloques desbloqueados del perfil
}

export default function MiTrayectoria() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [temas, setTemas] = useState<TemaConRefuerzo[]>([]);

  useEffect(() => {
    const estado = cargarEstado();
    const p = obtenerPerfilActivo(estado);
    setPerfil(p);

    // calcularProgresoTemas devuelve todos los temas del catálogo con su progreso.
    // Añadimos frasesDisponibles y descartamos los que no tienen frases en bloques desbloqueados.
    const todosLosTemas: TemaConRefuerzo[] = calcularProgresoTemas(p)
      .map((t) => ({ ...t, frasesDisponibles: frasesDelTemaEnNivel(p, t.tema).length }))
      .filter((t) => t.frasesDisponibles > 0);

    setTemas(todosLosTemas);
  }, []);

  if (!perfil) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-body">Cargando...</p>
      </main>
    );
  }

  const temasGrupo = (nivel: string) =>
    temas
      .filter((t) => t.nivel === nivel)
      .sort((a, b) => b.porcentaje - a.porcentaje || a.tema.localeCompare(b.tema));

  const frasesAprendidas = BLOQUES_ORDENADOS.reduce((sum, b) => {
    const puntero = perfil.puntero_frase_nueva[b.codigo] ?? 0;
    const enRepaso = Object.keys(perfil.progreso_frases).filter((id) =>
      id.startsWith(b.codigo + "-")
    ).length;
    return sum + Math.max(0, puntero - enRepaso);
  }, 0);

  const temasConProgreso = temas.filter((t) => t.aprendidas > 0);
  const tocados = temasConProgreso.length;
  const dominados = temasConProgreso.filter((t) => t.porcentaje >= 80).length;

  return (
    <main className="min-h-screen bg-white flex flex-col items-center px-4 py-8 gap-5">
      <div className="w-full max-w-sm flex flex-col gap-5">

        {/* Cabecera */}
        <div className="flex flex-col gap-1">
          <button
            onClick={() => router.push("/")}
            className="self-start text-sm font-semibold text-brand-500 hover:text-brand-700 transition-colors mb-1"
          >
            ← Volver
          </button>
          <h1 className="text-[18px] font-semibold text-ink">Tu dominio</h1>
          <p className="text-[13px] text-body">Toca un tema para reforzarlo</p>
        </div>

        {/* Stats box */}
        <div className="bg-surface rounded-xl flex divide-x divide-brand-100 overflow-hidden">
          {[
            { label: "Temas tocados", value: tocados },
            { label: "Dominados", value: dominados },
            { label: "Frases aprend.", value: frasesAprendidas },
          ].map(({ label, value }) => (
            <div key={label} className="flex-1 flex flex-col items-center py-3 gap-0.5">
              <span className="text-[20px] font-semibold text-ink tabular-nums">{value}</span>
              <span className="text-[11px] text-mute text-center leading-tight px-1">{label}</span>
            </div>
          ))}
        </div>

        {/* Grupos por nivel */}
        {NIVELES.map((nivel) => {
          const filas = temasGrupo(nivel);
          if (filas.length === 0) return null;
          return (
            <div key={nivel} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-eyebrow font-semibold uppercase text-mute">
                  {ETIQUETA_NIVEL[nivel]}
                </p>
                <p className="text-eyebrow text-mute">{filas.length} temas</p>
              </div>
              <div className="flex flex-col divide-y divide-brand-50">
                {filas.map((t) => {
                  const href = `/refuerzo/${encodeURIComponent(t.tema)}`;
                  const deshabilitado = t.frasesDisponibles === 0;

                  const contenido = (
                    <div className="flex items-center gap-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className={`text-[14px] font-semibold truncate ${deshabilitado ? "text-mute" : "text-ink"}`}>
                          {t.tema}
                        </p>
                        <p className="text-[11px] text-mute">{t.total} frases</p>
                      </div>
                      <div className="w-20 h-1.5 rounded-full bg-brand-100 shrink-0 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-[400ms] ease-out ${
                            t.porcentaje >= 80 ? "bg-success" : "bg-brand-500"
                          }`}
                          style={{ width: `${t.porcentaje}%` }}
                        />
                      </div>
                      <p className="text-[13px] font-semibold text-ink tabular-nums w-9 text-right shrink-0">
                        {t.porcentaje}%
                      </p>
                      {/* Chevron: indica que es tappable */}
                      {!deshabilitado && (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-mute shrink-0"
                        >
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      )}
                    </div>
                  );

                  if (deshabilitado) {
                    return (
                      <div key={t.tema} className="opacity-40 cursor-not-allowed">
                        {contenido}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={t.tema}
                      href={href}
                      className="hover:bg-brand-50 rounded-lg transition-colors -mx-2 px-2"
                    >
                      {contenido}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        {temas.length === 0 && (
          <p className="text-sm text-mute text-center py-8">
            Aún no hay temas disponibles. ¡Empieza una sesión!
          </p>
        )}

      </div>
    </main>
  );
}
