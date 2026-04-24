-- Veteranos: etiqueta en BD != texto exacto usado por la web.
-- Corrige 'División de Honor' -> 'División Da Honra - Veteranos - Santiago'.
-- Ejecutar en Supabase SQL Editor.

BEGIN;

UPDATE jornadas
SET competicion = 'División Da Honra - Veteranos - Santiago'
WHERE categoria = 'Veteranos'
  AND competicion = 'División de Honor';

UPDATE partidos_liga
SET competicion = 'División Da Honra - Veteranos - Santiago'
WHERE categoria = 'Veteranos'
  AND competicion = 'División de Honor';

UPDATE equipo_competiciones
SET competicion = 'División Da Honra - Veteranos - Santiago'
WHERE categoria = 'Veteranos'
  AND competicion = 'División de Honor';

COMMIT;

-- Comprobación:
-- SELECT DISTINCT competicion FROM jornadas WHERE categoria = 'Veteranos';
-- SELECT DISTINCT competicion FROM partidos_liga WHERE categoria = 'Veteranos';
-- SELECT DISTINCT competicion FROM equipo_competiciones WHERE categoria = 'Veteranos';
