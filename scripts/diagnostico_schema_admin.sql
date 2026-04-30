-- Diagnóstico rápido esquema admin.
-- Uso: ejecutar completo en Supabase SQL Editor.
-- Resultado: estado por columna (OK / MISSING / TYPE_MISMATCH / EXTRA).

WITH expected AS (
  SELECT * FROM (
    VALUES
      -- reglas_liga
      ('public', 'reglas_liga', 'id', 'uuid'),
      ('public', 'reglas_liga', 'temporada_id', 'uuid'),
      ('public', 'reglas_liga', 'categoria', 'text'),
      ('public', 'reglas_liga', 'competicion', 'text'),
      ('public', 'reglas_liga', 'reglas', 'jsonb'),
      ('public', 'reglas_liga', 'created_at', 'timestamp with time zone'),
      ('public', 'reglas_liga', 'updated_at', 'timestamp with time zone'),

      -- jornadas
      ('public', 'jornadas', 'id', 'uuid'),
      ('public', 'jornadas', 'temporada_id', 'uuid'),
      ('public', 'jornadas', 'categoria', 'text'),
      ('public', 'jornadas', 'competicion', 'text'),
      ('public', 'jornadas', 'numero', 'integer'),
      ('public', 'jornadas', 'fecha_inicio', 'timestamp with time zone'),

      -- partidos_liga
      ('public', 'partidos_liga', 'id', 'uuid'),
      ('public', 'partidos_liga', 'jornada_id', 'uuid'),
      ('public', 'partidos_liga', 'categoria', 'text'),
      ('public', 'partidos_liga', 'competicion', 'text'),
      ('public', 'partidos_liga', 'equipo_local_id', 'uuid'),
      ('public', 'partidos_liga', 'equipo_visitante_id', 'uuid'),
      ('public', 'partidos_liga', 'goles_local', 'integer'),
      ('public', 'partidos_liga', 'goles_visitante', 'integer'),
      ('public', 'partidos_liga', 'fecha', 'timestamp with time zone'),
      ('public', 'partidos_liga', 'campo_id', 'uuid'),
      ('public', 'partidos_liga', 'estado', 'text'),

      -- jornada_equipo_descanso
      ('public', 'jornada_equipo_descanso', 'id', 'uuid'),
      ('public', 'jornada_equipo_descanso', 'jornada_id', 'uuid'),
      ('public', 'jornada_equipo_descanso', 'equipo_id', 'uuid')
  ) AS t(table_schema, table_name, column_name, expected_type)
),
actual AS (
  SELECT
    c.table_schema,
    c.table_name,
    c.column_name,
    c.data_type AS actual_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name IN (
      'reglas_liga',
      'jornadas',
      'partidos_liga',
      'jornada_equipo_descanso'
    )
),
expected_vs_actual AS (
  SELECT
    e.table_schema,
    e.table_name,
    e.column_name,
    e.expected_type,
    a.actual_type,
    CASE
      WHEN a.column_name IS NULL THEN 'MISSING'
      WHEN a.actual_type <> e.expected_type THEN 'TYPE_MISMATCH'
      ELSE 'OK'
    END AS status
  FROM expected e
  LEFT JOIN actual a
    ON a.table_schema = e.table_schema
   AND a.table_name = e.table_name
   AND a.column_name = e.column_name
),
extra_columns AS (
  SELECT
    a.table_schema,
    a.table_name,
    a.column_name,
    NULL::text AS expected_type,
    a.actual_type,
    'EXTRA' AS status
  FROM actual a
  LEFT JOIN expected e
    ON e.table_schema = a.table_schema
   AND e.table_name = a.table_name
   AND e.column_name = a.column_name
  WHERE e.column_name IS NULL
)
SELECT
  result.table_name,
  result.column_name,
  result.status,
  result.expected_type,
  result.actual_type
FROM (
  SELECT
    table_name,
    column_name,
    status,
    expected_type,
    actual_type,
    CASE status
      WHEN 'MISSING' THEN 1
      WHEN 'TYPE_MISMATCH' THEN 2
      WHEN 'EXTRA' THEN 3
      ELSE 4
    END AS status_order
  FROM expected_vs_actual

  UNION ALL

  SELECT
    table_name,
    column_name,
    status,
    expected_type,
    actual_type,
    CASE status
      WHEN 'MISSING' THEN 1
      WHEN 'TYPE_MISMATCH' THEN 2
      WHEN 'EXTRA' THEN 3
      ELSE 4
    END AS status_order
  FROM extra_columns
) AS result
ORDER BY
  result.table_name,
  result.status_order,
  result.column_name;
