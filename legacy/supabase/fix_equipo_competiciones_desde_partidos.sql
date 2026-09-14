-- Rellena equipo_competiciones desde partidos_liga.
-- Corrige equipos que juegan en una competicion pero no aparecen vinculados.
-- Seguro/idempotente: ON CONFLICT DO NOTHING.

BEGIN;

INSERT INTO equipo_competiciones (equipo_id, categoria, competicion)
SELECT DISTINCT
  e.id AS equipo_id,
  p.categoria,
  p.competicion
FROM partidos_liga p
JOIN equipos e ON e.id IN (p.equipo_local_id, p.equipo_visitante_id)
WHERE p.competicion IS NOT NULL
  AND TRIM(p.competicion) <> ''
ON CONFLICT (equipo_id, categoria, competicion) DO NOTHING;

COMMIT;

-- Comprobacion: bloque 5 de scripts/audit_integridad_bd.sql debe quedar vacio.
