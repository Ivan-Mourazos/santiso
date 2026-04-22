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
