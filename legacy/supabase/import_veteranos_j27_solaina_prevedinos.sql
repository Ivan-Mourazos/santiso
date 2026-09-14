-- =============================================================================
-- Veteranos · Jornada 27 · Liga honra
-- Acta: U.D. SANTISO F.C. SOLAINA (local) vs PREVEDIÑOS S.D. · 1-2
-- Campo: Campo Municipal Jesús Carlos Pampín Rua (Melide)
-- Idempotente: borra stats/eventos de ESTE partido y vuelve a insertar.
-- =============================================================================

CREATE TABLE IF NOT EXISTS partido_eventos_santiso (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partido_id UUID NOT NULL REFERENCES partidos_liga(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    minuto INTEGER,
    jugador_id UUID REFERENCES jugadores(id) ON DELETE SET NULL,
    jugador_relacionado_id UUID REFERENCES jugadores(id) ON DELETE SET NULL,
    es_rival BOOLEAN NOT NULL DEFAULT false,
    nombre_mostrado TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partido_eventos_santiso_partido
    ON partido_eventos_santiso(partido_id);

ALTER TABLE partido_eventos_santiso
    ADD COLUMN IF NOT EXISTS es_rival BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE partido_eventos_santiso
    ADD COLUMN IF NOT EXISTS nombre_mostrado TEXT;

CREATE TABLE IF NOT EXISTS campos_futbol (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    poblacion TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE partidos_liga
    ADD COLUMN IF NOT EXISTS campo_id UUID;

DO $$
DECLARE
    v_partido UUID;
    v_temp    UUID;
    v_campo   UUID;
    cat       TEXT := 'Veteranos';
    comp      TEXT := 'División Da Honra - Veteranos - Santiago';
    jnum      INT  := 27;

    -- Resolución por dorsal (plantilla Veteranos debe coincidir con Futgal)
    j13 UUID; j5 UUID; j6 UUID; j7 UUID; j14 UUID; j20 UUID; j23 UUID;
    j25 UUID; j26 UUID; j27 UUID; j28 UUID;
    j4 UUID; j8 UUID; j17 UUID; j30 UUID;
BEGIN
    SELECT t.id INTO v_temp FROM temporadas t WHERE t.activa = true LIMIT 1;
    IF v_temp IS NULL THEN
        SELECT t.id INTO v_temp FROM temporadas t ORDER BY t.created_at DESC LIMIT 1;
    END IF;
    IF v_temp IS NULL THEN
        RAISE EXCEPTION 'No hay temporada en BD';
    END IF;

    SELECT p.id INTO v_partido
    FROM partidos_liga p
    JOIN jornadas j ON j.id = p.jornada_id
    JOIN equipos el ON el.id = p.equipo_local_id
    JOIN equipos ev ON ev.id = p.equipo_visitante_id
    WHERE j.temporada_id = v_temp
      AND j.categoria = cat
      AND j.numero = jnum
      AND (j.competicion = comp OR j.competicion IS NULL)
      AND el.nombre ILIKE '%Santiso%'
      AND ev.nombre ILIKE '%Prevedi%';

    IF v_partido IS NULL THEN
        RAISE EXCEPTION
            'No se encontró partido J% % (local Santiso vs Prevediños). Revisa jornadas.competicion y nombres de equipos.',
            jnum, cat;
    END IF;

    SELECT id INTO v_campo
    FROM campos_futbol
    WHERE nombre ILIKE 'Campo Municipal Jesús Carlos Pampín Rua'
    LIMIT 1;

    IF v_campo IS NULL THEN
        INSERT INTO campos_futbol (nombre, poblacion)
        VALUES ('Campo Municipal Jesús Carlos Pampín Rua', 'Melide')
        RETURNING id INTO v_campo;
    ELSE
        UPDATE campos_futbol
        SET poblacion = 'Melide'
        WHERE id = v_campo;
    END IF;

    UPDATE partidos_liga
    SET goles_local      = 1,
        goles_visitante  = 2,
        estado           = 'finalizado',
        campo_id         = v_campo
    WHERE id = v_partido;

    DELETE FROM jugador_partido_stats WHERE partido_id = v_partido;
    DELETE FROM partido_eventos_santiso WHERE partido_id = v_partido;

    SELECT id INTO j13 FROM jugadores WHERE categoria = cat AND dorsal = 13 LIMIT 1;
    SELECT id INTO j5  FROM jugadores WHERE categoria = cat AND dorsal = 5  LIMIT 1;
    SELECT id INTO j6  FROM jugadores WHERE categoria = cat AND dorsal = 6  LIMIT 1;
    SELECT id INTO j7  FROM jugadores WHERE categoria = cat AND dorsal = 7  LIMIT 1;
    SELECT id INTO j14 FROM jugadores WHERE categoria = cat AND dorsal = 14 LIMIT 1;
    SELECT id INTO j20 FROM jugadores WHERE categoria = cat AND dorsal = 20 LIMIT 1;
    SELECT id INTO j23 FROM jugadores WHERE categoria = cat AND dorsal = 23 LIMIT 1;
    SELECT id INTO j25 FROM jugadores WHERE categoria = cat AND dorsal = 25 LIMIT 1;
    SELECT id INTO j26 FROM jugadores WHERE categoria = cat AND dorsal = 26 LIMIT 1;
    SELECT id INTO j27 FROM jugadores WHERE categoria = cat AND dorsal = 27 LIMIT 1;
    SELECT id INTO j28 FROM jugadores WHERE categoria = cat AND dorsal = 28 LIMIT 1;
    SELECT id INTO j4  FROM jugadores WHERE categoria = cat AND dorsal = 4  LIMIT 1;
    SELECT id INTO j8  FROM jugadores WHERE categoria = cat AND dorsal = 8  LIMIT 1;
    SELECT id INTO j17 FROM jugadores WHERE categoria = cat AND dorsal = 17 LIMIT 1;
    SELECT id INTO j30 FROM jugadores WHERE categoria = cat AND dorsal = 30 LIMIT 1;

    IF j13 IS NULL THEN RAISE WARNING 'Veteranos: no hay jugador dorsal 13'; END IF;
    IF j5  IS NULL THEN RAISE WARNING 'Veteranos: no hay jugador dorsal 5'; END IF;
    IF j6  IS NULL THEN RAISE WARNING 'Veteranos: no hay jugador dorsal 6'; END IF;
    IF j7  IS NULL THEN RAISE WARNING 'Veteranos: no hay jugador dorsal 7'; END IF;
    IF j14 IS NULL THEN RAISE WARNING 'Veteranos: no hay jugador dorsal 14'; END IF;
    IF j20 IS NULL THEN RAISE WARNING 'Veteranos: no hay jugador dorsal 20'; END IF;
    IF j23 IS NULL THEN RAISE WARNING 'Veteranos: no hay jugador dorsal 23'; END IF;
    IF j25 IS NULL THEN RAISE WARNING 'Veteranos: no hay jugador dorsal 25'; END IF;
    IF j26 IS NULL THEN RAISE WARNING 'Veteranos: no hay jugador dorsal 26'; END IF;
    IF j27 IS NULL THEN RAISE WARNING 'Veteranos: no hay jugador dorsal 27 (gol 18′)'; END IF;
    IF j28 IS NULL THEN RAISE WARNING 'Veteranos: no hay jugador dorsal 28'; END IF;
    IF j4  IS NULL THEN RAISE WARNING 'Veteranos: no hay jugador dorsal 4'; END IF;
    IF j8  IS NULL THEN RAISE WARNING 'Veteranos: no hay jugador dorsal 8'; END IF;
    IF j17 IS NULL THEN RAISE WARNING 'Veteranos: no hay jugador dorsal 17'; END IF;
    IF j30 IS NULL THEN RAISE WARNING 'Veteranos: no hay jugador dorsal 30'; END IF;

    INSERT INTO jugador_partido_stats (jugador_id, partido_id, titular, jugo, goles)
    SELECT s.jugador_id, v_partido, s.titular, s.jugo, s.goles
    FROM (
        VALUES
            (j13::uuid, true,  true,  0::int),
            (j5::uuid,  true,  true,  0),
            (j6::uuid,  true,  true,  0),
            (j7::uuid,  true,  true,  0),
            (j14::uuid, true,  true,  0),
            (j20::uuid, true,  true,  0),
            (j23::uuid, true,  true,  0),
            (j25::uuid, true,  true,  0),
            (j26::uuid, true,  true,  0),
            (j27::uuid, true,  true,  1),
            (j28::uuid, true,  true,  0),
            (j4::uuid,  false, false, 0),
            (j8::uuid,  false, false, 0),
            (j17::uuid, false, false, 0),
            (j30::uuid, false, false, 0)
    ) AS s(jugador_id, titular, jugo, goles)
    WHERE s.jugador_id IS NOT NULL;

    INSERT INTO partido_eventos_santiso (
        partido_id, tipo, minuto, jugador_id, jugador_relacionado_id, es_rival, nombre_mostrado
    ) VALUES
        (v_partido, 'gol', 9,  NULL, NULL, true,  'Sergio Leis Ruibal'),
        (
            v_partido,
            'gol',
            18,
            j27,
            NULL,
            false,
            NULL
        ),
        (v_partido, 'gol', 42, NULL, NULL, true,  'Sergio Leis Ruibal'),
        (v_partido, 'tarjeta_amarilla', 45,  j28, NULL, false, NULL),
        (v_partido, 'tarjeta_amarilla', 83,  j27, NULL, false, NULL),
        (v_partido, 'tarjeta_amarilla', 89,  j26, NULL, false, NULL),
        (v_partido, 'tarjeta_amarilla', 999, j14, NULL, false, NULL);

    RAISE NOTICE 'Import OK partido %', v_partido;
END $$;

-- Diagnóstico: filas huérfanas si algún dorsal no existía en jugadores
-- SELECT * FROM jugador_partido_stats jps
-- JOIN partidos_liga p ON p.id = jps.partido_id
-- WHERE jps.jugador_id IS NULL;
