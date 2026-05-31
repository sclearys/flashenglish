-- ============================================================
-- FlashEnglish — Migración 004: tabla sesiones
-- Ejecutar en: supabase.com → tu proyecto → SQL Editor → New query
-- ============================================================

-- TABLA: sesiones
-- Registra cada sesión de bloque completada para auditoría del trenzado (Pieza H).
-- Permite al admin controlar cuántas frases se saltan por sesión y ajustar
-- el parámetro nLecciones si el trade-off resulta inaceptable.
-- Las sesiones de refuerzo temático (Fase 3) NO se registran aquí.

CREATE TABLE sesiones (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cuenta_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  perfil_id       TEXT NOT NULL,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bloque          TEXT NOT NULL,
  frases_total    INTEGER NOT NULL DEFAULT 0,
  frases_saltadas INTEGER NOT NULL DEFAULT 0
);

-- Índice para el query más frecuente: "sesiones de este usuario, más recientes primero".
CREATE INDEX idx_sesiones_cuenta ON sesiones (cuenta_id, creado_en DESC);

ALTER TABLE sesiones ENABLE ROW LEVEL SECURITY;

-- El usuario puede insertar sus propias sesiones desde el cliente.
CREATE POLICY "sesiones_insert_propio"
  ON sesiones FOR INSERT
  WITH CHECK (auth.uid() = cuenta_id);

-- El usuario puede leer sus propias sesiones (previsión futura).
CREATE POLICY "sesiones_select_propio"
  ON sesiones FOR SELECT
  USING (auth.uid() = cuenta_id);

-- Admin lee con service role (bypassa RLS automáticamente).
