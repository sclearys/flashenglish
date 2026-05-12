"use client";

import { Suspense } from "react";
import SesionInterna from "./SesionInterna";

export default function Sesion() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-body text-sm">Cargando...</p>
      </main>
    }>
      <SesionInterna />
    </Suspense>
  );
}
