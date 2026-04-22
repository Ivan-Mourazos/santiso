-- ==============================================================================
-- IMPORTACIÓN DE PLANTILLA SENIOR
-- Basado en los datos proporcionados por el usuario
-- ==============================================================================

DO $$
DECLARE
    cat TEXT := 'Senior';
BEGIN
    -- Asegurar que las nuevas columnas existen
    ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS apodo TEXT;
    ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS posiciones_conocidas TEXT[] DEFAULT '{}';
    ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS capitan INTEGER DEFAULT 0;

    -- Función interna para UPSERT de jugadores
    -- Busca por nombre (ILIKE) y categoría para evitar duplicados
    CREATE OR REPLACE FUNCTION upsert_jugador(
        p_nombre TEXT, p_apodo TEXT, p_dorsal INTEGER, 
        p_posicion TEXT, p_posiciones TEXT[], p_capitan INTEGER, p_cat TEXT
    ) RETURNS VOID AS $$
    DECLARE
        existing_id UUID;
    BEGIN
        SELECT id INTO existing_id FROM jugadores 
        WHERE (nombre ILIKE p_nombre OR apodo ILIKE p_nombre) AND categoria = p_cat LIMIT 1;

        IF existing_id IS NOT NULL THEN
            UPDATE jugadores SET
                nombre = p_nombre,
                apodo = COALESCE(p_apodo, apodo),
                dorsal = p_dorsal,
                posicion = p_posicion,
                posiciones_conocidas = p_posiciones,
                capitan = p_capitan
            WHERE id = existing_id;
        ELSE
            INSERT INTO jugadores (nombre, apodo, dorsal, posicion, posiciones_conocidas, capitan, categoria)
            VALUES (p_nombre, p_apodo, p_dorsal, p_posicion, p_posiciones, p_capitan, p_cat);
        END IF;
    END;
    $$ LANGUAGE plpgsql;

    -- Inserción/Actualización de jugadores
    PERFORM upsert_jugador('Xoel Amboage Rial', NULL, 8, 'MCD', ARRAY['MCD', 'MC', 'MCO', 'DFC'], 0, cat);
    PERFORM upsert_jugador('Ángel Casares Negro', 'Anxo', 3, 'LD', ARRAY['LD', 'MC', 'MD'], 2, cat);
    PERFORM upsert_jugador('Iago Castro Coego', 'Iago SR', 4, 'DFC', ARRAY['DFC'], 1, cat);
    PERFORM upsert_jugador('Breixo Cea García', 'Breixo', 26, 'DFC', ARRAY['DFC'], 0, cat);
    PERFORM upsert_jugador('Diego Conde López', NULL, 15, 'DFC', ARRAY['DFC', 'LI'], 0, cat);
    PERFORM upsert_jugador('Óscar Conde Rúa', NULL, 6, 'MC', ARRAY['MC', 'MCO'], 0, cat);
    PERFORM upsert_jugador('Aitor Cuesta Loureiro', NULL, 12, 'MC', ARRAY['MC', 'MD', 'LD'], 0, cat);
    PERFORM upsert_jugador('Tiago Dias Ribeiro', 'Thiago', 9, 'DC', ARRAY['DC', 'EI', 'ED'], 0, cat);
    PERFORM upsert_jugador('Alexandre Diéguez Costa', NULL, 7, 'MCO', ARRAY['MCO', 'DC', 'MCD', 'DFC'], 0, cat);
    PERFORM upsert_jugador('Alejandro Fernández Liñares', 'Alex', 1, 'POR', ARRAY['POR'], 0, cat);
    PERFORM upsert_jugador('Héctor García Prieto', NULL, 16, 'MC', ARRAY['MC', 'MCD'], 0, cat);
    PERFORM upsert_jugador('David Mejuto Costoya', 'Mejuto', 17, 'MCD', ARRAY['MCD', 'MC'], 0, cat);
    PERFORM upsert_jugador('David Pereiro Costa', NULL, 11, 'ED', ARRAY['ED', 'EI'], 0, cat);
    PERFORM upsert_jugador('Álvaro Ramos Ferreiro', 'Ramos', 2, 'DC', ARRAY['DC', 'LI', 'MI', 'EI'], 0, cat);
    PERFORM upsert_jugador('Adrián Sánchez García', 'Adri SG', 14, 'LI', ARRAY['LI', 'MI'], 0, cat);
    PERFORM upsert_jugador('Iván Sánchez Vázquez', 'Mou', 13, 'POR', ARRAY['POR'], 0, cat);
    PERFORM upsert_jugador('David Valcárcel Pazos', 'Madero', 19, 'MD', ARRAY['MD', 'ED', 'MC'], 0, cat);
    PERFORM upsert_jugador('Daniel Varela Munín', 'Danno', 18, 'LD', ARRAY['LD', 'LI', 'DFC'], 0, cat);
    PERFORM upsert_jugador('Manuel Vázquez Pereiro', 'Manu', 23, 'LD', ARRAY['LD', 'LI'], 0, cat);
    PERFORM upsert_jugador('Daniel Vázquez Rodríguez', 'Benito', 5, 'DFC', ARRAY['DFC', 'MCD'], 4, cat);
    PERFORM upsert_jugador('Adrián Veiga Garea', NULL, 10, 'MCD', ARRAY['MCD', 'MC', 'MCO', 'MD', 'DFC'], 3, cat);
    PERFORM upsert_jugador('Martín Villar Lema', NULL, 21, 'EI', ARRAY['EI', 'MI', 'ED', 'MD'], 0, cat);

    -- Limpiar función temporal
    DROP FUNCTION upsert_jugador(TEXT, TEXT, INTEGER, TEXT, TEXT[], INTEGER, TEXT);

END $$;
