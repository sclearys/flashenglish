"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { cargarEstado, obtenerPerfilActivo } from "@/lib/storage";
import { frasesDelTemaEnNivel, totalPorTema } from "@/lib/catalogo";

const OPCIONES_TAMANO = [10, 15, 25] as const;
const TAMANO_DEFAULT = 15;

export default function ConfiguracionRefuerzo() {
  const router = useRouter();
  const params = useParams();
  const temaId = decodeURIComponent(params.temaId as string);

  const [frasesDisponibles, setFrasesDisponibles] = useState<number | null>(null);
  const [tamano, setTamano] = useState<number>(TAMANO_DEFAULT);

  useEffect(() => {
    const estado = cargarEstado();
    const perfil = obtenerPerfilActivo(estado);

    // Verificar que el tema existe en el catálogo
    if (!totalPorTema.has(temaId)) {
      router.replace("/mi-trayectoria");
      return;
    }

    const disponibles = frasesDelTemaEnNivel(perfil, temaId).length;
    if (disponibles === 0) {
      router.replace("/mi-trayectoria");
      return;
    }

    setFrasesDisponibles(disponibles);
  }, [temaId, router]);

  if (frasesDisponibles === null) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-body">Cargando...</p>
      </main>
    );
  }

  // Si el tamaño elegido supera el disponible, la sesión usará todas las que haya
  const frasesReales = Math.min(tamano, frasesDisponibles);

  function iniciarSesion() {
    router.push(
      `/sesion?tipo=refuerzo&tema=${encodeURIComponent(temaId)}&frases=${tamano}&nueva=1`
    );
  }

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col gap-6">

        {/* Cabecera */}
        <div className="flex flex-col gap-1">
          <button
            onClick={() => router.push("/mi-trayectoria")}
            className="self-start text-sm font-semibold text-brand-500 hover:text-brand-700 transition-colors mb-1"
          >
            ← Mi trayectoria
          </button>
          <p className="text-eyebrow font-semibold uppercase text-mute">Refuerzo temático</p>
          <h1 className="text-[22px] font-semibold text-ink">{temaId}</h1>
          <p className="text-[13px] text-body">
            {frasesDisponibles} {frasesDisponibles === 1 ? "frase disponible" : "frases disponibles"} en tu nivel
          </p>
        </div>

        {/* Selector de tamaño */}
        <div className="flex flex-col gap-3">
          <p className="text-[14px] font-semibold text-ink">¿Cuántas frases?</p>
          <div className="grid grid-cols-3 gap-2">
            {OPCIONES_TAMANO.map((opcion) => {
              const seleccionado = tamano === opcion;
              return (
                <button
                  key={opcion}
                  onClick={() => setTamano(opcion)}
                  className={`h-12 rounded-md text-sm font-semibold transition-all border ${
                    seleccionado
                      ? "bg-brand-500 text-white border-brand-500"
                      : "bg-white text-ink border-brand-100 hover:border-brand-300"
                  }`}
                >
                  {opcion}
                </button>
              );
            })}
          </div>
          {/* Aviso si hay menos frases que las elegidas */}
          {frasesDisponibles < tamano && (
            <p className="text-[12px] text-mute">
              Solo hay {frasesDisponibles} disponibles — la sesión usará todas.
            </p>
          )}
        </div>

        {/* Info de la sesión */}
        <div className="bg-surface rounded-xl px-5 py-4 flex flex-col gap-1">
          <p className="text-eyebrow font-semibold uppercase text-mute">Esta sesión</p>
          <p className="text-[15px] text-body">
            {frasesReales} frases de <span className="font-semibold text-ink">{temaId}</span> en orden aleatorio
          </p>
          <p className="text-[12px] text-mute mt-1">
            El refuerzo no afecta tu progreso — es práctica libre.
          </p>
        </div>

        {/* Botones */}
        <div className="flex flex-col gap-2">
          <button
            onClick={iniciarSesion}
            className="w-full h-12 rounded-md bg-brand-500 text-white text-sm font-semibold hover:brightness-95 transition-all"
          >
            Empezar
          </button>
          <button
            onClick={() => router.push("/mi-trayectoria")}
            className="w-full h-12 rounded-md bg-white border border-brand-100 text-ink text-sm font-semibold hover:border-brand-300 transition-all"
          >
            Cancelar
          </button>
        </div>

      </div>
    </main>
  );
}
