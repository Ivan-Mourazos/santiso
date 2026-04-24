-- 1. Crear tabla Temporadas
CREATE TABLE IF NOT EXISTS temporadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    activa BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Crear tabla Jornadas
CREATE TABLE IF NOT EXISTS jornadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    temporada_id UUID REFERENCES temporadas(id) ON DELETE CASCADE,
    categoria TEXT NOT NULL,
    numero INTEGER NOT NULL,
    fecha_inicio DATE,
    fecha_fin DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Crear tabla Partidos de Liga (reemplazará a 'partidos')
CREATE TABLE IF NOT EXISTS partidos_liga (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jornada_id UUID REFERENCES jornadas(id) ON DELETE CASCADE,
    categoria TEXT NOT NULL,
    equipo_local_id UUID REFERENCES equipos(id) ON DELETE CASCADE,
    equipo_visitante_id UUID REFERENCES equipos(id) ON DELETE CASCADE,
    goles_local INTEGER DEFAULT 0,
    goles_visitante INTEGER DEFAULT 0,
    estado TEXT DEFAULT 'programado', -- programado, en_juego, finalizado
    fecha TIMESTAMP WITH TIME ZONE,
    lugar TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Crear tabla de Estadísticas Específicas del Santiso
-- Para guardar datos de nuestro partido y autocompletar carteles de "Resumen"
CREATE TABLE IF NOT EXISTS estadisticas_partido_santiso (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partido_id UUID REFERENCES partidos_liga(id) ON DELETE CASCADE UNIQUE,
    goleadores TEXT, 
    asistencias TEXT,
    tarjetas_amarillas TEXT,
    tarjetas_rojas TEXT,
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Crear la VISTA de Clasificación Dinámica
-- IMPORTANTE: No borramos las columnas antiguas de 'equipos' aún para que tu web no se caiga.
DROP VIEW IF EXISTS vista_clasificacion;

CREATE VIEW vista_clasificacion AS
SELECT
    e.id AS equipo_id,
    e.nombre,
    e.escudo_url,
    e.categoria,
    -- Partidos jugados
    COUNT(p.id) AS pj,
    -- Victorias
    COUNT(CASE WHEN p.equipo_local_id = e.id AND p.goles_local > p.goles_visitante THEN 1 
               WHEN p.equipo_visitante_id = e.id AND p.goles_visitante > p.goles_local THEN 1 ELSE NULL END) AS pg,
    -- Empates
    COUNT(CASE WHEN p.goles_local = p.goles_visitante THEN 1 ELSE NULL END) AS pe,
    -- Derrotas
    COUNT(CASE WHEN p.equipo_local_id = e.id AND p.goles_local < p.goles_visitante THEN 1 
               WHEN p.equipo_visitante_id = e.id AND p.goles_visitante < p.goles_local THEN 1 ELSE NULL END) AS pp,
    -- Goles a favor
    COALESCE(SUM(CASE WHEN p.equipo_local_id = e.id THEN p.goles_local ELSE 0 END), 0) +
    COALESCE(SUM(CASE WHEN p.equipo_visitante_id = e.id THEN p.goles_visitante ELSE 0 END), 0) AS gf,
    -- Goles en contra
    COALESCE(SUM(CASE WHEN p.equipo_local_id = e.id THEN p.goles_visitante ELSE 0 END), 0) +
    COALESCE(SUM(CASE WHEN p.equipo_visitante_id = e.id THEN p.goles_local ELSE 0 END), 0) AS gc,
    -- Puntos calculados
    (
        COALESCE(SUM(CASE WHEN p.equipo_local_id = e.id AND p.goles_local > p.goles_visitante THEN 3 
                 WHEN p.equipo_visitante_id = e.id AND p.goles_visitante > p.goles_local THEN 3 ELSE 0 END), 0) +
        COALESCE(SUM(CASE WHEN p.goles_local = p.goles_visitante THEN 1 ELSE 0 END), 0)
    ) AS pts
FROM equipos e
LEFT JOIN partidos_liga p 
    ON (e.id = p.equipo_local_id OR e.id = p.equipo_visitante_id) 
    AND p.estado = 'finalizado'
GROUP BY e.id, e.nombre, e.escudo_url, e.categoria;
-- 6. Crear tabla de Jugadores (Plantilla)
CREATE TABLE IF NOT EXISTS jugadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    apodo TEXT, -- Nombre deportivo o apodo (Ej: Mourazos)
    dorsal INTEGER,
    posicion TEXT, -- Posición principal (abreviatura)
    posiciones_conocidas TEXT[] DEFAULT '{}', -- Array de posiciones que ha jugado (DFC, MCD, MI, MD, etc.)
    capitan INTEGER DEFAULT 0, -- 0: No es capitán, 1: Primer capitán, 2: Segundo...
    foto_url TEXT,
    categoria TEXT NOT NULL, -- Senior, Femenino, Veteranos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 7. Índice para búsqueda rápida por categoría
CREATE INDEX IF NOT EXISTS idx_jugadores_categoria ON jugadores(categoria);

-- 8. Crear tabla de Staff (Directiva y Cuerpo Técnico)
CREATE TABLE IF NOT EXISTS staff_club (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    cargo TEXT NOT NULL, -- Presidente, Entrenador, Delegado, etc.
    tipo TEXT NOT NULL, -- 'Directiva' o 'Tecnico'
    categoria TEXT, -- Senior, Femenino, Veteranos (NULL si es Directiva general)
    foto_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índice para filtrar staff por tipo/categoría
CREATE INDEX IF NOT EXISTS idx_staff_tipo_cat ON staff_club(tipo, categoria);

-- 9. Relación equipos por competición (evita duplicados por liga/copa)
CREATE TABLE IF NOT EXISTS equipo_competiciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipo_id UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    categoria TEXT NOT NULL,
    competicion TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (equipo_id, categoria, competicion)
);

CREATE INDEX IF NOT EXISTS idx_equipo_comp_cat_comp ON equipo_competiciones(categoria, competicion);

-- 10. Competición en jornadas y partidos para separar Liga/Copa
ALTER TABLE jornadas ADD COLUMN IF NOT EXISTS competicion TEXT;
ALTER TABLE partidos_liga ADD COLUMN IF NOT EXISTS competicion TEXT;

UPDATE jornadas SET competicion = COALESCE(competicion, 'Liga principal');
UPDATE partidos_liga SET competicion = COALESCE(competicion, 'Liga principal');

-- Tabla legacy "partidos" (solo si aún existe en algún proyecto)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'partidos'
  ) THEN
    ALTER TABLE partidos ADD COLUMN IF NOT EXISTS competicion TEXT;
    UPDATE partidos SET competicion = COALESCE(competicion, 'Liga principal');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_jornadas_categoria_comp ON jornadas(categoria, competicion);
CREATE INDEX IF NOT EXISTS idx_partidos_liga_categoria_comp ON partidos_liga(categoria, competicion);

-- 11. Descanso por jornada (equipo sin partido esa jornada)
CREATE TABLE IF NOT EXISTS jornada_equipo_descanso (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jornada_id UUID NOT NULL REFERENCES jornadas(id) ON DELETE CASCADE,
    equipo_id UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (jornada_id, equipo_id)
);

CREATE INDEX IF NOT EXISTS idx_jornada_descanso_jornada ON jornada_equipo_descanso(jornada_id);
CREATE INDEX IF NOT EXISTS idx_jornada_descanso_equipo ON jornada_equipo_descanso(equipo_id);

-- 12. Tablas y columnas auxiliares usadas por la web/admin
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

CREATE INDEX IF NOT EXISTS idx_partidos_liga_jornada_comp ON partidos_liga(jornada_id, competicion);
CREATE INDEX IF NOT EXISTS idx_partidos_liga_local ON partidos_liga(equipo_local_id);
CREATE INDEX IF NOT EXISTS idx_partidos_liga_visitante ON partidos_liga(equipo_visitante_id);
CREATE INDEX IF NOT EXISTS idx_partidos_liga_fecha ON partidos_liga(fecha);
CREATE INDEX IF NOT EXISTS idx_patrocinadores_orden ON patrocinadores(orden);
CREATE INDEX IF NOT EXISTS idx_cartel_assets_tipo ON cartel_assets(tipo, subtipo, orden);
CREATE INDEX IF NOT EXISTS idx_jugador_stats_jugador ON jugador_partido_stats(jugador_id);
CREATE INDEX IF NOT EXISTS idx_jugador_stats_partido ON jugador_partido_stats(partido_id);
