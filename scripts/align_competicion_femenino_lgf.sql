-- Femenino: etiqueta en BD ≠ texto de la web (COMPETICIONS → "Segunda División Galega - Grupo 2").
-- Si tu consulta muestra jornadas con competicion = 'LGF 2ª División', ejecuta esto.
--
-- Ejecutar en Supabase SQL Editor.

BEGIN;

UPDATE jornadas
SET competicion = 'Segunda División Galega - Grupo 2'
WHERE categoria = 'Femenino'
  AND competicion = 'LGF 2ª División';

UPDATE partidos_liga
SET competicion = 'Segunda División Galega - Grupo 2'
WHERE categoria = 'Femenino'
  AND competicion = 'LGF 2ª División';

UPDATE equipo_competiciones
SET competicion = 'Segunda División Galega - Grupo 2'
WHERE categoria = 'Femenino'
  AND competicion = 'LGF 2ª División';

COMMIT;

-- SELECT DISTINCT competicion FROM jornadas WHERE categoria = 'Femenino';
