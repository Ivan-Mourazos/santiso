-- Ejecutar en Supabase → SQL Editor (solo lectura, seguro).
-- Aclara si hay filas Senior y dónde están.

-- 1) ¿Existen partidos Senior? (tabla REAL del proyecto)
SELECT
  COUNT(*) AS total_senior,
  COUNT(*) FILTER (WHERE competicion IS NULL OR TRIM(COALESCE(competicion, '')) = '') AS sin_competicion
FROM partidos_liga
WHERE categoria = 'Senior';

-- 2) Desglose por competicion
SELECT competicion, COUNT(*) AS n
FROM partidos_liga
WHERE categoria = 'Senior'
GROUP BY competicion
ORDER BY n DESC;

-- 3) Jornadas Senior (sin partidos no verás calendario en la web)
SELECT competicion, COUNT(*) AS jornadas
FROM jornadas
WHERE categoria = 'Senior'
GROUP BY competicion
ORDER BY jornadas DESC;

-- 4) Partidos Senior cuya jornada ya no existe (no debería pasar salvo FK rota)
SELECT p.id, p.jornada_id, p.categoria, p.competicion
FROM partidos_liga p
LEFT JOIN jornadas j ON j.id = p.jornada_id
WHERE p.categoria = 'Senior'
  AND j.id IS NULL;

-- 5) Tabla legacy `partidos`: muchos proyectos solo tienen `partidos_liga` (tu caso → no existe `partidos`).
--    Si en algún momento existiera, ejecuta aparte:
--    SELECT COUNT(*) FROM partidos WHERE categoria = 'Senior';

-- 6) Temporadas y si borrar una temporada borró en cascada jornadas+partidos
SELECT id, nombre, activa, created_at
FROM temporadas
ORDER BY created_at DESC;
