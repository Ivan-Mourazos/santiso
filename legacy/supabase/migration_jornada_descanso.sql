-- Equipos que descansan en una jornada (sin partido). Ejecutar una vez en Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS jornada_equipo_descanso (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jornada_id UUID NOT NULL REFERENCES jornadas(id) ON DELETE CASCADE,
    equipo_id UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (jornada_id, equipo_id)
);

CREATE INDEX IF NOT EXISTS idx_jornada_descanso_jornada ON jornada_equipo_descanso(jornada_id);
CREATE INDEX IF NOT EXISTS idx_jornada_descanso_equipo ON jornada_equipo_descanso(equipo_id);
