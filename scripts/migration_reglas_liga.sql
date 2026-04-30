-- PASO 1: Eliminar tabla vieja si existe
DROP TABLE IF EXISTS reglas_liga CASCADE;

-- PASO 2: Crear nueva tabla con reglas flexibles (JSONB)
CREATE TABLE reglas_liga (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    temporada_id UUID NOT NULL REFERENCES temporadas(id) ON DELETE CASCADE,
    categoria TEXT NOT NULL,
    competicion TEXT NOT NULL,
    reglas JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (temporada_id, categoria, competicion)
);

CREATE INDEX IF NOT EXISTS idx_reglas_liga_temporada ON reglas_liga(temporada_id, categoria, competicion);

-- PASO 3: Desactivar RLS para la tabla (necesario para el panel admin)
ALTER TABLE reglas_liga ENABLE ROW LEVEL SECURITY;

-- Política que permite todo a usuarios autenticados (admin)
CREATE POLICY "Allow all for authenticated" ON reglas_liga
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Si usas clave anon (sin login), también permite todo
CREATE POLICY "Allow all for anon" ON reglas_liga
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);