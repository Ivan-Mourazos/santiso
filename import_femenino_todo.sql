-- ==============================================================================
-- IMPORTACIÓN COMPLETA FEMENINO: JORNADAS 1-10
-- Basado en los datos extraídos de las imágenes
-- ==============================================================================

-- 1. Aseguramos que existan las funciones de utilidad (versión robusta con comprobación IF NOT EXISTS)
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
    cat TEXT := 'Femenino';
    j UUID;
BEGIN
    -- Obtener temporada activa
    SELECT id INTO temp_id FROM temporadas WHERE activa = true LIMIT 1;
    IF temp_id IS NULL THEN 
        SELECT id INTO temp_id FROM temporadas ORDER BY created_at DESC LIMIT 1;
    END IF;
    
    IF temp_id IS NULL THEN RAISE EXCEPTION 'No hay temporada activa para Femenino'; END IF;

    -- CREAR LAS 30 JORNADAS SI NO EXISTEN
    FOR i IN 1..30 LOOP
        IF NOT EXISTS (SELECT 1 FROM jornadas WHERE temporada_id = temp_id AND categoria = cat AND numero = i) THEN
            INSERT INTO jornadas (temporada_id, categoria, numero)
            VALUES (temp_id, cat, i);
        END IF;
    END LOOP;

    -- ==========================================
    -- JORNADA 1 (21-09-2025)
    -- ==========================================
    SELECT id INTO j FROM jornadas WHERE numero = 1 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Mos', 'Cañiza', 2, 2, '2025-09-21 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Celtiga', 'Atletico Arousana', 1, 4, '2025-09-21 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Porriño', 'Touro', 1, 2, '2025-09-21 12:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'San Mateo', 'Juventud Cambados', 2, 0, '2025-09-21 16:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Salcedo', 'Ponte Caldelas', 3, 7, '2025-09-21 16:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Santiso', 'Union Guardesa', 4, 2, '2025-09-21 17:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Noia', 'Victoria', 3, 0, '2025-09-21 19:00:00');

    -- ==========================================
    -- JORNADA 2 (28-09-2025)
    -- ==========================================
    SELECT id INTO j FROM jornadas WHERE numero = 2 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Valladares', 'Noia', 5, 0, '2025-09-28 11:15:00');
    PERFORM insertar_resultado_auto(j, cat, 'Union Guardesa', 'Mos', 1, 6, '2025-09-28 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Ponte Caldelas', 'San Mateo', 1, 0, '2025-09-28 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Juventud Cambados', 'Santiso', 1, 2, '2025-09-28 17:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Touro', 'Salcedo', 5, 1, '2025-09-28 17:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Atletico Arousana', 'Porriño', 8, 0, '2025-09-28 17:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Victoria', 'Celtiga', 0, 4, '2025-09-28 18:00:00');

    -- ==========================================
    -- JORNADA 3 (05-10-2025)
    -- ==========================================
    SELECT id INTO j FROM jornadas WHERE numero = 3 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Celtiga', 'Valladares', 2, 7, '2025-10-05 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Mos', 'Juventud Cambados', 4, 1, '2025-10-05 16:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Salcedo', 'Atletico Arousana', 0, 8, '2025-10-05 16:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Porriño', 'Victoria', 0, 1, '2025-10-05 16:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Santiso', 'Ponte Caldelas', 0, 0, '2025-10-05 17:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'San Mateo', 'Touro', 0, 3, '2025-10-05 17:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Cañiza', 'Union Guardesa', 2, 1, '2025-10-05 17:30:00');

    -- ==========================================
    -- JORNADA 4 (12-10-2025)
    -- ==========================================
    SELECT id INTO j FROM jornadas WHERE numero = 4 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Valladares', 'Porriño', 4, 1, '2025-10-12 11:05:00');
    PERFORM insertar_resultado_auto(j, cat, 'Ponte Caldelas', 'Mos', 1, 0, '2025-10-12 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Noia', 'Celtiga', 3, 1, '2025-10-12 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Touro', 'Santiso', 4, 0, '2025-10-12 17:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Juventud Cambados', 'Cañiza', 5, 1, '2025-10-12 17:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Atletico Arousana', 'San Mateo', 8, 1, '2025-10-12 17:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Victoria', 'Salcedo', 6, 1, '2025-10-12 18:00:00');

    -- ==========================================
    -- JORNADA 5 (19-10-2025)
    -- ==========================================
    SELECT id INTO j FROM jornadas WHERE numero = 5 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Union Guardesa', 'Juventud Cambados', 2, 3, '2025-10-19 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Porriño', 'Noia', 0, 4, '2025-10-19 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Mos', 'Touro', 3, 4, '2025-10-19 16:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Salcedo', 'Valladares', 0, 10, '2025-10-19 16:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Cañiza', 'Ponte Caldelas', 0, 3, '2025-10-19 16:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Santiso', 'Atletico Arousana', 1, 4, '2025-10-19 17:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'San Mateo', 'Victoria', 1, 2, '2025-10-19 17:00:00');

    -- ==========================================
    -- JORNADA 6 (26-10-2025)
    -- ==========================================
    SELECT id INTO j FROM jornadas WHERE numero = 6 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Celtiga', 'Porriño', 3, 0, '2025-10-26 10:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Ponte Caldelas', 'Union Guardesa', 11, 2, '2025-10-26 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Valladares', 'San Mateo', 5, 0, '2025-10-26 13:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Touro', 'Cañiza', 1, 3, '2025-10-26 16:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Atletico Arousana', 'Mos', 2, 1, '2025-10-26 17:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Victoria', 'Santiso', 0, 1, '2025-10-26 18:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Noia', 'Salcedo', 3, 3, '2025-10-26 19:00:00');

    -- ==========================================
    -- JORNADA 7 (02-11-2025)
    -- ==========================================
    SELECT id INTO j FROM jornadas WHERE numero = 7 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Union Guardesa', 'Touro', 0, 5, '2025-11-02 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Santiso', 'Valladares', 0, 5, '2025-11-02 16:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Cañiza', 'Atletico Arousana', 1, 3, '2025-11-02 16:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Mos', 'Victoria', 4, 0, '2025-11-02 16:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Salcedo', 'Celtiga', 0, 7, '2025-11-02 16:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Juventud Cambados', 'Ponte Caldelas', 1, 3, '2025-11-02 17:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'San Mateo', 'Noia', 3, 0, '2025-11-02 17:30:00');

    -- ==========================================
    -- JORNADA 8 (09-11-2025)
    -- ==========================================
    SELECT id INTO j FROM jornadas WHERE numero = 8 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Celtiga', 'San Mateo', 2, 1, '2025-11-09 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Valladares', 'Mos', 3, 1, '2025-11-09 12:15:00');
    PERFORM insertar_resultado_auto(j, cat, 'Porriño', 'Salcedo', 3, 1, '2025-11-09 12:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Victoria', 'Cañiza', 1, 0, '2025-11-09 16:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Atletico Arousana', 'Union Guardesa', 11, 2, '2025-11-09 17:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Touro', 'Juventud Cambados', 2, 1, '2025-11-09 18:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Noia', 'Santiso', 5, 6, '2025-11-09 19:00:00');

    -- ==========================================
    -- JORNADA 9 (16-11-2025)
    -- ==========================================
    SELECT id INTO j FROM jornadas WHERE numero = 9 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Ponte Caldelas', 'Touro', 0, 3, '2025-11-16 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Union Guardesa', 'Victoria', 1, 2, '2025-11-16 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Mos', 'Noia', 1, 0, '2025-11-16 12:50:00');
    PERFORM insertar_resultado_auto(j, cat, 'Cañiza', 'Valladares', 0, 2, '2025-11-16 13:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Juventud Cambados', 'Atletico Arousana', 1, 1, '2025-11-16 17:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Santiso', 'Celtiga', 5, 6, '2025-11-16 17:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'San Mateo', 'Porriño', 3, 1, '2025-11-16 19:15:00');

    -- ==========================================
    -- JORNADA 10 (23-11-2025)
    -- ==========================================
    SELECT id INTO j FROM jornadas WHERE numero = 10 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Celtiga', 'Mos', 2, 2, '2025-11-23 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Salcedo', 'San Mateo', 4, 2, '2025-11-23 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Valladares', 'Union Guardesa', 5, 1, '2025-11-23 12:15:00');
    PERFORM insertar_resultado_auto(j, cat, 'Porriño', 'Santiso', 4, 5, '2025-11-23 12:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Atletico Arousana', 'Ponte Caldelas', 5, 0, '2025-11-23 17:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Victoria', 'Juventud Cambados', 1, 1, '2025-11-23 18:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Noia', 'Cañiza', 1, 1, '2025-11-23 19:00:00');

    -- ==========================================
    -- JORNADA 11 (07-12-2025)
    -- ==========================================
    SELECT id INTO j FROM jornadas WHERE numero = 11 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Ponte Caldelas', 'Victoria', 5, 1, '2025-11-30 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Touro', 'Atletico Arousana', 3, 1, '2025-12-07 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Union Guardesa', 'Noia', 5, 2, '2025-12-07 16:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Cañiza', 'Celtiga', 0, 0, '2025-12-07 16:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Juventud Cambados', 'Valladares', 0, 6, '2025-12-07 17:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Santiso', 'Salcedo', 4, 2, '2025-12-07 18:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Mos', 'Porriño', 2, 0, '2025-12-07 19:30:00');

    -- ==========================================
    -- JORNADA 12 (21-12-2025)
    -- ==========================================
    SELECT id INTO j FROM jornadas WHERE numero = 12 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Celtiga', 'Union Guardesa', 3, 2, '2025-12-21 11:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Porriño', 'Cañiza', 2, 4, '2025-12-21 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Valladares', 'Ponte Caldelas', 7, 1, '2025-12-21 13:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Salcedo', 'Mos', 1, 4, '2025-12-21 16:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'San Mateo', 'Santiso', 5, 3, '2025-12-21 17:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Noia', 'Juventud Cambados', 2, 2, '2025-12-21 18:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Victoria', 'Touro', 3, 5, '2025-12-21 20:00:00');

    -- ==========================================
    -- JORNADA 13 (11-01-2026)
    -- ==========================================
    SELECT id INTO j FROM jornadas WHERE numero = 13 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Ponte Caldelas', 'Noia', 6, 0, '2026-01-11 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Juventud Cambados', 'Celtiga', 0, 1, '2026-01-11 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Union Guardesa', 'Porriño', 5, 3, '2026-01-11 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Mos', 'San Mateo', 3, 1, '2026-01-11 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Touro', 'Valladares', 0, 3, '2026-01-11 16:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Cañiza', 'Salcedo', 2, 1, '2026-01-11 17:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Atletico Arousana', 'Victoria', 7, 1, '2026-01-11 17:03:00');

    -- ==========================================
    -- JORNADA 14 (18-01-2026)
    -- ==========================================
    SELECT id INTO j FROM jornadas WHERE numero = 14 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Valladares', 'Atletico Arousana', 3, 0, '2026-01-18 11:05:00');
    PERFORM insertar_resultado_auto(j, cat, 'Porriño', 'Juventud Cambados', 0, 0, '2026-01-18 12:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Santiso', 'Mos', 0, 2, '2026-01-18 16:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Celtiga', 'Ponte Caldelas', 2, 3, '2026-01-18 16:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'San Mateo', 'Cañiza', 1, 1, '2026-01-18 17:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Salcedo', 'Union Guardesa', 4, 2, '2026-01-18 18:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Noia', 'Touro', 1, 2, '2026-01-18 19:00:00');

    -- ==========================================
    -- JORNADA 15 (25-01-2026)
    -- ==========================================
    SELECT id INTO j FROM jornadas WHERE numero = 15 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Ponte Caldelas', 'Porriño', 2, 1, '2026-01-25 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Union Guardesa', 'San Mateo', 2, 1, '2026-01-25 12:09:00');
    PERFORM insertar_resultado_auto(j, cat, 'Atletico Arousana', 'Noia', 4, 1, '2026-01-25 17:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Juventud Cambados', 'Salcedo', 7, 0, '2026-01-25 17:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Victoria', 'Valladares', 2, 3, '2026-01-25 18:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Cañiza', 'Santiso', 3, 2, '2026-01-25 18:15:00');
    PERFORM insertar_resultado_auto(j, cat, 'Touro', 'Celtiga', 1, 1, '2026-03-15 17:00:00');

    -- ==========================================
    -- JORNADA 16 (01-02-2026)
    -- ==========================================
    SELECT id INTO j FROM jornadas WHERE numero = 16 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Juventud Cambados', 'San Mateo', 5, 1, '2026-02-01 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Ponte Caldelas', 'Salcedo', 7, 3, '2026-02-01 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Union Guardesa', 'Santiso', 5, 1, '2026-02-01 13:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Touro', 'Porriño', 3, 3, '2026-02-01 16:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Atletico Arousana', 'Celtiga', 4, 0, '2026-02-01 17:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Cañiza', 'Mos', 2, 2, '2026-02-01 17:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Victoria', 'Noia', 2, 2, '2026-02-01 20:00:00');

    -- ==========================================
    -- JORNADA 17 (08-02-2026)
    -- ==========================================
    SELECT id INTO j FROM jornadas WHERE numero = 17 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Mos', 'Union Guardesa', 9, 2, '2026-02-08 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Noia', 'Valladares', 0, 2, '2026-02-08 12:15:00');
    PERFORM insertar_resultado_auto(j, cat, 'Porriño', 'Atletico Arousana', 1, 6, '2026-02-08 12:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Salcedo', 'Touro', 0, 5, '2026-02-08 16:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Celtiga', 'Victoria', 4, 1, '2026-02-08 16:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Santiso', 'Juventud Cambados', 0, 1, '2026-02-08 17:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'San Mateo', 'Ponte Caldelas', 2, 5, '2026-02-08 17:30:00');

    -- ==========================================
    -- JORNADA 18 (15-02-2026)
    -- ==========================================
    SELECT id INTO j FROM jornadas WHERE numero = 18 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Union Guardesa', 'Cañiza', 2, 0, '2026-02-14 18:15:00');
    PERFORM insertar_resultado_auto(j, cat, 'Juventud Cambados', 'Mos', 2, 0, '2026-02-15 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Valladares', 'Celtiga', 5, 0, '2026-02-15 12:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Ponte Caldelas', 'Santiso', 7, 0, '2026-02-15 16:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Touro', 'San Mateo', 4, 1, '2026-02-15 17:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Atletico Arousana', 'Salcedo', 8, 1, '2026-02-15 17:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Victoria', 'Porriño', 4, 1, '2026-02-15 18:00:00');

    -- ==========================================
    -- JORNADA 19 (22-02-2026)
    -- ==========================================
    SELECT id INTO j FROM jornadas WHERE numero = 19 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Celtiga', 'Noia', 0, 2, '2026-02-22 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Cañiza', 'Juventud Cambados', 1, 2, '2026-02-22 12:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Porriño', 'Valladares', 0, 8, '2025-02-22 12:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Mos', 'Ponte Caldelas', 1, 2, '2026-02-22 12:45:00');
    PERFORM insertar_resultado_auto(j, cat, 'Santiso', 'Touro', 0, 5, '2026-02-22 16:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Salcedo', 'Victoria', 2, 6, '2026-02-22 16:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'San Mateo', 'Atletico Arousana', 0, 3, '2026-02-22 17:30:00');

    -- ==========================================
    -- JORNADA 20 (01-03-2026)
    -- ==========================================
    SELECT id INTO j FROM jornadas WHERE numero = 20 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Valladares', 'Salcedo', 10, 0, '2026-03-01 11:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Ponte Caldelas', 'Cañiza', 1, 1, '2026-03-01 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Noia', 'Porriño', 4, 0, '2026-03-01 12:15:00');
    PERFORM insertar_resultado_auto(j, cat, 'Juventud Cambados', 'Union Guardesa', 1, 1, '2026-03-01 17:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Touro', 'Mos', 4, 1, '2026-03-01 17:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Atletico Arousana', 'Santiso', 3, 0, '2026-03-01 17:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Victoria', 'San Mateo', 0, 0, '2026-03-01 19:00:00');

    -- ==========================================
    -- JORNADA 21 (08-03-2026)
    -- ==========================================
    SELECT id INTO j FROM jornadas WHERE numero = 21 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Mos', 'Atletico Arousana', 2, 2, '2026-03-08 11:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Porriño', 'Celtiga', 2, 6, '2026-03-08 12:15:00');
    PERFORM insertar_resultado_auto(j, cat, 'Santiso', 'Victoria', 1, 2, '2026-03-08 15:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Union Guardesa', 'Ponte Caldelas', 4, 2, '2026-03-08 15:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'San Mateo', 'Valladares', 0, 8, '2026-03-08 17:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Cañiza', 'Touro', 0, 0, '2026-03-08 18:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Salcedo', 'Noia', 1, 6, '2026-03-08 18:30:00');

    -- ==========================================
    -- JORNADA 22 (22-03-2026)
    -- ==========================================
    SELECT id INTO j FROM jornadas WHERE numero = 22 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Valladares', 'Santiso', 6, 0, '2026-03-18 21:15:00');
    PERFORM insertar_resultado_auto(j, cat, 'Ponte Caldelas', 'Juventud Cambados', 3, 0, '2026-03-22 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Noia', 'San Mateo', 0, 0, '2026-03-22 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Celtiga', 'Salcedo', 5, 0, '2026-03-22 12:15:00');
    PERFORM insertar_resultado_auto(j, cat, 'Touro', 'Union Guardesa', 7, 1, '2026-03-22 17:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Atletico Arousana', 'Cañiza', 2, 0, '2026-03-22 17:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Victoria', 'Mos', 1, 2, '2026-03-22 18:00:00');

    -- ==========================================
    -- JORNADA 23 (29-03-2026)
    -- ==========================================
    SELECT id INTO j FROM jornadas WHERE numero = 23 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Salcedo', 'Porriño', 0, 3, '2026-03-28 18:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Union Guardesa', 'Atletico Arousana', 0, 9, '2026-03-29 11:15:00');
    PERFORM insertar_resultado_auto(j, cat, 'Santiso', 'Noia', 0, 1, '2026-03-29 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'San Mateo', 'Celtiga', 2, 1, '2026-03-29 17:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Cañiza', 'Victoria', 4, 1, '2026-03-29 18:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Juventud Cambados', 'Touro', 1, 3, '2026-03-29 19:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Mos', 'Valladares', 0, 7, '2026-03-29 20:00:00');

    -- ==========================================
    -- JORNADA 24 (12-04-2026)
    -- ==========================================
    SELECT id INTO j FROM jornadas WHERE numero = 24 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Celtiga', 'Santiso', 4, 0, '2026-04-12 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Porriño', 'San Mateo', 2, 4, '2026-04-12 12:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Valladares', 'Cañiza', 2, 0, '2026-04-12 13:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Victoria', 'Union Guardesa', 1, 2, '2026-04-12 16:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Touro', 'Ponte Caldelas', 2, 1, '2026-04-12 16:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Atletico Arousana', 'Juventud Cambados', 2, 0, '2026-04-12 17:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Noia', 'Mos', 3, 4, '2026-04-12 20:00:00');

    -- ==========================================
    -- JORNADA 25 (19-04-2026)
    -- ==========================================
    SELECT id INTO j FROM jornadas WHERE numero = 25 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Ponte Caldelas', 'Atletico Arousana', 2, 3, '2026-04-19 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Union Guardesa', 'Valladares', 2, 3, '2026-04-19 12:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Mos', 'Celtiga', 4, 5, '2026-04-19 12:30:00');
    PERFORM insertar_resultado_auto(j, cat, 'Santiso', 'Porriño', 2, 0, '2026-04-19 17:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'San Mateo', 'Salcedo', 3, 0, '2026-04-19 17:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Juventud Cambados', 'Victoria', 3, 1, '2026-04-19 19:00:00');
    PERFORM insertar_resultado_auto(j, cat, 'Cañiza', 'Noia', 1, 0, '2026-04-19 19:45:00');

    -- ==========================================
    -- JORNADAS PROGRAMADAS (26-30)
    -- ==========================================
    
    -- J26
    SELECT id INTO j FROM jornadas WHERE numero = 26 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_partido_auto(j, cat, 'Valladares', 'Juventud Cambados', '2026-04-26 11:00:00');
    PERFORM insertar_partido_auto(j, cat, 'Celtiga', 'Cañiza', '2026-04-26 12:00:00');
    PERFORM insertar_partido_auto(j, cat, 'Porriño', 'Mos', '2026-04-26 12:45:00');
    PERFORM insertar_partido_auto(j, cat, 'Victoria', 'Ponte Caldelas', '2026-04-26 18:30:00');
    PERFORM insertar_partido_auto(j, cat, 'Atletico Arousana', 'Touro', '2026-04-26 19:00:00');
    PERFORM insertar_partido_auto(j, cat, 'Noia', 'Union Guardesa', '2026-04-26 20:00:00');
    PERFORM insertar_partido_auto(j, cat, 'Salcedo', 'Santiso', '2026-04-26 20:00:00');

    -- J27
    SELECT id INTO j FROM jornadas WHERE numero = 27 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_partido_auto(j, cat, 'Touro', 'Victoria', '2026-05-03 12:00:00');
    PERFORM insertar_partido_auto(j, cat, 'Ponte Caldelas', 'Valladares', '2026-05-03 12:00:00');
    PERFORM insertar_partido_auto(j, cat, 'Juventud Cambados', 'Noia', '2026-05-03 12:00:00');
    PERFORM insertar_partido_auto(j, cat, 'Union Guardesa', 'Celtiga', '2026-05-03 12:00:00');
    PERFORM insertar_partido_auto(j, cat, 'Cañiza', 'Porriño', '2026-05-03 12:00:00');
    PERFORM insertar_partido_auto(j, cat, 'Mos', 'Salcedo', '2026-05-03 12:00:00');
    PERFORM insertar_partido_auto(j, cat, 'Santiso', 'San Mateo', '2026-05-03 17:00:00');

    -- J28
    SELECT id INTO j FROM jornadas WHERE numero = 28 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_partido_auto(j, cat, 'Victoria', 'Atletico Arousana', '2026-05-17 12:00:00');
    PERFORM insertar_partido_auto(j, cat, 'Valladares', 'Touro', '2026-05-17 12:00:00');
    PERFORM insertar_partido_auto(j, cat, 'Noia', 'Ponte Caldelas', '2026-05-17 12:00:00');
    PERFORM insertar_partido_auto(j, cat, 'Celtiga', 'Juventud Cambados', '2026-05-17 12:00:00');
    PERFORM insertar_partido_auto(j, cat, 'Porriño', 'Union Guardesa', '2026-05-17 12:00:00');
    PERFORM insertar_partido_auto(j, cat, 'San Mateo', 'Mos', '2026-05-17 12:00:00');
    PERFORM insertar_partido_auto(j, cat, 'Salcedo', 'Cañiza', '2026-05-17 16:00:00');

    -- J29
    SELECT id INTO j FROM jornadas WHERE numero = 29 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_partido_auto(j, cat, 'Atletico Arousana', 'Valladares', '2026-05-24 12:00:00');
    PERFORM insertar_partido_auto(j, cat, 'Touro', 'Noia', '2026-05-24 12:00:00');
    PERFORM insertar_partido_auto(j, cat, 'Ponte Caldelas', 'Celtiga', '2026-05-24 12:00:00');
    PERFORM insertar_partido_auto(j, cat, 'Juventud Cambados', 'Porriño', '2026-05-24 12:00:00');
    PERFORM insertar_partido_auto(j, cat, 'Union Guardesa', 'Salcedo', '2026-05-24 12:00:00');
    PERFORM insertar_partido_auto(j, cat, 'Cañiza', 'San Mateo', '2026-05-24 12:00:00');
    PERFORM insertar_partido_auto(j, cat, 'Mos', 'Santiso', '2026-05-24 12:00:00');

    -- J30
    SELECT id INTO j FROM jornadas WHERE numero = 30 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_partido_auto(j, cat, 'Valladares', 'Victoria', '2026-05-31 12:00:00');
    PERFORM insertar_partido_auto(j, cat, 'Noia', 'Atletico Arousana', '2026-05-31 12:00:00');
    PERFORM insertar_partido_auto(j, cat, 'Celtiga', 'Touro', '2026-05-31 12:00:00');
    PERFORM insertar_partido_auto(j, cat, 'Porriño', 'Ponte Caldelas', '2026-05-31 12:00:00');
    PERFORM insertar_partido_auto(j, cat, 'Sporting Club San Mateo', 'Union Guardesa', '2026-05-31 12:00:00');
    PERFORM insertar_partido_auto(j, cat, 'Salcedo', 'Juventud Cambados', '2026-05-31 16:00:00');
    PERFORM insertar_partido_auto(j, cat, 'Santiso', 'Cañiza', '2026-05-31 17:00:00');

END $$;


END $$;
