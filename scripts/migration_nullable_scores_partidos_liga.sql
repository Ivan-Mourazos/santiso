-- Permite que partidos nuevos nazcan sin marcador cargado (NULL).
-- No modifica resultados históricos ya guardados.
ALTER TABLE partidos_liga
  ALTER COLUMN goles_local DROP DEFAULT,
  ALTER COLUMN goles_visitante DROP DEFAULT;
