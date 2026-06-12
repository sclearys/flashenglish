/**
 * Middleware de autenticación.
 *
 * Se ejecuta en el servidor antes de cada request (excepto assets estáticos).
 * Dos responsabilidades:
 *   1. Refrescar el token de sesión si está a punto de caducar.
 *   2. Redirigir a /entrar si el usuario no está autenticado.
 *
 * IMPORTANTE: siempre devolver `supabaseResponse`, no un NextResponse.next()
 * nuevo. Si se crea una respuesta nueva, las cookies de sesión no se propagan
 * y el usuario queda atrapado en un bucle de redirección.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rutas accesibles sin login
const RUTAS_PUBLICAS = ["/entrar", "/auth/callback", "/como-funciona", "/conoce"];

export async function middleware(request: NextRequest) {
  // Construimos la respuesta base que irá acumulando cookies
  let supabaseResponse = NextResponse.next({ request });

  // Si las variables de entorno de Supabase no están configuradas
  // (p.ej. durante un deploy sin credenciales), dejamos pasar sin guard.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Propagar cookies al request interno
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Recrear la respuesta con las cookies actualizadas
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() verifica el JWT con Supabase y refresca el token si hace falta.
  // Usar getUser() (no getSession()) porque getUser() contacta con el servidor
  // de Supabase y es la comprobación canónica de autenticidad.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const esRutaPublica = RUTAS_PUBLICAS.some((ruta) =>
    pathname.startsWith(ruta)
  );
  const esModoInvitado =
    request.cookies.get("modo_invitado")?.value === "1";

  // Permitir si: hay sesión Supabase, ruta pública, o modo invitado activo
  if (!user && !esRutaPublica && !esModoInvitado) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  // Excluir assets estáticos y rutas internas de Next.js
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.json).*)",
  ],
};
