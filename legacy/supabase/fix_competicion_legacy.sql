-- fix_competicion_legacy.sql
-- Run in Supabase → SQL Editor. Backup first if unsure.
-- Strings MUST match components/admin/cartel/types.ts → COMPETICIONS.
--
-- Senior: edit ONE row below. Use Fase Copa if all current Senior jornadas/partidos/stats are copa;
--         use Grupo 4 (sin "Fase Copa") when normalizing legacy for liga regular only.
--
-- Maps: competicion NULL / '' / 'Liga principal' → canonical name.
-- After run, sync step copies jornada.competicion → partidos_liga.

BEGIN;

-- ▼▼▼ EDIT ONLY THIS INSERT (Senior target) ▼▼▼
CREATE TEMP TABLE _senior_comp (target text NOT NULL);
INSERT INTO _senior_comp (target) VALUES
  ('Terceira Galicia - Santiago - Fase Copa - Grupo 4');
-- Liga regular example (swap line above if needed):
-- ('Terceira Galicia - Santiago - Grupo 4');

-- 1) Jornadas
UPDATE jornadas
SET competicion = (SELECT target FROM _senior_comp)
WHERE categoria = 'Senior'
  AND (
    competicion IS NULL
    OR TRIM(COALESCE(competicion, '')) = ''
    OR competicion = 'Liga principal'
  );

UPDATE jornadas
SET competicion = 'División Da Honra - Veteranos - Santiago'
WHERE categoria = 'Veteranos'
  AND (
    competicion IS NULL
    OR TRIM(COALESCE(competicion, '')) = ''
    OR competicion = 'Liga principal'
  );

UPDATE jornadas
SET competicion = 'Segunda División Galega - Grupo 2'
WHERE categoria = 'Femenino'
  AND (
    competicion IS NULL
    OR TRIM(COALESCE(competicion, '')) = ''
    OR competicion = 'Liga principal'
  );

-- 2) equipo_competiciones
UPDATE equipo_competiciones
SET competicion = (SELECT target FROM _senior_comp)
WHERE categoria = 'Senior'
  AND (
    competicion IS NULL
    OR TRIM(COALESCE(competicion, '')) = ''
    OR competicion = 'Liga principal'
  );

UPDATE equipo_competiciones
SET competicion = 'División Da Honra - Veteranos - Santiago'
WHERE categoria = 'Veteranos'
  AND (
    competicion IS NULL
    OR TRIM(COALESCE(competicion, '')) = ''
    OR competicion = 'Liga principal'
  );

UPDATE equipo_competiciones
SET competicion = 'Segunda División Galega - Grupo 2'
WHERE categoria = 'Femenino'
  AND (
    competicion IS NULL
    OR TRIM(COALESCE(competicion, '')) = ''
    OR competicion = 'Liga principal'
  );

-- 3) partidos_liga: inherit from jornada
UPDATE partidos_liga p
SET competicion = j.competicion
FROM jornadas j
WHERE p.jornada_id = j.id
  AND (p.competicion IS DISTINCT FROM j.competicion);

-- 4) partidos_liga: orphans / still legacy
UPDATE partidos_liga
SET competicion = (SELECT target FROM _senior_comp)
WHERE categoria = 'Senior'
  AND (
    competicion IS NULL
    OR TRIM(COALESCE(competicion, '')) = ''
    OR competicion = 'Liga principal'
  );

UPDATE partidos_liga
SET competicion = 'División Da Honra - Veteranos - Santiago'
WHERE categoria = 'Veteranos'
  AND (
    competicion IS NULL
    OR TRIM(COALESCE(competicion, '')) = ''
    OR competicion = 'Liga principal'
  );

UPDATE partidos_liga
SET competicion = 'Segunda División Galega - Grupo 2'
WHERE categoria = 'Femenino'
  AND (
    competicion IS NULL
    OR TRIM(COALESCE(competicion, '')) = ''
    OR competicion = 'Liga principal'
  );

-- 5) Legacy "partidos" if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'partidos'
  ) THEN
    UPDATE partidos p
    SET competicion = s.target
    FROM _senior_comp s
    WHERE p.categoria = 'Senior'
      AND (
        p.competicion IS NULL
        OR TRIM(COALESCE(p.competicion, '')) = ''
        OR p.competicion = 'Liga principal'
      );

    UPDATE partidos
    SET competicion = 'División Da Honra - Veteranos - Santiago'
    WHERE categoria = 'Veteranos'
      AND (
        competicion IS NULL
        OR TRIM(COALESCE(competicion, '')) = ''
        OR competicion = 'Liga principal'
      );

    UPDATE partidos
    SET competicion = 'Segunda División Galega - Grupo 2'
    WHERE categoria = 'Femenino'
      AND (
        competicion IS NULL
        OR TRIM(COALESCE(competicion, '')) = ''
        OR competicion = 'Liga principal'
      );
  END IF;
END $$;

COMMIT;

-- Si ya ejecutaste una versión vieja del script y Senior quedó como "Grupo 4" pero todo es copa:
-- BEGIN;
-- UPDATE jornadas SET competicion = 'Terceira Galicia - Santiago - Fase Copa - Grupo 4'
--   WHERE categoria = 'Senior' AND competicion = 'Terceira Galicia - Santiago - Grupo 4';
-- UPDATE equipo_competiciones SET competicion = 'Terceira Galicia - Santiago - Fase Copa - Grupo 4'
--   WHERE categoria = 'Senior' AND competicion = 'Terceira Galicia - Santiago - Grupo 4';
-- UPDATE partidos_liga p SET competicion = j.competicion FROM jornadas j
--   WHERE p.jornada_id = j.id AND p.categoria = 'Senior';
-- UPDATE partidos_liga SET competicion = 'Terceira Galicia - Santiago - Fase Copa - Grupo 4'
--   WHERE categoria = 'Senior' AND competicion = 'Terceira Galicia - Santiago - Grupo 4' AND jornada_id IS NULL;
-- COMMIT;

-- Post-check:
-- SELECT competicion, COUNT(*) FROM jornadas WHERE categoria = 'Senior' GROUP BY 1;
-- SELECT competicion, COUNT(*) FROM partidos_liga WHERE categoria = 'Senior' GROUP BY 1;
