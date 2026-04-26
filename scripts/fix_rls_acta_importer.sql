-- Fix RLS para importador de actas.
-- Ejecutar en Supabase SQL Editor.
-- Sigue el patrón actual del panel admin: lectura y gestión desde cliente anon/public.

BEGIN;

CREATE TABLE IF NOT EXISTS partido_eventos_santiso (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partido_id UUID NOT NULL REFERENCES partidos_liga(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    minuto INTEGER,
    jugador_id UUID REFERENCES jugadores(id) ON DELETE SET NULL,
    jugador_relacionado_id UUID REFERENCES jugadores(id) ON DELETE SET NULL,
    es_rival BOOLEAN NOT NULL DEFAULT false,
    nombre_mostrado TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE partido_eventos_santiso
    ADD COLUMN IF NOT EXISTS es_rival BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE partido_eventos_santiso
    ADD COLUMN IF NOT EXISTS nombre_mostrado TEXT;

CREATE INDEX IF NOT EXISTS idx_partido_eventos_santiso_partido
    ON partido_eventos_santiso(partido_id);

ALTER TABLE jugador_partido_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE partido_eventos_santiso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura publica jugador_partido_stats" ON jugador_partido_stats;
CREATE POLICY "Lectura publica jugador_partido_stats"
ON jugador_partido_stats
FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "Gestion publica jugador_partido_stats" ON jugador_partido_stats;
CREATE POLICY "Gestion publica jugador_partido_stats"
ON jugador_partido_stats
FOR ALL
TO public
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Lectura publica partido_eventos_santiso" ON partido_eventos_santiso;
CREATE POLICY "Lectura publica partido_eventos_santiso"
ON partido_eventos_santiso
FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "Gestion publica partido_eventos_santiso" ON partido_eventos_santiso;
CREATE POLICY "Gestion publica partido_eventos_santiso"
ON partido_eventos_santiso
FOR ALL
TO public
USING (true)
WITH CHECK (true);

COMMIT;

-- Comprobación:
-- SELECT tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE tablename IN ('jugador_partido_stats', 'partido_eventos_santiso')
-- ORDER BY tablename, policyname;
