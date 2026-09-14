-- Auditoria de integridad BD (solo lectura). Ejecutar en Supabase SQL Editor.
-- Filas devueltas = revisar antes de tocar datos.

-- 1) Jornadas sin temporada.
SELECT j.*
FROM jornadas j
LEFT JOIN temporadas t ON t.id = j.temporada_id
WHERE j.temporada_id IS NULL OR t.id IS NULL;

-- 2) Partidos sin jornada o con categoria/competicion distinta a su jornada.
SELECT
  p.id,
  p.jornada_id,
  p.categoria AS partido_categoria,
  j.categoria AS jornada_categoria,
  p.competicion AS partido_competicion,
  j.competicion AS jornada_competicion
FROM partidos_liga p
LEFT JOIN jornadas j ON j.id = p.jornada_id
WHERE j.id IS NULL
   OR p.categoria IS DISTINCT FROM j.categoria
   OR COALESCE(NULLIF(TRIM(p.competicion), ''), 'Liga principal')
      IS DISTINCT FROM COALESCE(NULLIF(TRIM(j.competicion), ''), 'Liga principal');

-- 3) Partidos con equipos borrados o nulos.
SELECT
  p.id,
  p.equipo_local_id,
  el.nombre AS local_nombre,
  p.equipo_visitante_id,
  ev.nombre AS visitante_nombre
FROM partidos_liga p
LEFT JOIN equipos el ON el.id = p.equipo_local_id
LEFT JOIN equipos ev ON ev.id = p.equipo_visitante_id
WHERE p.equipo_local_id IS NULL
   OR p.equipo_visitante_id IS NULL
   OR el.id IS NULL
   OR ev.id IS NULL;

-- 4) Partidos donde local y visitante son el mismo equipo.
SELECT id, jornada_id, equipo_local_id, equipo_visitante_id
FROM partidos_liga
WHERE equipo_local_id = equipo_visitante_id;

-- 5) Equipos que juegan pero no estan vinculados en equipo_competiciones.
SELECT DISTINCT
  p.categoria,
  p.competicion,
  e.id AS equipo_id,
  e.nombre
FROM partidos_liga p
JOIN equipos e ON e.id IN (p.equipo_local_id, p.equipo_visitante_id)
LEFT JOIN equipo_competiciones ec
  ON ec.equipo_id = e.id
 AND ec.categoria = p.categoria
 AND ec.competicion = p.competicion
WHERE ec.id IS NULL
ORDER BY p.categoria, p.competicion, e.nombre;

-- 6) Descansos incompatibles: equipo descansa y juega en la misma jornada.
SELECT
  d.id AS descanso_id,
  d.jornada_id,
  e.nombre,
  p.id AS partido_id
FROM jornada_equipo_descanso d
JOIN equipos e ON e.id = d.equipo_id
JOIN partidos_liga p
  ON p.jornada_id = d.jornada_id
 AND d.equipo_id IN (p.equipo_local_id, p.equipo_visitante_id);

-- 7) Descansos con categoria distinta a la jornada.
SELECT
  d.id,
  j.categoria AS jornada_categoria,
  e.categoria AS equipo_categoria,
  e.nombre
FROM jornada_equipo_descanso d
JOIN jornadas j ON j.id = d.jornada_id
JOIN equipos e ON e.id = d.equipo_id
WHERE e.categoria IS DISTINCT FROM j.categoria;

-- 8) Competiciones no canonicas: comparar con lista actual de la web.
WITH canon(categoria, competicion) AS (
  VALUES
    ('Senior', 'Terceira Galicia - Santiago - Grupo 4'),
    ('Senior', 'Terceira Galicia - Santiago - Fase Copa - Grupo 4'),
    ('Veteranos', 'División Da Honra - Veteranos - Santiago'),
    ('Veteranos', 'Veteranos Copa - Santiago'),
    ('Femenino', 'Segunda División Galega - Grupo 2')
)
SELECT 'jornadas' AS tabla, categoria, competicion, COUNT(*) AS n
FROM jornadas j
WHERE NOT EXISTS (
  SELECT 1 FROM canon c WHERE c.categoria = j.categoria AND c.competicion = j.competicion
)
GROUP BY categoria, competicion
UNION ALL
SELECT 'partidos_liga' AS tabla, categoria, competicion, COUNT(*) AS n
FROM partidos_liga p
WHERE NOT EXISTS (
  SELECT 1 FROM canon c WHERE c.categoria = p.categoria AND c.competicion = p.competicion
)
GROUP BY categoria, competicion
UNION ALL
SELECT 'equipo_competiciones' AS tabla, categoria, competicion, COUNT(*) AS n
FROM equipo_competiciones ec
WHERE NOT EXISTS (
  SELECT 1 FROM canon c WHERE c.categoria = ec.categoria AND c.competicion = ec.competicion
)
GROUP BY categoria, competicion
ORDER BY tabla, categoria, competicion;

-- 9) Estado RLS y politicas.
SELECT
  c.relname AS tabla,
  c.relrowsecurity AS rls_activo,
  p.policyname,
  p.cmd,
  p.roles
FROM pg_class c
LEFT JOIN pg_policies p ON p.tablename = c.relname
WHERE c.relkind = 'r'
  AND c.relnamespace = 'public'::regnamespace
  AND c.relname IN (
    'temporadas', 'jornadas', 'partidos_liga', 'equipos',
    'equipo_competiciones', 'jornada_equipo_descanso', 'campos_futbol',
    'jugadores', 'staff_club', 'patrocinadores', 'cartel_assets', 'noticias'
  )
ORDER BY c.relname, p.policyname;
