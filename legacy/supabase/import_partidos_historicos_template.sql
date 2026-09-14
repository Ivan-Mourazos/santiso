-- Importador rápido de partidos históricos.
-- Uso:
-- 1) Pega filas en tmp_partidos_historicos.
-- 2) Ejecuta bloque "dry-run".
-- 3) Si no hay errores, ejecuta upsert.

BEGIN;

CREATE TEMP TABLE tmp_partidos_historicos (
  temporada text NOT NULL,
  categoria text NOT NULL,
  competicion text NOT NULL,
  jornada integer NOT NULL,
  local_nombre text NOT NULL,
  visitante_nombre text NOT NULL,
  fecha timestamptz,
  campo text,
  goles_local integer,
  goles_visitante integer,
  estado text DEFAULT 'programado'
) ON COMMIT DROP;

-- Ejemplo:
-- INSERT INTO tmp_partidos_historicos
-- (temporada, categoria, competicion, jornada, local_nombre, visitante_nombre, fecha, campo, goles_local, goles_visitante, estado)
-- VALUES
-- ('2025/2026', 'Senior', 'Terceira Galicia - Santiago - Grupo 4', 1, 'UD Santiso FC', 'Rival FC', '2025-09-14 18:00+02', 'A Merced', 2, 1, 'finalizado');

-- DRY-RUN: equipos no encontrados.
SELECT 'equipo_local_no_encontrado' AS problema, i.*
FROM tmp_partidos_historicos i
LEFT JOIN equipos e
  ON lower(trim(e.nombre)) = lower(trim(i.local_nombre))
  AND e.categoria = i.categoria
WHERE e.id IS NULL;

SELECT 'equipo_visitante_no_encontrado' AS problema, i.*
FROM tmp_partidos_historicos i
LEFT JOIN equipos e
  ON lower(trim(e.nombre)) = lower(trim(i.visitante_nombre))
  AND e.categoria = i.categoria
WHERE e.id IS NULL;

-- DRY-RUN: duplicados dentro del propio lote.
SELECT
  temporada,
  categoria,
  competicion,
  jornada,
  local_nombre,
  visitante_nombre,
  COUNT(*) AS repetidos
FROM tmp_partidos_historicos
GROUP BY 1, 2, 3, 4, 5, 6
HAVING COUNT(*) > 1;

-- UPSERT: temporada.
INSERT INTO temporadas (nombre, activa)
SELECT DISTINCT temporada, false
FROM tmp_partidos_historicos i
WHERE NOT EXISTS (
  SELECT 1 FROM temporadas t WHERE t.nombre = i.temporada
);

-- UPSERT: jornadas.
INSERT INTO jornadas (temporada_id, categoria, competicion, numero)
SELECT DISTINCT t.id, i.categoria, i.competicion, i.jornada
FROM tmp_partidos_historicos i
JOIN temporadas t ON t.nombre = i.temporada
WHERE NOT EXISTS (
  SELECT 1
  FROM jornadas j
  WHERE j.temporada_id = t.id
    AND j.categoria = i.categoria
    AND j.competicion = i.competicion
    AND j.numero = i.jornada
);

-- UPSERT: partidos.
INSERT INTO partidos_liga (
  jornada_id,
  categoria,
  competicion,
  equipo_local_id,
  equipo_visitante_id,
  goles_local,
  goles_visitante,
  fecha,
  lugar,
  estado
)
SELECT
  j.id,
  i.categoria,
  i.competicion,
  el.id,
  ev.id,
  i.goles_local,
  i.goles_visitante,
  i.fecha,
  NULLIF(trim(i.campo), ''),
  COALESCE(NULLIF(i.estado, ''), 'programado')
FROM tmp_partidos_historicos i
JOIN temporadas t ON t.nombre = i.temporada
JOIN jornadas j
  ON j.temporada_id = t.id
  AND j.categoria = i.categoria
  AND j.competicion = i.competicion
  AND j.numero = i.jornada
JOIN equipos el
  ON lower(trim(el.nombre)) = lower(trim(i.local_nombre))
  AND el.categoria = i.categoria
JOIN equipos ev
  ON lower(trim(ev.nombre)) = lower(trim(i.visitante_nombre))
  AND ev.categoria = i.categoria
WHERE NOT EXISTS (
  SELECT 1
  FROM partidos_liga p
  WHERE p.jornada_id = j.id
    AND p.equipo_local_id = el.id
    AND p.equipo_visitante_id = ev.id
);

UPDATE partidos_liga p
SET
  goles_local = i.goles_local,
  goles_visitante = i.goles_visitante,
  fecha = i.fecha,
  lugar = NULLIF(trim(i.campo), ''),
  estado = COALESCE(NULLIF(i.estado, ''), 'programado'),
  competicion = i.competicion
FROM tmp_partidos_historicos i
JOIN temporadas t ON t.nombre = i.temporada
JOIN jornadas j
  ON j.temporada_id = t.id
  AND j.categoria = i.categoria
  AND j.competicion = i.competicion
  AND j.numero = i.jornada
JOIN equipos el
  ON lower(trim(el.nombre)) = lower(trim(i.local_nombre))
  AND el.categoria = i.categoria
JOIN equipos ev
  ON lower(trim(ev.nombre)) = lower(trim(i.visitante_nombre))
  AND ev.categoria = i.categoria
WHERE p.jornada_id = j.id
  AND p.equipo_local_id = el.id
  AND p.equipo_visitante_id = ev.id;

-- Resumen final.
SELECT
  i.temporada,
  i.categoria,
  i.competicion,
  COUNT(*) AS filas_procesadas
FROM tmp_partidos_historicos i
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;

COMMIT;
