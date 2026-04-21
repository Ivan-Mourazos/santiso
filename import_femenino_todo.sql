-- ==============================================================================
-- IMPORTACIÓN COMPLETA FEMENINO: JORNADAS 1-30
-- Instrucciones: Copia y pega TODO este contenido en el SQL Editor de Supabase.
-- ==============================================================================

-- 1. Aseguramos que existan las funciones de utilidad
CREATE OR REPLACE FUNCTION insertar_resultado_auto(
    j_id UUID, cat TEXT, local_name TEXT, visit_name TEXT, 
    g_l INTEGER, g_v INTEGER, fecha_ts TIMESTAMP WITH TIME ZONE, campo TEXT
) RETURNS VOID AS $$
DECLARE
    id_l UUID;
    id_v UUID;
BEGIN
    SELECT id INTO id_l FROM equipos WHERE nombre ILIKE '%' || local_name || '%' AND categoria = cat LIMIT 1;
    SELECT id INTO id_v FROM equipos WHERE nombre ILIKE '%' || visit_name || '%' AND categoria = cat LIMIT 1;
    
    IF id_l IS NOT NULL AND id_v IS NOT NULL THEN
        -- Usamos UPSERT para evitar duplicados si se lanza varias veces
        INSERT INTO partidos_liga (jornada_id, categoria, equipo_local_id, equipo_visitante_id, goles_local, goles_visitante, fecha, lugar, estado)
        VALUES (j_id, cat, id_l, id_v, g_l, g_v, fecha_ts, campo, 'finalizado');
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION insertar_partido_auto(
    j_id UUID, cat TEXT, local_name TEXT, visit_name TEXT, 
    fecha_ts TIMESTAMP WITH TIME ZONE, campo TEXT
) RETURNS VOID AS $$
DECLARE
    id_l UUID;
    id_v UUID;
BEGIN
    SELECT id INTO id_l FROM equipos WHERE nombre ILIKE '%' || local_name || '%' AND categoria = cat LIMIT 1;
    SELECT id INTO id_v FROM equipos WHERE nombre ILIKE '%' || visit_name || '%' AND categoria = cat LIMIT 1;
    
    IF id_l IS NOT NULL AND id_v IS NOT NULL THEN
        INSERT INTO partidos_liga (jornada_id, categoria, equipo_local_id, equipo_visitante_id, fecha, lugar, estado)
        VALUES (j_id, cat, id_l, id_v, fecha_ts, campo, 'programado');
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
    IF temp_id IS NULL THEN RAISE EXCEPTION 'No hay temporada activa'; END IF;

    -- CREAR LAS 30 JORNADAS
    FOR i IN 1..30 LOOP
        INSERT INTO jornadas (temporada_id, categoria, numero)
        VALUES (temp_id, cat, i) ON CONFLICT DO NOTHING;
    END LOOP;

    -- J1
    SELECT id INTO j FROM jornadas WHERE numero = 1 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Mos', 'Cañiza', 2, 2, '2025-09-21', 'Mos');
    PERFORM insertar_resultado_auto(j, cat, 'Celtiga', 'Arousana', 1, 4, '2025-09-21', 'A Salvador');
    PERFORM insertar_resultado_auto(j, cat, 'Porriño', 'Touro', 1, 2, '2025-09-21', 'Lourambel');
    PERFORM insertar_resultado_auto(j, cat, 'San Mateo', 'Cambados', 2, 0, '2025-09-21', 'San Mateo');
    PERFORM insertar_resultado_auto(j, cat, 'Salcedo', 'Ponte Caldelas', 3, 7, '2025-09-21', 'Salcedo');
    PERFORM insertar_resultado_auto(j, cat, 'Santiso', 'Union Guardesa', 4, 2, '2025-09-21', 'Santiso');
    PERFORM insertar_resultado_auto(j, cat, 'Noia', 'Victoria', 3, 0, '2025-09-21', 'Julio Mato');

    -- J2
    SELECT id INTO j FROM jornadas WHERE numero = 2 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Valladares', 'Noia', 5, 0, '2025-09-28', 'A Gandara');
    PERFORM insertar_resultado_auto(j, cat, 'Union Guardesa', 'Mos', 1, 6, '2025-09-28', 'A Sangriña');
    PERFORM insertar_resultado_auto(j, cat, 'Ponte Caldelas', 'San Mateo', 1, 0, '2025-09-28', 'Chan da Barcia');
    PERFORM insertar_resultado_auto(j, cat, 'Cambados', 'Santiso', 1, 2, '2025-09-28', 'O Pombal');
    PERFORM insertar_resultado_auto(j, cat, 'Touro', 'Salcedo', 5, 1, '2025-09-28', 'O Lameiro');
    PERFORM insertar_resultado_auto(j, cat, 'Arousana', 'Porriño', 8, 0, '2025-09-28', 'A Lomba');
    PERFORM insertar_resultado_auto(j, cat, 'Victoria', 'Celtiga', 0, 4, '2025-09-28', 'A Grela');

    -- J3
    SELECT id INTO j FROM jornadas WHERE numero = 3 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Celtiga', 'Valladares', 2, 7, '2025-10-05', 'A Salvador');
    PERFORM insertar_resultado_auto(j, cat, 'Mos', 'Cambados', 4, 1, '2025-10-05', 'Mos');
    PERFORM insertar_resultado_auto(j, cat, 'Salcedo', 'Arousana', 0, 8, '2025-10-05', 'Salcedo');
    PERFORM insertar_resultado_auto(j, cat, 'Porriño', 'Victoria', 0, 1, '2025-10-05', 'Lourambel');
    PERFORM insertar_resultado_auto(j, cat, 'Santiso', 'Ponte Caldelas', 0, 0, '2025-10-05', 'Santiso');
    PERFORM insertar_resultado_auto(j, cat, 'San Mateo', 'Touro', 0, 3, '2025-10-05', 'San Mateo');
    PERFORM insertar_resultado_auto(j, cat, 'Cañiza', 'Union Guardesa', 2, 1, '2025-10-05', 'A Cañiza');

    -- J4
    SELECT id INTO j FROM jornadas WHERE numero = 4 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Valladares', 'Porriño', 4, 1, '2025-10-12', 'A Gandara');
    PERFORM insertar_resultado_auto(j, cat, 'Ponte Caldelas', 'Mos', 1, 0, '2025-10-12', 'Chan da Barcia');
    PERFORM insertar_resultado_auto(j, cat, 'Noia', 'Celtiga', 3, 1, '2025-10-12', 'Julio Mato');
    PERFORM insertar_resultado_auto(j, cat, 'Touro', 'Santiso', 4, 0, '2025-10-12', 'O Lameiro');
    PERFORM insertar_resultado_auto(j, cat, 'Cambados', 'Cañiza', 5, 1, '2025-10-12', 'O Pombal');
    PERFORM insertar_resultado_auto(j, cat, 'Arousana', 'San Mateo', 8, 1, '2025-10-12', 'A Lomba');
    PERFORM insertar_resultado_auto(j, cat, 'Victoria', 'Salcedo', 6, 1, '2025-10-12', 'A Grela');

    -- J5
    SELECT id INTO j FROM jornadas WHERE numero = 5 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Union Guardesa', 'Cambados', 2, 3, '2025-10-19', 'A Sangriña');
    PERFORM insertar_resultado_auto(j, cat, 'Porriño', 'Noia', 0, 4, '2025-10-19', 'Lourambel');
    PERFORM insertar_resultado_auto(j, cat, 'Mos', 'Touro', 3, 4, '2025-10-19', 'Mos');
    PERFORM insertar_resultado_auto(j, cat, 'Salcedo', 'Valladares', 0, 10, '2025-10-19', 'Salcedo');
    PERFORM insertar_resultado_auto(j, cat, 'Cañiza', 'Ponte Caldelas', 0, 3, '2025-10-19', 'A Cañiza');
    PERFORM insertar_resultado_auto(j, cat, 'Santiso', 'Arousana', 1, 4, '2025-10-19', 'Santiso');
    PERFORM insertar_resultado_auto(j, cat, 'San Mateo', 'Victoria', 1, 2, '2025-10-19', 'San Mateo');

    -- J6
    SELECT id INTO j FROM jornadas WHERE numero = 6 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Celtiga', 'Porriño', 3, 0, '2025-10-26', 'A Salvador');
    PERFORM insertar_resultado_auto(j, cat, 'Ponte Caldelas', 'Union Guardesa', 11, 2, '2025-10-26', 'Chan da Barcia');
    PERFORM insertar_resultado_auto(j, cat, 'Valladares', 'San Mateo', 5, 0, '2025-10-26', 'A Gandara');
    PERFORM insertar_resultado_auto(j, cat, 'Touro', 'Cañiza', 1, 3, '2025-10-26', 'O Lameiro');
    PERFORM insertar_resultado_auto(j, cat, 'Arousana', 'Mos', 2, 1, '2025-10-26', 'A Lomba');
    PERFORM insertar_resultado_auto(j, cat, 'Victoria', 'Santiso', 0, 1, '2025-10-26', 'A Grela');
    PERFORM insertar_resultado_auto(j, cat, 'Noia', 'Salcedo', 3, 3, '2025-10-26', 'Julio Mato');

    -- J7
    SELECT id INTO j FROM jornadas WHERE numero = 7 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Union Guardesa', 'Touro', 0, 5, '2025-11-02', 'A Sangriña');
    PERFORM insertar_resultado_auto(j, cat, 'Santiso', 'Valladares', 0, 5, '2025-11-02', 'Santiso');
    PERFORM insertar_resultado_auto(j, cat, 'Cañiza', 'Arousana', 1, 3, '2025-11-02', 'A Cañiza');
    PERFORM insertar_resultado_auto(j, cat, 'Mos', 'Victoria', 4, 0, '2025-11-02', 'Mos');
    PERFORM insertar_resultado_auto(j, cat, 'Salcedo', 'Celtiga', 0, 7, '2025-11-02', 'Salcedo');
    PERFORM insertar_resultado_auto(j, cat, 'Cambados', 'Ponte Caldelas', 1, 3, '2025-11-02', 'O Pombal');
    PERFORM insertar_resultado_auto(j, cat, 'San Mateo', 'Noia', 3, 0, '2025-11-02', 'San Mateo');

    -- J8
    SELECT id INTO j FROM jornadas WHERE numero = 8 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Celtiga', 'San Mateo', 2, 1, '2025-11-09', 'A Salvador');
    PERFORM insertar_resultado_auto(j, cat, 'Valladares', 'Mos', 3, 1, '2025-11-09', 'A Gandara');
    PERFORM insertar_resultado_auto(j, cat, 'Porriño', 'Salcedo', 3, 1, '2025-11-09', 'Lourambel');
    PERFORM insertar_resultado_auto(j, cat, 'Victoria', 'Cañiza', 1, 0, '2025-11-09', 'A Grela');
    PERFORM insertar_resultado_auto(j, cat, 'Arousana', 'Union Guardesa', 11, 2, '2025-11-09', 'A Lomba');
    PERFORM insertar_resultado_auto(j, cat, 'Touro', 'Cambados', 2, 1, '2025-11-09', 'O Lameiro');
    PERFORM insertar_resultado_auto(j, cat, 'Noia', 'Santiso', 5, 6, '2025-11-09', 'Julio Mato');

    -- J9
    SELECT id INTO j FROM jornadas WHERE numero = 9 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Ponte Caldelas', 'Touro', 0, 3, '2025-11-16', 'Chan da Barcia');
    PERFORM insertar_resultado_auto(j, cat, 'Union Guardesa', 'Victoria', 1, 2, '2025-11-16', 'A Sangriña');
    PERFORM insertar_resultado_auto(j, cat, 'Mos', 'Noia', 1, 0, '2025-11-16', 'Mos');
    PERFORM insertar_resultado_auto(j, cat, 'Cañiza', 'Valladares', 0, 2, '2025-11-16', 'A Cañiza');
    PERFORM insertar_resultado_auto(j, cat, 'Cambados', 'Arousana', 1, 1, '2025-11-16', 'O Pombal');
    PERFORM insertar_resultado_auto(j, cat, 'Santiso', 'Celtiga', 5, 6, '2025-11-16', 'Santiso');
    PERFORM insertar_resultado_auto(j, cat, 'San Mateo', 'Porriño', 3, 1, '2025-11-16', 'San Mateo');

    -- J10
    SELECT id INTO j FROM jornadas WHERE numero = 10 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Celtiga', 'Mos', 2, 2, '2025-11-23', 'A Salvador');
    PERFORM insertar_resultado_auto(j, cat, 'Salcedo', 'San Mateo', 4, 2, '2025-11-23', 'Salcedo');
    PERFORM insertar_resultado_auto(j, cat, 'Valladares', 'Union Guardesa', 5, 1, '2025-11-23', 'A Gandara');
    PERFORM insertar_resultado_auto(j, cat, 'Porriño', 'Santiso', 4, 5, '2025-11-23', 'Lourambel');
    PERFORM insertar_resultado_auto(j, cat, 'Arousana', 'Ponte Caldelas', 5, 0, '2025-11-23', 'A Lomba');
    PERFORM insertar_resultado_auto(j, cat, 'Victoria', 'Cambados', 1, 1, '2025-11-23', 'A Grela');
    PERFORM insertar_resultado_auto(j, cat, 'Noia', 'Cañiza', 1, 1, '2025-11-23', 'Julio Mato');

    -- J11
    SELECT id INTO j FROM jornadas WHERE numero = 11 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Ponte Caldelas', 'Victoria', 5, 1, '2025-12-07', 'Chan da Barcia');
    PERFORM insertar_resultado_auto(j, cat, 'Touro', 'Arousana', 3, 1, '2025-12-07', 'O Lameiro');
    PERFORM insertar_resultado_auto(j, cat, 'Union Guardesa', 'Noia', 5, 2, '2025-12-07', 'A Sangriña');
    PERFORM insertar_resultado_auto(j, cat, 'Cañiza', 'Celtiga', 0, 0, '2025-12-07', 'A Cañiza');
    PERFORM insertar_resultado_auto(j, cat, 'Cambados', 'Valladares', 0, 6, '2025-12-07', 'O Pombal');
    PERFORM insertar_resultado_auto(j, cat, 'Santiso', 'Salcedo', 4, 2, '2025-12-07', 'Santiso');
    PERFORM insertar_resultado_auto(j, cat, 'Mos', 'Porriño', 2, 0, '2025-12-07', 'Mos');

    -- J12
    SELECT id INTO j FROM jornadas WHERE numero = 12 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Celtiga', 'Union Guardesa', 3, 2, '2025-12-21', 'A Salvador');
    PERFORM insertar_resultado_auto(j, cat, 'Porriño', 'Cañiza', 2, 4, '2025-12-21', 'Lourambel');
    PERFORM insertar_resultado_auto(j, cat, 'Valladares', 'Ponte Caldelas', 7, 1, '2025-12-21', 'A Gandara');
    PERFORM insertar_resultado_auto(j, cat, 'Salcedo', 'Mos', 1, 4, '2025-12-21', 'Salcedo');
    PERFORM insertar_resultado_auto(j, cat, 'San Mateo', 'Santiso', 5, 3, '2025-12-21', 'San Mateo');
    PERFORM insertar_resultado_auto(j, cat, 'Noia', 'Cambados', 2, 2, '2025-12-21', 'Julio Mato');
    PERFORM insertar_resultado_auto(j, cat, 'Victoria', 'Touro', 3, 5, '2025-12-21', 'A Grela');

    -- J13
    SELECT id INTO j FROM jornadas WHERE numero = 13 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Ponte Caldelas', 'Noia', 6, 0, '2026-01-11', 'Chan da Barcia');
    PERFORM insertar_resultado_auto(j, cat, 'Cambados', 'Celtiga', 0, 1, '2026-01-11', 'O Pombal');
    PERFORM insertar_resultado_auto(j, cat, 'Union Guardesa', 'Porriño', 5, 3, '2026-01-11', 'A Sangriña');
    PERFORM insertar_resultado_auto(j, cat, 'Mos', 'San Mateo', 3, 1, '2026-01-11', 'Mos');
    PERFORM insertar_resultado_auto(j, cat, 'Touro', 'Valladares', 0, 3, '2026-01-11', 'O Lameiro');
    PERFORM insertar_resultado_auto(j, cat, 'Cañiza', 'Salcedo', 2, 1, '2026-01-11', 'A Cañiza');
    PERFORM insertar_resultado_auto(j, cat, 'Arousana', 'Victoria', 7, 1, '2026-01-11', 'A Lomba');

    -- J14
    SELECT id INTO j FROM jornadas WHERE numero = 14 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Valladares', 'Arousana', 3, 0, '2026-01-18', 'A Gandara');
    PERFORM insertar_resultado_auto(j, cat, 'Porriño', 'Cambados', 0, 0, '2026-01-18', 'Lourambel');
    PERFORM insertar_resultado_auto(j, cat, 'Santiso', 'Mos', 0, 2, '2026-01-18', 'Santiso');
    PERFORM insertar_resultado_auto(j, cat, 'Celtiga', 'Ponte Caldelas', 2, 3, '2026-01-18', 'A Salvador');
    PERFORM insertar_resultado_auto(j, cat, 'San Mateo', 'Cañiza', 1, 1, '2026-01-18', 'San Mateo');
    PERFORM insertar_resultado_auto(j, cat, 'Salcedo', 'Union Guardesa', 4, 2, '2026-01-18', 'Salcedo');
    PERFORM insertar_resultado_auto(j, cat, 'Noia', 'Touro', 1, 2, '2026-01-18', 'Julio Mato');

    -- J15
    SELECT id INTO j FROM jornadas WHERE numero = 15 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Ponte Caldelas', 'Porriño', 2, 1, '2026-01-25', 'Chan da Barcia');
    PERFORM insertar_resultado_auto(j, cat, 'Union Guardesa', 'San Mateo', 2, 1, '2026-01-25', 'A Sangriña');
    PERFORM insertar_resultado_auto(j, cat, 'Arousana', 'Noia', 4, 1, '2026-01-25', 'A Lomba');
    PERFORM insertar_resultado_auto(j, cat, 'Cambados', 'Salcedo', 7, 0, '2026-01-25', 'O Pombal');
    PERFORM insertar_resultado_auto(j, cat, 'Victoria', 'Valladares', 2, 3, '2026-01-25', 'A Grela');
    PERFORM insertar_resultado_auto(j, cat, 'Cañiza', 'Santiso', 3, 2, '2026-01-25', 'A Cañiza');
    PERFORM insertar_resultado_auto(j, cat, 'Touro', 'Celtiga', 1, 1, '2026-01-25', 'O Lameiro');

    -- J16
    SELECT id INTO j FROM jornadas WHERE numero = 16 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Cambados', 'San Mateo', 5, 1, '2026-02-01', 'O Pombal');
    PERFORM insertar_resultado_auto(j, cat, 'Ponte Caldelas', 'Salcedo', 7, 3, '2026-02-01', 'Chan da Barcia');
    PERFORM insertar_resultado_auto(j, cat, 'Union Guardesa', 'Santiso', 5, 1, '2026-02-01', 'A Sangriña');
    PERFORM insertar_resultado_auto(j, cat, 'Touro', 'Porriño', 3, 3, '2026-02-01', 'O Lameiro');
    PERFORM insertar_resultado_auto(j, cat, 'Arousana', 'Celtiga', 4, 0, '2026-02-01', 'A Lomba');
    PERFORM insertar_resultado_auto(j, cat, 'Cañiza', 'Mos', 2, 2, '2026-02-01', 'A Cañiza');
    PERFORM insertar_resultado_auto(j, cat, 'Victoria', 'Noia', 2, 2, '2026-02-01', 'A Grela');

    -- J17
    SELECT id INTO j FROM jornadas WHERE numero = 17 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Mos', 'Union Guardesa', 9, 2, '2026-02-08', 'Mos');
    PERFORM insertar_resultado_auto(j, cat, 'Noia', 'Valladares', 0, 2, '2026-02-08', 'Julio Mato');
    PERFORM insertar_resultado_auto(j, cat, 'Porriño', 'Arousana', 1, 6, '2026-02-08', 'Lourambel');
    PERFORM insertar_resultado_auto(j, cat, 'Salcedo', 'Touro', 0, 5, '2026-02-08', 'Salcedo');
    PERFORM insertar_resultado_auto(j, cat, 'Celtiga', 'Victoria', 4, 1, '2026-02-08', 'A Salvador');
    PERFORM insertar_resultado_auto(j, cat, 'Santiso', 'Cambados', 0, 1, '2026-02-08', 'Santiso');
    PERFORM insertar_resultado_auto(j, cat, 'San Mateo', 'Ponte Caldelas', 2, 5, '2026-02-08', 'San Mateo');

    -- J18
    SELECT id INTO j FROM jornadas WHERE numero = 18 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Union Guardesa', 'Cañiza', 2, 0, '2026-02-15', 'A Sangriña');
    PERFORM insertar_resultado_auto(j, cat, 'Cambados', 'Mos', 2, 0, '2026-02-15', 'O Pombal');
    PERFORM insertar_resultado_auto(j, cat, 'Valladares', 'Celtiga', 5, 0, '2026-02-15', 'A Gandara');
    PERFORM insertar_resultado_auto(j, cat, 'Ponte Caldelas', 'Santiso', 7, 0, '2026-02-15', 'Chan da Barcia');
    PERFORM insertar_resultado_auto(j, cat, 'Touro', 'San Mateo', 4, 1, '2026-02-15', 'O Lameiro');
    PERFORM insertar_resultado_auto(j, cat, 'Arousana', 'Salcedo', 8, 1, '2026-02-15', 'A Lomba');
    PERFORM insertar_resultado_auto(j, cat, 'Victoria', 'Porriño', 4, 1, '2026-02-15', 'A Grela');

    -- J19
    SELECT id INTO j FROM jornadas WHERE numero = 19 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Celtiga', 'Noia', 0, 2, '2026-02-22', 'A Salvador');
    PERFORM insertar_resultado_auto(j, cat, 'Cañiza', 'Cambados', 1, 2, '2026-02-22', 'A Cañiza');
    PERFORM insertar_resultado_auto(j, cat, 'Porriño', 'Valladares', 0, 8, '2026-02-22', 'Lourambel');
    PERFORM insertar_resultado_auto(j, cat, 'Mos', 'Ponte Caldelas', 1, 2, '2026-02-22', 'Mos');
    PERFORM insertar_resultado_auto(j, cat, 'Santiso', 'Touro', 0, 5, '2026-02-22', 'Santiso');
    PERFORM insertar_resultado_auto(j, cat, 'Salcedo', 'Victoria', 2, 6, '2026-02-22', 'Salcedo');
    PERFORM insertar_resultado_auto(j, cat, 'San Mateo', 'Arousana', 0, 3, '2026-02-22', 'San Mateo');

    -- J20
    SELECT id INTO j FROM jornadas WHERE numero = 20 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Valladares', 'Salcedo', 10, 0, '2026-03-01', 'A Gandara');
    PERFORM insertar_resultado_auto(j, cat, 'Ponte Caldelas', 'Cañiza', 1, 1, '2026-03-01', 'Chan da Barcia');
    PERFORM insertar_resultado_auto(j, cat, 'Noia', 'Porriño', 4, 0, '2026-03-01', 'Julio Mato');
    PERFORM insertar_resultado_auto(j, cat, 'Cambados', 'Union Guardesa', 1, 1, '2026-03-01', 'O Pombal');
    PERFORM insertar_resultado_auto(j, cat, 'Touro', 'Mos', 4, 1, '2026-03-01', 'O Lameiro');
    PERFORM insertar_resultado_auto(j, cat, 'Arousana', 'Santiso', 3, 0, '2026-03-01', 'A Lomba');
    PERFORM insertar_resultado_auto(j, cat, 'Victoria', 'San Mateo', 0, 0, '2026-03-01', 'A Grela');

    -- J21
    SELECT id INTO j FROM jornadas WHERE numero = 21 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Mos', 'Arousana', 2, 2, '2026-03-08', 'Mos');
    PERFORM insertar_resultado_auto(j, cat, 'Porriño', 'Celtiga', 2, 6, '2026-03-08', 'Lourambel');
    PERFORM insertar_resultado_auto(j, cat, 'Santiso', 'Victoria', 1, 2, '2026-03-08', 'Santiso');
    PERFORM insertar_resultado_auto(j, cat, 'Union Guardesa', 'Ponte Caldelas', 4, 2, '2026-03-08', 'A Sangriña');
    PERFORM insertar_resultado_auto(j, cat, 'San Mateo', 'Valladares', 0, 8, '2026-03-08', 'San Mateo');
    PERFORM insertar_resultado_auto(j, cat, 'Cañiza', 'Touro', 0, 0, '2026-03-08', 'A Cañiza');
    PERFORM insertar_resultado_auto(j, cat, 'Salcedo', 'Noia', 1, 6, '2026-03-08', 'Salcedo');

    -- J22
    SELECT id INTO j FROM jornadas WHERE numero = 22 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Valladares', 'Santiso', 6, 0, '2026-03-22', 'A Gandara');
    PERFORM insertar_resultado_auto(j, cat, 'Ponte Caldelas', 'Cambados', 3, 0, '2026-03-22', 'Chan da Barcia');
    PERFORM insertar_resultado_auto(j, cat, 'Noia', 'San Mateo', 0, 0, '2026-03-22', 'Julio Mato');
    PERFORM insertar_resultado_auto(j, cat, 'Celtiga', 'Salcedo', 5, 0, '2026-03-22', 'A Salvador');
    PERFORM insertar_resultado_auto(j, cat, 'Touro', 'Union Guardesa', 7, 1, '2026-03-22', 'O Lameiro');
    PERFORM insertar_resultado_auto(j, cat, 'Arousana', 'Cañiza', 2, 0, '2026-03-22', 'A Lomba');
    PERFORM insertar_resultado_auto(j, cat, 'Victoria', 'Mos', 1, 2, '2026-03-22', 'A Grela');

    -- J23
    SELECT id INTO j FROM jornadas WHERE numero = 23 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Salcedo', 'Porriño', 0, 3, '2026-03-29', 'Salcedo');
    PERFORM insertar_resultado_auto(j, cat, 'Union Guardesa', 'Arousana', 0, 9, '2026-03-29', 'A Sangriña');
    PERFORM insertar_resultado_auto(j, cat, 'Santiso', 'Noia', 0, 1, '2026-03-29', 'Santiso');
    PERFORM insertar_resultado_auto(j, cat, 'San Mateo', 'Celtiga', 2, 1, '2026-03-29', 'San Mateo');
    PERFORM insertar_resultado_auto(j, cat, 'Cañiza', 'Victoria', 4, 1, '2026-03-29', 'A Cañiza');
    PERFORM insertar_resultado_auto(j, cat, 'Cambados', 'Touro', 1, 3, '2026-03-29', 'O Pombal');
    PERFORM insertar_resultado_auto(j, cat, 'Mos', 'Valladares', 0, 7, '2026-03-29', 'Mos');

    -- J24
    SELECT id INTO j FROM jornadas WHERE numero = 24 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Celtiga', 'Santiso', 4, 0, '2026-04-12', 'A Salvador');
    PERFORM insertar_resultado_auto(j, cat, 'Porriño', 'San Mateo', 2, 4, '2026-04-12', 'Lourambel');
    PERFORM insertar_resultado_auto(j, cat, 'Valladares', 'Cañiza', 2, 0, '2026-04-12', 'A Gandara');
    PERFORM insertar_resultado_auto(j, cat, 'Victoria', 'Union Guardesa', 1, 2, '2026-04-12', 'A Grela');
    PERFORM insertar_resultado_auto(j, cat, 'Touro', 'Ponte Caldelas', 2, 1, '2026-04-12', 'O Lameiro');
    PERFORM insertar_resultado_auto(j, cat, 'Arousana', 'Cambados', 2, 0, '2026-04-12', 'A Lomba');
    PERFORM insertar_resultado_auto(j, cat, 'Noia', 'Mos', 3, 4, '2026-04-12', 'Julio Mato');

    -- J25
    SELECT id INTO j FROM jornadas WHERE numero = 25 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_resultado_auto(j, cat, 'Ponte Caldelas', 'Arousana', 2, 3, '2026-04-19', 'Chan da Barcia');
    PERFORM insertar_resultado_auto(j, cat, 'Union Guardesa', 'Valladares', 2, 3, '2026-04-19', 'A Sangriña');
    PERFORM insertar_resultado_auto(j, cat, 'Mos', 'Celtiga', 4, 5, '2026-04-19', 'Mos');
    PERFORM insertar_resultado_auto(j, cat, 'Santiso', 'Porriño', 2, 0, '2026-04-19', 'Santiso');
    PERFORM insertar_resultado_auto(j, cat, 'San Mateo', 'Salcedo', 3, 0, '2026-04-19', 'San Mateo');
    PERFORM insertar_resultado_auto(j, cat, 'Cambados', 'Victoria', 3, 1, '2026-04-19', 'O Pombal');
    PERFORM insertar_resultado_auto(j, cat, 'Cañiza', 'Noia', 1, 0, '2026-04-19', 'A Cañiza');

    -- PROXIMOS ENCUENTROS (ESTADO PROGRAMADO)
    -- J26
    SELECT id INTO j FROM jornadas WHERE numero = 26 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_partido_auto(j, cat, 'Valladares', 'Cambados', '2026-04-26 12:00:00+02', 'A Gandara');
    PERFORM insertar_partido_auto(j, cat, 'Celtiga', 'Cañiza', '2026-04-26 12:00:00+02', 'A Salvador');
    PERFORM insertar_partido_auto(j, cat, 'Porriño', 'Mos', '2026-04-26 12:00:00+02', 'Lourambel');
    PERFORM insertar_partido_auto(j, cat, 'Victoria', 'Ponte Caldelas', '2026-04-26 12:00:00+02', 'A Grela');
    PERFORM insertar_partido_auto(j, cat, 'Arousana', 'Touro', '2026-04-26 12:00:00+02', 'A Lomba');
    PERFORM insertar_partido_auto(j, cat, 'Noia', 'Union Guardesa', '2026-04-26 12:00:00+02', 'Julio Mato');
    PERFORM insertar_partido_auto(j, cat, 'Salcedo', 'Santiso', '2026-04-26 12:00:00+02', 'Salcedo');

    -- J27
    SELECT id INTO j FROM jornadas WHERE numero = 27 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_partido_auto(j, cat, 'Touro', 'Victoria', '2026-05-03 12:00:00+02', 'O Lameiro');
    PERFORM insertar_partido_auto(j, cat, 'Ponte Caldelas', 'Valladares', '2026-05-03 12:00:00+02', 'Chan da Barcia');
    PERFORM insertar_partido_auto(j, cat, 'Cambados', 'Noia', '2026-05-03 12:00:00+02', 'O Pombal');
    PERFORM insertar_partido_auto(j, cat, 'Union Guardesa', 'Celtiga', '2026-05-03 12:00:00+02', 'A Sangriña');
    PERFORM insertar_partido_auto(j, cat, 'Cañiza', 'Porriño', '2026-05-03 12:00:00+02', 'A Cañiza');
    PERFORM insertar_partido_auto(j, cat, 'Mos', 'Salcedo', '2026-05-03 12:00:00+02', 'Mos');
    PERFORM insertar_partido_auto(j, cat, 'Santiso', 'San Mateo', '2026-05-03 12:00:00+02', 'Santiso');

    -- J28
    SELECT id INTO j FROM jornadas WHERE numero = 28 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_partido_auto(j, cat, 'Victoria', 'Arousana', '2026-05-17 12:00:00+02', 'A Grela');
    PERFORM insertar_partido_auto(j, cat, 'Valladares', 'Touro', '2026-05-17 12:00:00+02', 'A Gandara');
    PERFORM insertar_partido_auto(j, cat, 'Noia', 'Ponte Caldelas', '2026-05-17 12:00:00+02', 'Julio Mato');
    PERFORM insertar_partido_auto(j, cat, 'Celtiga', 'Cambados', '2026-05-17 12:00:00+02', 'A Salvador');
    PERFORM insertar_partido_auto(j, cat, 'Porriño', 'Union Guardesa', '2026-05-17 12:00:00+02', 'Lourambel');
    PERFORM insertar_partido_auto(j, cat, 'San Mateo', 'Mos', '2026-05-17 12:00:00+02', 'San Mateo');

    -- J29
    SELECT id INTO j FROM jornadas WHERE numero = 29 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_partido_auto(j, cat, 'Arousana', 'Valladares', '2026-05-24 12:00:00+02', 'A Lomba');
    PERFORM insertar_partido_auto(j, cat, 'Touro', 'Noia', '2026-05-24 12:00:00+02', 'O Lameiro');
    PERFORM insertar_partido_auto(j, cat, 'Ponte Caldelas', 'Celtiga', '2026-05-24 12:00:00+02', 'Chan da Barcia');
    PERFORM insertar_partido_auto(j, cat, 'Cambados', 'Porriño', '2026-05-24 12:00:00+02', 'O Pombal');
    PERFORM insertar_partido_auto(j, cat, 'Union Guardesa', 'Salcedo', '2026-05-24 12:00:00+02', 'A Sangriña');
    PERFORM insertar_partido_auto(j, cat, 'Cañiza', 'San Mateo', '2026-05-24 12:00:00+02', 'A Cañiza');
    PERFORM insertar_partido_auto(j, cat, 'Mos', 'Santiso', '2026-05-24 12:00:00+02', 'Mos');

    -- J30
    SELECT id INTO j FROM jornadas WHERE numero = 30 AND categoria = cat AND temporada_id = temp_id;
    PERFORM insertar_partido_auto(j, cat, 'Valladares', 'Victoria', '2026-05-31 12:00:00+02', 'A Gandara');
    PERFORM insertar_partido_auto(j, cat, 'Noia', 'Arousana', '2026-05-31 12:00:00+02', 'Julio Mato');
    PERFORM insertar_partido_auto(j, cat, 'Celtiga', 'Touro', '2026-05-31 12:00:00+02', 'A Salvador');
    PERFORM insertar_partido_auto(j, cat, 'Porriño', 'Ponte Caldelas', '2026-05-31 12:00:00+02', 'Lourambel');
    PERFORM insertar_partido_auto(j, cat, 'San Mateo', 'Union Guardesa', '2026-05-31 12:00:00+02', 'San Mateo');
    PERFORM insertar_partido_auto(j, cat, 'Salcedo', 'Cambados', '2026-05-31 12:00:00+02', 'Salcedo');
    PERFORM insertar_partido_auto(j, cat, 'Santiso', 'Cañiza', '2026-05-31 12:00:00+02', 'Santiso');

END $$;
