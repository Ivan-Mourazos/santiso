-- Diagnóstico de duplicados (ejecutar en Supabase SQL Editor).
-- No modifica datos. Revisa cada bloque; filas > 0 = posible problema.

-- =============================================================================
-- 1) EQUIPOS: mismo nombre exacto y categoría (dos filas distintas)
-- =============================================================================
SELECT nombre, categoria, COUNT(*) AS n, array_agg(id ORDER BY id) AS ids
FROM equipos
GROUP BY nombre, categoria
HAVING COUNT(*) > 1
ORDER BY n DESC, categoria, nombre;

-- 1b) Nombre “casi” igual (mayúsculas/espacios); ajusta si quieres más estricto
SELECT categoria, lower(trim(nombre)) AS nombre_norm, COUNT(*) AS n, array_agg(id) AS ids
FROM equipos
GROUP BY categoria, lower(trim(nombre))
HAVING COUNT(*) > 1;

-- =============================================================================
-- 2) PARTIDOS_LIGA: mismo cruce en la misma jornada (duplicado clásico)
-- =============================================================================
SELECT
  jornada_id,
  equipo_local_id,
  equipo_visitante_id,
  COUNT(*) AS n,
  array_agg(id ORDER BY id) AS partido_ids
FROM partidos_liga
GROUP BY jornada_id, equipo_local_id, equipo_visitante_id
HAVING COUNT(*) > 1
ORDER BY n DESC;

-- 2b) Misma jornada + pareja (local/visitante intercambiados) — revisar calendario
SELECT
  p.jornada_id,
  LEAST(p.equipo_local_id::text, p.equipo_visitante_id::text) AS a,
  GREATEST(p.equipo_local_id::text, p.equipo_visitante_id::text) AS b,
  COUNT(*) AS n
FROM partidos_liga p
GROUP BY p.jornada_id, a, b
HAVING COUNT(*) > 1;

-- 2c) Misma fecha (día) + local + visitante + categoría (posible doble carga)
SELECT
  categoria,
  date_trunc('day', fecha AT TIME ZONE 'UTC')::date AS dia,
  equipo_local_id,
  equipo_visitante_id,
  COUNT(*) AS n,
  array_agg(id) AS ids
FROM partidos_liga
WHERE fecha IS NOT NULL
GROUP BY categoria, dia, equipo_local_id, equipo_visitante_id
HAVING COUNT(*) > 1
ORDER BY n DESC;

-- =============================================================================
-- 3) EQUIPO_COMPETICIONES: no debería haber duplicados (UNIQUE en migración)
-- =============================================================================
SELECT equipo_id, categoria, competicion, COUNT(*) AS n
FROM equipo_competiciones
GROUP BY equipo_id, categoria, competicion
HAVING COUNT(*) > 1;

-- =============================================================================
-- 4) JORNADAS: mismo número de jornada misma temporada/categoría/competición
-- =============================================================================
SELECT temporada_id, categoria, competicion, numero, COUNT(*) AS n, array_agg(id) AS ids
FROM jornadas
GROUP BY temporada_id, categoria, competicion, numero
HAVING COUNT(*) > 1
ORDER BY temporada_id, categoria, numero;
