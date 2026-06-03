/**
 * Cliente de Supabase para componentes de navegador ("use client").
 *
 * Usamos createBrowserClient de @supabase/ssr en lugar del createClient
 * básico porque guarda la sesión en cookies (en vez de localStorage),
 * lo que permite que el middleware del servidor la lea y valide.
 *
 * PATRÓN: función, no singleton. createBrowserClient gestiona internamente
 * la deduplicación, así que llamarlo en cada render es seguro y es el
 * patrón oficial de Supabase para Next.js App Router.
 *
 * USO: const supabase = crearClienteSupabase();
 */

import { createBrowserClient } from "@supabase/ssr";

export function crearClienteSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Faltan variables de entorno de Supabase. " +
        "Copia .env.local.example a .env.local y rellena tus valores."
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      flowType: "implicit",
    },
  });
}
