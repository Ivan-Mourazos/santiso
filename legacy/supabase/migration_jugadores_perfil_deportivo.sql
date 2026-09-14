-- Datos ampliados para ficha/reverso de cromos de jugadores.
-- No rompe datos existentes: todas las columnas nuevas son opcionales.

ALTER TABLE jugadores
  ADD COLUMN IF NOT EXISTS fecha_nacimiento date,
  ADD COLUMN IF NOT EXISTS lugar_nacimiento text,
  ADD COLUMN IF NOT EXISTS altura_cm integer,
  ADD COLUMN IF NOT EXISTS peso_kg integer,
  ADD COLUMN IF NOT EXISTS pierna_dominante text,
  ADD COLUMN IF NOT EXISTS club_anterior text,
  ADD COLUMN IF NOT EXISTS temporada_alta text,
  ADD COLUMN IF NOT EXISTS historial_deportivo text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS bio_deportiva text;

COMMENT ON COLUMN jugadores.fecha_nacimiento IS 'Fecha de nacimiento del jugador.';
COMMENT ON COLUMN jugadores.lugar_nacimiento IS 'Lugar de nacimiento o procedencia.';
COMMENT ON COLUMN jugadores.altura_cm IS 'Altura en centímetros.';
COMMENT ON COLUMN jugadores.peso_kg IS 'Peso en kilogramos.';
COMMENT ON COLUMN jugadores.pierna_dominante IS 'Diestra, zurda o ambidiestro.';
COMMENT ON COLUMN jugadores.club_anterior IS 'Último club antes de llegar al Santiso.';
COMMENT ON COLUMN jugadores.temporada_alta IS 'Temporada de llegada al club, por ejemplo 2025/2026.';
COMMENT ON COLUMN jugadores.historial_deportivo IS 'Lista ordenada de etapas deportivas.';
COMMENT ON COLUMN jugadores.bio_deportiva IS 'Texto breve para reverso del cromo.';

CREATE INDEX IF NOT EXISTS idx_jugadores_temporada_alta
  ON jugadores (temporada_alta);

CREATE TABLE IF NOT EXISTS jugador_carrera_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jugador_id uuid NOT NULL REFERENCES jugadores(id) ON DELETE CASCADE,
  temporada text NOT NULL,
  club text NOT NULL,
  categoria text,
  logros text,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jugador_carrera_jugador
  ON jugador_carrera_etapas (jugador_id, orden);

-- Ejemplo de actualización:
-- UPDATE jugadores
-- SET
--   fecha_nacimiento = '1998-04-12',
--   lugar_nacimiento = 'Santiso',
--   altura_cm = 181,
--   peso_kg = 76,
--   pierna_dominante = 'Derecha',
--   club_anterior = 'CD Ejemplo',
--   temporada_alta = '2025/2026',
--   historial_deportivo = ARRAY['Base UD Santiso', 'CD Ejemplo', 'UD Santiso FC'],
--   bio_deportiva = 'Centrocampista de recorrido, fuerte en presión y llegada.'
-- WHERE nombre = 'Nombre Jugador';
