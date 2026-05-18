"use client";

import { Suspense } from "react";
import TestNivelInterno from "./TestNivelInterno";

export default function TestNivel() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-body text-sm">Cargando...</p>
      </main>
    }>
      <TestNivelInterno />
    </Suspense>
  );
}
