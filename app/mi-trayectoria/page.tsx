"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cargarEstado, obtenerPerfilActivo } from "@/lib/storage";
import { calcularProgresoTemas, ProgresoPorTema, BLOQUES_ORDENADOS } from "@/lib/catalogo";
import { Perfil } from "@/lib/types";

const NIVELES = ["basic", "intermediate", "advanced"] as const;
const ETIQUETA_NIVEL: Record<string, string> = {
  basic: "Basic",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export default function MiTrayectoria() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [temas, setTemas] = useState<ProgresoPorTema[]>([]);

  useEffect(() => {
    const estado = cargarEstado();
    const p = obtenerPerfilActivo(estado);
    setPerfil(p);
    setTemas(calcularProgresoTemas(p));
  }, []);

  if (!perfil) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-body">Cargando...</p>
      </main>
    );
  }

  const temasConProgreso = temas.filter((t) => t.aprendidas > 0);

  const temasGrupo = (nivel: string) =>
    temasConProgreso
      .filter((t) => t.nivel === nivel)
      .sort((a, b) => b.porcentaje - a.porcentaje);

  const frasesAprendidas = BLOQUES_ORDENADOS.reduce((sum, b) => {
    const puntero = perfil.puntero_frase_nueva[b.codigo] ?? 0;
    const enRepaso = Object.keys(perfil.progreso_frases).filter((id) =>
      id.startsWith(b.codigo + "-")
    ).length;
    return sum + Math.max(0, puntero - enRepaso);
  }, 0);

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
          <h1 className="text-[18px] font-semibold text-ink">Mi trayectoria</h1>
          <p className="text-[13px] text-body">Tu dominio de los temas</p>
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
                {filas.map((t) => (
                  <div key={t.tema} className="flex items-center gap-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-ink truncate">{t.tema}</p>
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
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {temasConProgreso.length === 0 && (
          <p className="text-sm text-mute text-center py-8">
            Aún no has aprendido ninguna frase. ¡Empieza una sesión!
          </p>
        )}

      </div>
    </main>
  );
}
