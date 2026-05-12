-- Migración para soporte de Copas y Cuadrantes dinámicos

-- 1. Añadir formato a la tabla de competiciones
ALTER TABLE competiciones ADD COLUMN IF NOT EXISTS formato TEXT DEFAULT 'liga';

-- 2. Añadir nombre_fase a las jornadas para nombrar eliminatorias ("Octavos", "Semifinal", etc.)
ALTER TABLE jornadas ADD COLUMN IF NOT EXISTS nombre_fase TEXT;

-- 3. Actualizar registros existentes para asegurar consistencia
UPDATE competiciones SET formato = 'liga' WHERE formato IS NULL;
