-- ==============================================================================
-- IMPORTACIÓN COMPLETA SENIOR: JORNADAS 1-10
-- Basado en los datos extraídos de las imágenes
-- ==============================================================================

-- 1. Aseguramos que existan las funciones de utilidad (versión robusta con actualización de fechas)
CREATE OR REPLACE FUNCTION insertar_resultado_auto(
    j_id UUID, cat TEXT, local_name TEXT, visit_name TEXT, 
    g_l INTEGER, g_v INTEGER, fecha_ts TIMESTAMP WITH TIME ZONE DEFAULT NULL, campo TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    id_l UUID;
    id_v UUID;
    v_fecha DATE;
BEGIN
    SELECT id INTO id_l FROM equipos WHERE nombre ILIKE '%' || local_name || '%' AND categoria = cat LIMIT 1;
    SELECT id INTO id_v FROM equipos WHERE nombre ILIKE '%' || visit_name || '%' AND categoria = cat LIMIT 1;
    v_fecha := COALESCE(fecha_ts, now())::DATE;
    
    IF id_l IS NOT NULL AND id_v IS NOT NULL THEN
        -- Verificar si el partido ya existe
        IF NOT EXISTS (SELECT 1 FROM partidos_liga WHERE jornada_id = j_id AND equipo_local_id = id_l AND equipo_visitante_id = id_v) THEN
            INSERT INTO partidos_liga (jornada_id, categoria, equipo_local_id, equipo_visitante_id, goles_local, goles_visitante, fecha, lugar, estado)
            VALUES (j_id, cat, id_l, id_v, g_l, g_v, COALESCE(fecha_ts, now()), campo, 'finalizado');
        ELSE
            UPDATE partidos_liga SET
                goles_local = g_l,
                goles_visitante = g_v,
                fecha = COALESCE(fecha_ts, now()),
                lugar = campo,
                estado = 'finalizado'
            WHERE jornada_id = j_id AND equipo_local_id = id_l AND equipo_visitante_id = id_v;
        END IF;

        -- Actualizar fechas de la jornada
        UPDATE jornadas 
        SET 
            fecha_inicio = CASE WHEN fecha_inicio IS NULL OR v_fecha < fecha_inicio THEN v_fecha ELSE fecha_inicio END,
            fecha_fin = CASE WHEN fecha_fin IS NULL OR v_fecha > fecha_fin THEN v_fecha ELSE fecha_fin END
        WHERE id = j_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION insertar_partido_auto(
    j_id UUID, cat TEXT, local_name TEXT, visit_name TEXT, 
    fecha_ts TIMESTAMP WITH TIME ZONE, campo TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    id_l UUID;
    id_v UUID;
    v_fecha DATE;
BEGIN
    SELECT id INTO id_l FROM equipos WHERE nombre ILIKE '%' || local_name || '%' AND categoria = cat LIMIT 1;
    SELECT id INTO id_v FROM equipos WHERE nombre ILIKE '%' || visit_name || '%' AND categoria = cat LIMIT 1;
    v_fecha := fecha_ts::DATE;
    
    IF id_l IS NOT NULL AND id_v IS NOT NULL THEN
        -- Verificar si el partido ya existe
        IF NOT EXISTS (SELECT 1 FROM partidos_liga WHERE jornada_id = j_id AND equipo_local_id = id_l AND equipo_visitante_id = id_v) THEN
            INSERT INTO partidos_liga (jornada_id, categoria, equipo_local_id, equipo_visitante_id, fecha, lugar, estado)
            VALUES (j_id, cat, id_l, id_v, fecha_ts, campo, 'programado');
        ELSE
            UPDATE partidos_liga SET
                fecha = fecha_ts,
                lugar = campo,
                estado = 'programado'
            WHERE jornada_id = j_id AND equipo_local_id = id_l AND equipo_visitante_id = id_v;
        END IF;

        -- Actualizar fechas de la jornada
        UPDATE jornadas 
        SET 
            fecha_inicio = CASE WHEN fecha_inicio IS NULL OR v_fecha < fecha_inicio THEN v_fecha ELSE fecha_inicio END,
            fecha_fin = CASE WHEN fecha_fin IS NULL OR v_fecha > fecha_fin THEN v_fecha ELSE fecha_fin END
        WHERE id = j_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 2. BLOQUE PRINCIPAL DE DATOS
DO $$ 
DECLARE 
    temp_id UUID;
    cat TEXT := 'Senior';
    j UUID;
BEGIN
    -- Obtener temporada activa
    SELECT id INTO temp_id FROM temporadas WHERE activa = true LIMIT 1;
    IF temp_id IS NULL THEN 
        SELECT id INTO temp_id FROM temporadas ORDER BY created_at DESC LIMIT 1;
    END IF;
    
    IF temp_id IS NULL THEN RAISE EXCEPTION 'No hay temporada activa para Senior'; END IF;

    -- CREAR LAS 10 JORNADAS SI NO EXISTEN
    FOR i IN 1..10 LOOP
        IF NOT EXISTS (SELECT 1 FROM jornadas WHERE temporada_id = temp_id AND categoria = cat AND numero = i) THEN
            INSERT INTO jornadas (temporada_id, categoria, numero)
            VALUES (temp_id, cat, i);
        END IF;
    END LOOP;

    -- ==========================================
    -- JORNADA 1
    -- ==========================================
    SELECT id INTO j FROM jornadas WHERE numero = 1 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Vilatuxe', 'San Lorenzo', 1, 3, '2026-02-06 21:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Club Arenal', 'Bandeira', 2, 9, '2026-02-08 16:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Milladoiro', 'Santiso', 1, 3, '2026-02-08 19:00:00');

    -- ==========================================
    -- JORNADA 2
    -- ==========================================
    SELECT id INTO j FROM jornadas WHERE numero = 2 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Bandeira', 'Vilatuxe', 2, 6, '2026-02-22 16:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'San Lorenzo', 'Milladoiro', 8, 1, '2026-02-22 16:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Santiso', 'Club Arenal', 9, 1, '2026-02-22 18:45:00');

    -- ==========================================
    -- JORNADA 3
    -- ==========================================
    SELECT id INTO j FROM jornadas WHERE numero = 3 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Bandeira', 'Santiso', 4, 7, '2026-03-08 16:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Club Arenal', 'San Lorenzo', 0, 3, '2026-03-08 16:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Vilatuxe', 'Milladoiro', 7, 3, '2026-03-08 17:00:00');

    -- ==========================================
    -- JORNADA 4
    -- ==========================================
    SELECT id INTO j FROM jornadas WHERE numero = 4 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Vilatuxe', 'Santiso', 3, 3, '2026-03-15 17:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'San Lorenzo', 'Bandeira', 0, 2, '2026-03-15 18:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Milladoiro', 'Club Arenal', 2, 1, '2026-03-15 19:15:00');

    -- ==========================================
    -- JORNADA 5
    -- ==========================================
    SELECT id INTO j FROM jornadas WHERE numero = 5 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Santiso', 'San Lorenzo', 3, 1, '2026-03-29 10:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Club Arenal', 'Vilatuxe', 5, 7, '2026-03-29 16:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Bandeira', 'Milladoiro', 5, 2, '2026-03-29 18:00:00');

    -- ==========================================
    -- JORNADA 6
    -- ==========================================
    SELECT id INTO j FROM jornadas WHERE numero = 6 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Bandeira', 'Club Arenal', 9, 3, '2026-04-11 19:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'San Lorenzo', 'Vilatuxe', 2, 3, '2026-04-12 16:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Santiso', 'Milladoiro', 5, 4, '2026-04-12 17:00:00');

    -- ==========================================
    -- JORNADA 7
    -- ==========================================
    SELECT id INTO j FROM jornadas WHERE numero = 7 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Milladoiro', 'San Lorenzo', 0, 4, '2026-04-19 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Vilatuxe', 'Bandeira', 1, 4, '2026-04-19 17:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Club Arenal', 'Santiso', 7, 8, '2026-04-19 18:00:00');

    -- ==========================================
    -- PRÓXIMOS PARTIDOS
    -- ==========================================
    -- J8
    SELECT id INTO j FROM jornadas WHERE numero = 8 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_partido_auto(j, cat, 'San Lorenzo', 'Club Arenal', '2026-04-26 18:30:00');
    PERFORM insertar_partido_auto(j, cat, 'Santiso', 'Bandeira', '2026-04-26 19:00:00');
    PERFORM insertar_partido_auto(j, cat, 'Milladoiro', 'Vilatuxe', '2026-04-26 19:00:00');

    -- J9
    SELECT id INTO j FROM jornadas WHERE numero = 9 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_partido_auto(j, cat, 'Santiso', 'Vilatuxe', '2026-05-03 16:00:00');
    PERFORM insertar_partido_auto(j, cat, 'Bandeira', 'San Lorenzo', '2026-05-03 16:00:00');
    PERFORM insertar_partido_auto(j, cat, 'Club Arenal', 'Milladoiro', '2026-05-03 16:00:00');

    -- J10
    SELECT id INTO j FROM jornadas WHERE numero = 10 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_partido_auto(j, cat, 'San Lorenzo', 'Santiso', '2026-05-10 16:00:00');
    PERFORM insertar_partido_auto(j, cat, 'Milladoiro', 'Bandeira', '2026-05-10 16:00:00');
    PERFORM insertar_partido_auto(j, cat, 'Vilatuxe', 'Club Arenal', '2026-05-10 16:00:00');

END $$;
