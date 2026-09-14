-- Guardado transaccional de actas + reglas de integridad recomendadas.
-- Ejecutar tras limpiar duplicados con scripts/audit_integridad_bd.sql.

CREATE OR REPLACE FUNCTION save_reviewed_acta(
  p_partido_id uuid,
  p_goles_local integer,
  p_goles_visitante integer,
  p_campo_id uuid DEFAULT NULL,
  p_stats jsonb DEFAULT '[]'::jsonb,
  p_events jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE partidos_liga
  SET
    goles_local = p_goles_local,
    goles_visitante = p_goles_visitante,
    estado = 'finalizado',
    campo_id = COALESCE(p_campo_id, campo_id)
  WHERE id = p_partido_id;

  DELETE FROM jugador_partido_stats
  WHERE partido_id = p_partido_id;

  DELETE FROM partido_eventos_santiso
  WHERE partido_id = p_partido_id;

  INSERT INTO jugador_partido_stats (partido_id, jugador_id, titular, jugo, goles)
  SELECT
    p_partido_id,
    (row->>'jugador_id')::uuid,
    COALESCE((row->>'titular')::boolean, false),
    COALESCE((row->>'jugo')::boolean, false),
    COALESCE((row->>'goles')::integer, 0)
  FROM jsonb_array_elements(p_stats) AS row
  WHERE row ? 'jugador_id';

  INSERT INTO partido_eventos_santiso (
    partido_id,
    tipo,
    minuto,
    jugador_id,
    jugador_relacionado_id,
    es_rival,
    nombre_mostrado
  )
  SELECT
    p_partido_id,
    row->>'tipo',
    NULLIF(row->>'minuto', '')::integer,
    NULLIF(row->>'jugador_id', '')::uuid,
    NULLIF(row->>'jugador_relacionado_id', '')::uuid,
    COALESCE((row->>'es_rival')::boolean, false),
    NULLIF(row->>'nombre_mostrado', '')
  FROM jsonb_array_elements(p_events) AS row;
END;
$$;

-- Evita jornadas duplicadas por temporada/categoría/competición/número.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'jornadas_temporada_categoria_comp_num_unique'
  ) THEN
    ALTER TABLE jornadas
      ADD CONSTRAINT jornadas_temporada_categoria_comp_num_unique
      UNIQUE NULLS NOT DISTINCT (temporada_id, categoria, competicion, numero);
  END IF;
END $$;

-- Evita el mismo cruce repetido dentro de una jornada.
CREATE UNIQUE INDEX IF NOT EXISTS idx_partidos_liga_unique_matchday_pair
  ON partidos_liga (jornada_id, equipo_local_id, equipo_visitante_id);

-- Consultas habituales de calendario/clasificación/carteles.
CREATE INDEX IF NOT EXISTS idx_partidos_liga_finalizados_comp
  ON partidos_liga (categoria, competicion, fecha)
  WHERE estado = 'finalizado';

CREATE INDEX IF NOT EXISTS idx_partido_eventos_santiso_partido_minuto
  ON partido_eventos_santiso (partido_id, minuto);

CREATE INDEX IF NOT EXISTS idx_jugadores_categoria_dorsal
  ON jugadores (categoria, dorsal);
