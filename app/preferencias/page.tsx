"use client";

// Pantalla de preferencias de usuario (Pieza G.5).
//
// Diseño de dos capas para el toggle del tutor IA:
//   - tutor_activo (columna DB): control del admin. Este componente NUNCA lo escribe.
//   - AppState.tutorPreferido: preferencia del usuario. Se escribe en localStorage + Supabase.
//
// Si el admin ha desactivado el tutor, el toggle se oculta y se muestra un aviso.
// Así el usuario nunca puede sobreescribir la decisión del admin.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { crearClienteSupabase } from "@/lib/supabase";
import { cargarEstado, guardarEstado } from "@/lib/storage";

export default function Preferencias() {
  const router = useRouter();
  // true = el admin ha desactivado el tutor para este usuario
  const [bloqueadoPorAdmin, setBloqueadoPorAdmin] = useState(false);
  // Preferencia del propio usuario (del AppState en localStorage)
  const [tutorPreferido, setTutorPreferido] = useState(true);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      const supabase = crearClienteSupabase();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/perfiles");
        return;
      }

      // Leer la columna de admin (solo lectura aquí — nunca la escribimos)
      const { data } = await supabase
        .from("estado_usuario")
        .select("tutor_activo")
        .eq("cuenta_id", user.id)
        .single();

      if (data?.tutor_activo === false) setBloqueadoPorAdmin(true);

      // Leer la preferencia del usuario del AppState en localStorage
      const estado = cargarEstado();
      if (estado.tutorPreferido === false) setTutorPreferido(false);

      setCargando(false);
    }
    cargar();
  }, [router]);

  function toggleTutor() {
    const nuevo = !tutorPreferido;
    setTutorPreferido(nuevo); // actualización optimista

    // Guardar en localStorage y sincronizar con Supabase en segundo plano
    const estado = cargarEstado();
    guardarEstado({ ...estado, tutorPreferido: nuevo });
  }

  if (cargando) return null;

  return (
    <main className="min-h-screen bg-white flex flex-col items-center px-4 py-10">

      {/* Cabecera */}
      <div className="w-full max-w-sm flex items-center gap-4 mb-10">
        <button
          onClick={() => router.push("/perfiles")}
          className="text-sm font-semibold text-brand-500 hover:text-brand-700 transition-colors"
        >
          ← Volver
        </button>
        <h1 className="text-[18px] font-semibold text-ink">Preferencias</h1>
      </div>

      {/* Sección: Tutor IA */}
      <div className="w-full max-w-sm flex flex-col gap-3">
        <div className="bg-brand-50 rounded-lg px-[14px] py-[18px] flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-ink">Tutor IA</span>
            <span className="text-xs text-mute leading-snug">
              Evalúa tu pronunciación con inteligencia artificial
            </span>
          </div>

          {bloqueadoPorAdmin ? (
            // El admin ha desactivado el tutor — no mostramos el toggle
            <span className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-surface text-mute border border-brand-100">
              No disponible
            </span>
          ) : (
            <button
              onClick={toggleTutor}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                tutorPreferido
                  ? "bg-brand-500 text-white"
                  : "bg-white text-mute border border-brand-100"
              }`}
            >
              {tutorPreferido ? "Activado" : "Desactivado"}
            </button>
          )}
        </div>

        <p className="text-xs text-mute px-1 leading-relaxed">
          {bloqueadoPorAdmin
            ? "El tutor está desactivado por el administrador."
            : "Si lo desactivas, el modo “Con tutor” no estará disponible al iniciar sesión. Puedes reactivarlo aquí en cualquier momento."}
        </p>
      </div>
    </main>
  );
}
