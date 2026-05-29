// Server Component async: lee el estado del tutor para el usuario actual antes de renderizar.
// El Suspense sigue siendo necesario porque SesionInterna usa useSearchParams().

import { Suspense } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import SesionInterna from "./SesionInterna";

export default async function Sesion() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Dos flags independientes — ambos deben ser true para que el tutor esté disponible:
  //   tutor_activo  → control del admin (nunca escrito por el usuario).
  //   tutorPreferido → preferencia del usuario, guardada dentro del AppState JSONB.
  let tutorActivo = true;
  if (user) {
    const { data } = await supabase
      .from("estado_usuario")
      .select("tutor_activo, estado")
      .eq("cuenta_id", user.id)
      .single();

    // Admin ha desactivado el tutor para este usuario.
    if (data?.tutor_activo === false) tutorActivo = false;

    // Usuario ha desactivado el tutor en sus preferencias.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const estadoJson = data?.estado as Record<string, any> | null;
    if (estadoJson?.tutorPreferido === false) tutorActivo = false;
  }

  return (
    <Suspense fallback={
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-body text-sm">Cargando...</p>
      </main>
    }>
      <SesionInterna tutorActivo={tutorActivo} />
    </Suspense>
  );
}
