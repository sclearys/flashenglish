/**
 * lib/supabase-admin.ts — Cliente Supabase con service role key.
 *
 * IMPORTANTE: importar SOLO desde código de servidor (Server Components,
 * Server Actions, API Routes). Nunca desde componentes "use client".
 *
 * Por qué usar createClient y no createServerClient:
 *   - La service role key bypassa el RLS completamente; no necesita cookies
 *     de sesión del usuario actual porque actúa como superadmin.
 *   - createServerClient está pensado para leer la sesión del usuario desde
 *     cookies. Aquí no necesitamos eso.
 *
 * USO: const supabase = crearClienteAdmin();
 */

import { createClient } from "@supabase/supabase-js";

export function crearClienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. " +
        "Añádelas a .env.local y reinicia el servidor."
    );
  }

  return createClient(url, key, {
    auth: {
      // Con service role no necesitamos gestión de sesión propia
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
