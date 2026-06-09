"use client";

// Pantalla de preferencias de usuario (Pieza G.5 + F2).
//
// Diseño de dos capas para el toggle del tutor IA:
//   - tutor_activo (columna DB): control del admin. Este componente NUNCA lo escribe.
//   - AppState.tutorPreferido: preferencia del usuario. Se escribe en localStorage + Supabase.
//
// Si el admin ha desactivado el tutor, el toggle se oculta y se muestra un aviso.
// La opción de test de nivel solo aparece si el perfil activo no ha hecho ni omitido el test.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { crearClienteSupabase } from "@/lib/supabase";
import { cargarEstado, guardarEstado, obtenerPerfilActivo } from "@/lib/storage";

export default function Preferencias() {
  const router = useRouter();

  const [bloqueadoPorAdmin, setBloqueadoPorAdmin] = useState(false);
  const [tutorPreferido, setTutorPreferido] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [mostrarModalTest, setMostrarModalTest] = useState(false);
  const [nombrePerfil, setNombrePerfil] = useState("");

  useEffect(() => {
    async function cargar() {
      const supabase = crearClienteSupabase();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/perfiles");
        return;
      }

      const { data } = await supabase
        .from("estado_usuario")
        .select("tutor_activo")
        .eq("cuenta_id", user.id)
        .single();

      if (data?.tutor_activo === false) setBloqueadoPorAdmin(true);

      const estado = cargarEstado();
      if (estado.tutorPreferido === false) setTutorPreferido(false);

      const perfil = obtenerPerfilActivo(estado);
      setNombrePerfil(perfil.nombre);

      setCargando(false);
    }
    cargar();
  }, [router]);

  function toggleTutor() {
    const nuevo = !tutorPreferido;
    setTutorPreferido(nuevo);
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
          &larr; Volver
        </button>
        <h1 className="text-[18px] font-semibold text-ink">
          Preferencias{nombrePerfil ? ` · ${nombrePerfil}` : ""}
        </h1>
      </div>

      {/* Seccion: Tutor IA */}
      <div className="w-full max-w-sm flex flex-col gap-3">
        <div className="bg-brand-50 rounded-lg px-[14px] py-[18px] flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-ink">Tutor IA</span>
            <span className="text-xs text-mute leading-snug">
              Evalua tu pronunciacion con inteligencia artificial
            </span>
          </div>

          {bloqueadoPorAdmin ? (
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
            ? "El tutor esta desactivado por el administrador."
            : "Si lo desactivas, el modo Con tutor no estara disponible al iniciar sesion. Puedes reactivarlo aqui en cualquier momento."}
        </p>
      </div>

      {/* Seccion: Test de nivel */}
      <div className="w-full max-w-sm flex flex-col gap-3 mt-6">
          <button
            onClick={() => setMostrarModalTest(true)}
            className="bg-brand-50 rounded-lg px-[14px] py-[18px] flex items-center justify-between gap-4 w-full text-left hover:bg-brand-100 transition-colors"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-ink">Hacer el test de nivel</span>
              <span className="text-xs text-mute leading-snug">
                Descubre desde que bloque deberias empezar. Tu progreso no se borrara.
              </span>
            </div>
            <svg className="shrink-0 text-mute" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
      </div>

      {/* Modal confirmacion test de nivel */}
      {mostrarModalTest && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4">
            <h2 className="text-[16px] font-semibold text-ink">Hacer el test de nivel?</h2>
            <p className="text-[14px] text-body leading-relaxed">
              Analizaremos tu nivel y te colocaremos en el bloque adecuado. Tu progreso actual no se borrara.
            </p>
            <div className="flex flex-col gap-2 mt-2">
              <button
                onClick={() => router.push("/test-nivel?desde=ajustes")}
                className="w-full py-3 rounded-xl bg-brand-500 text-white text-[15px] font-semibold hover:bg-brand-600 transition-colors"
              >
                Empezar test
              </button>
              <button
                onClick={() => setMostrarModalTest(false)}
                className="w-full py-3 rounded-xl text-[15px] font-medium text-mute hover:text-body transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
