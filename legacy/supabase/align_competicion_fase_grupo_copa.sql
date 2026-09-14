-- Alinea etiqueta antigua de BD con el texto EXACTO de la web (COMPETICIONS en cartel/types.ts).
-- Tu consulta mostró Senior con jornadas/competición = 'Fase Grupo Copa';
-- la app solo reconoce: 'Terceira Galicia - Santiago - Fase Copa - Grupo 4' (segunda opción Senior).
--
-- Ejecutar en Supabase SQL Editor. Luego en /partidos elige esa competición en el desplegable.

BEGIN;

UPDATE jornadas
SET competicion = 'Terceira Galicia - Santiago - Fase Copa - Grupo 4'
WHERE categoria = 'Senior'
  AND competicion = 'Fase Grupo Copa';

UPDATE partidos_liga
SET competicion = 'Terceira Galicia - Santiago - Fase Copa - Grupo 4'
WHERE categoria = 'Senior'
  AND competicion = 'Fase Grupo Copa';

UPDATE equipo_competiciones
SET competicion = 'Terceira Galicia - Santiago - Fase Copa - Grupo 4'
WHERE categoria = 'Senior'
  AND competicion = 'Fase Grupo Copa';

COMMIT;

-- Comprobación:
-- SELECT DISTINCT competicion FROM jornadas WHERE categoria = 'Senior';
-- SELECT DISTINCT competicion FROM partidos_liga WHERE categoria = 'Senior';
