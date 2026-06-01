"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@vercel/analytics";
import { crearClienteSupabase } from "@/lib/supabase";

type EstadoPantalla = "formulario" | "enviado" | "cargando";

export default function Entrar() {
  const router = useRouter();
  const [estado, setEstado] = useState<EstadoPantalla>("formulario");
  const [email, setEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function continuarSinCuenta() {
    track("continuar_sin_cuenta"); // evento custom en Vercel Analytics
    // Cookie persistente (1 año). El middleware la lee para dejar pasar sin auth.
    // Se borra automáticamente cuando el usuario hace login real.
    document.cookie = "modo_invitado=1; path=/; max-age=31536000; SameSite=Lax";
    router.push("/perfiles");
  }

  // El botón solo aparece si la variable de entorno está activa.
  // Para desactivarlo: borrar NEXT_PUBLIC_GUEST_MODE en Vercel → redeploy.
  const modoInvitadoActivo = process.env.NEXT_PUBLIC_GUEST_MODE === "true";

  async function entrarConGoogle() {
    setErrorMsg(null);
    const supabase = crearClienteSupabase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setErrorMsg("No se pudo conectar con Google. Prueba de nuevo.");
  }

  async function enviarEnlaceMagico() {
    if (!email.trim()) return;
    setErrorMsg(null);
    setEstado("cargando");

    const supabase = crearClienteSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setEstado("formulario");
      setErrorMsg("No se pudo enviar el enlace. Comprueba el email e inténtalo de nuevo.");
    } else {
      setEstado("enviado");
    }
  }

  async function reenviarEnlace() {
    setEstado("cargando");
    const supabase = crearClienteSupabase();
    await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setEstado("enviado");
  }

  // ── Vista: "Revisa tu correo" ─────────────────────────────────────────────

  if (estado === "enviado") {
    return (
      <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
          <span className="text-5xl">📬</span>
          <div className="flex flex-col gap-2">
            <h1 className="text-[22px] font-semibold text-ink">Revisa tu correo</h1>
            <p className="text-sm text-body">
              Te hemos enviado un enlace a{" "}
              <span className="font-semibold text-ink">{email}</span>.
              Púlsalo para entrar.
            </p>
          </div>
          <p className="text-sm text-mute">¿No ha llegado?</p>
          <button
            onClick={reenviarEnlace}
            className="text-sm font-semibold text-brand-500 hover:text-brand-700 transition-colors"
          >
            Reenviar enlace
          </button>
        </div>
      </main>
    );
  }

  // ── Vista: formulario de login ────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm flex flex-col gap-8">

        {/* Cabecera */}
        <div className="flex flex-col items-center gap-3 text-center">
          <img src="/logo-app.png" alt="FlashEnglish" className="w-14 h-14" />
          <div className="flex flex-col gap-1">
            <h1 className="text-[22px] font-semibold text-ink">FlashEnglish</h1>
            <p className="text-sm text-body">Tu progreso, en todos tus dispositivos</p>
          </div>
        </div>

        {/* Acciones de login */}
        <div className="flex flex-col gap-3">

          {/* Google OAuth */}
          <button
            onClick={entrarConGoogle}
            disabled={estado === "cargando"}
            className="w-full h-12 rounded-md bg-brand-500 text-white text-sm font-semibold hover:brightness-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2.5"
          >
            {/* Icono de Google (SVG inline — @tabler no funciona con Next 14) */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="white" fillOpacity="0.9"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="white" fillOpacity="0.9"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="white" fillOpacity="0.7"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="white" fillOpacity="0.7"/>
            </svg>
            Continuar con Google
          </button>

          {/* Separador */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-brand-100" />
            <span className="text-xs font-medium text-mute">o por email</span>
            <div className="flex-1 h-px bg-brand-100" />
          </div>

          {/* Magic link */}
          <div className="flex flex-col gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && enviarEnlaceMagico()}
              placeholder="tu@email.com"
              className="w-full h-12 rounded-md border border-brand-100 px-4 text-sm text-ink font-medium focus:outline-none focus:border-brand-500 transition-colors"
            />
            <button
              onClick={enviarEnlaceMagico}
              disabled={!email.trim() || estado === "cargando"}
              className="w-full h-12 rounded-md border border-brand-200 text-sm font-semibold text-ink hover:border-brand-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {estado === "cargando" ? "Enviando…" : "Envíame un enlace"}
            </button>
          </div>

          {/* Mensaje de error */}
          {errorMsg && (
            <p className="text-sm text-center font-medium" style={{ color: "#D94F3D" }}>
              {errorMsg}
            </p>
          )}
        </div>

        {/* Nota de privacidad */}
        <p className="text-xs text-mute text-center">
          Solo guardamos tu progreso. Sin spam, sin datos de terceros.
        </p>

        {/* Modo invitado — visible solo si NEXT_PUBLIC_GUEST_MODE=true */}
        {modoInvitadoActivo && (
          <button
            onClick={continuarSinCuenta}
            className="text-xs font-medium text-mute hover:text-body transition-colors text-center"
          >
            Continuar sin cuenta →
          </button>
        )}
      </div>
    </main>
  );
}
