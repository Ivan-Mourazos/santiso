-- Migracion incremental segura. Ejecutar tras revisar audit_integridad_bd.sql.
-- No borra datos. Usa IF NOT EXISTS cuando Postgres lo permite.

BEGIN;

-- Campos/estadios usados por AdminJornadas y app/partidos.
CREATE TABLE IF NOT EXISTS campos_futbol (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    poblacion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE partidos_liga ADD COLUMN IF NOT EXISTS campo_id UUID;
ALTER TABLE partidos_liga
  DROP CONSTRAINT IF EXISTS partidos_liga_campo_id_fkey;
ALTER TABLE partidos_liga
  ADD CONSTRAINT partidos_liga_campo_id_fkey
  FOREIGN KEY (campo_id) REFERENCES campos_futbol(id) ON DELETE SET NULL;

-- Tablas usadas por home/admin/carteles/noticias.
CREATE TABLE IF NOT EXISTS patrocinadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    logo_url TEXT NOT NULL,
    web_url TEXT,
    orden INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cartel_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL,
    subtipo TEXT,
    url TEXT NOT NULL DEFAULT '',
    orden INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (tipo, subtipo)
);

CREATE TABLE IF NOT EXISTS noticias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    contenido TEXT,
    imagen_url TEXT,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jugador_partido_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jugador_id UUID NOT NULL REFERENCES jugadores(id) ON DELETE CASCADE,
    partido_id UUID NOT NULL REFERENCES partidos_liga(id) ON DELETE CASCADE,
    titular BOOLEAN DEFAULT false,
    jugo BOOLEAN DEFAULT false,
    goles INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (jugador_id, partido_id)
);

-- Indices para consultas frecuentes.
CREATE INDEX IF NOT EXISTS idx_partidos_liga_jornada_comp ON partidos_liga(jornada_id, competicion);
CREATE INDEX IF NOT EXISTS idx_partidos_liga_local ON partidos_liga(equipo_local_id);
CREATE INDEX IF NOT EXISTS idx_partidos_liga_visitante ON partidos_liga(equipo_visitante_id);
CREATE INDEX IF NOT EXISTS idx_partidos_liga_fecha ON partidos_liga(fecha);
CREATE INDEX IF NOT EXISTS idx_campos_futbol_nombre ON campos_futbol(nombre);
CREATE INDEX IF NOT EXISTS idx_patrocinadores_orden ON patrocinadores(orden);
CREATE INDEX IF NOT EXISTS idx_cartel_assets_tipo ON cartel_assets(tipo, subtipo, orden);
CREATE INDEX IF NOT EXISTS idx_jugador_stats_jugador ON jugador_partido_stats(jugador_id);
CREATE INDEX IF NOT EXISTS idx_jugador_stats_partido ON jugador_partido_stats(partido_id);

-- Restricciones de negocio que solo se activan si los datos ya estan limpios.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM jornadas
    GROUP BY temporada_id, categoria, competicion, numero
    HAVING COUNT(*) > 1
  ) THEN
    ALTER TABLE jornadas
      ADD CONSTRAINT jornadas_temporada_categoria_comp_num_unique
      UNIQUE (temporada_id, categoria, competicion, numero);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE partidos_liga
    ADD CONSTRAINT partidos_liga_distinct_teams
    CHECK (equipo_local_id IS DISTINCT FROM equipo_visitante_id);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

COMMIT;

-- RLS sugerida (NO ejecutar sin adaptar roles/admin auth):
-- ALTER TABLE temporadas ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE jornadas ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE partidos_liga ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE equipos ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE equipo_competiciones ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE jornada_equipo_descanso ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "public read jornadas" ON jornadas FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "public read partidos" ON partidos_liga FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "public read equipos" ON equipos FOR SELECT TO anon, authenticated USING (true);
