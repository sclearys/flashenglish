/**
 * Route Handler: /auth/callback
 *
 * Supabase redirige aquí después de un login con Google OAuth o magic link.
 * El parámetro `code` es un código de autorización de un solo uso que
 * intercambiamos por una sesión real (access token + refresh token en cookies).
 *
 * Flujo:
 *   Google OAuth / magic link → Supabase → /auth/callback?code=xxx
 *   → exchangeCodeForSession → sesión guardada en cookie → /perfiles
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const cookieStore = cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Login correcto → limpiar cookie de invitado (ya no la necesita)
      // y redirigir al selector de perfiles
      const respuesta = NextResponse.redirect(`${origin}/perfiles`);
      respuesta.cookies.set("modo_invitado", "", { path: "/", maxAge: 0 });
      return respuesta;
    }
  }

  // Si no hay code o el intercambio falló → volver al login con error
  return NextResponse.redirect(`${origin}/entrar?error=callback`);
}
