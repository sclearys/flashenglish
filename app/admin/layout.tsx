/**
 * Layout del backoffice (/admin).
 *
 * Responsabilidades:
 *   1. Verificar que el usuario tiene sesión Supabase activa.
 *   2. Verificar que su email coincide con ADMIN_EMAIL (variable de entorno
 *      de servidor — nunca sale al cliente).
 *   3. Si no cumple cualquiera de los dos, redirige silenciosamente a "/".
 *
 * Por qué dos capas (middleware + este layout):
 *   - El middleware ya redirige a /entrar si no hay sesión en absoluto.
 *   - Este layout añade la comprobación de "¿es el admin concreto?".
 *   - Separar las dos responsabilidades es más limpio que meter la lógica
 *     de ADMIN_EMAIL en el middleware, que ya tiene bastante.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const adminEmail = process.env.ADMIN_EMAIL;

  // Si la variable no está configurada, el backoffice queda inaccesible
  // (comportamiento seguro por defecto).
  if (!adminEmail) {
    redirect("/");
  }

  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        // En un Server Component de solo lectura no necesitamos setAll,
        // pero la interfaz lo requiere. Lo dejamos vacío.
        setAll() {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Sin sesión o email que no coincide → fuera
  if (!user || user.email !== adminEmail) {
    redirect("/");
  }

  // Acceso concedido: renderizar el contenido
  return <>{children}</>;
}
