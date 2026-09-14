-- Fix RLS para permitir INSERT/UPDATE en campos_futbol desde el importador de jornadas.
-- Ejecutar en Supabase SQL Editor (Dashboard > SQL Editor > New query).

BEGIN;

-- Asegurar que RLS está activo en la tabla
ALTER TABLE campos_futbol ENABLE ROW LEVEL SECURITY;

-- Eliminar política anterior si existe para evitar conflictos
DROP POLICY IF EXISTS "Lectura publica campos_futbol" ON campos_futbol;
DROP POLICY IF EXISTS "Gestion publica campos_futbol" ON campos_futbol;

-- Lectura pública (ya probablemente existe, pero la redeclaramos por seguridad)
CREATE POLICY "Lectura publica campos_futbol"
ON campos_futbol
FOR SELECT
TO public
USING (true);

-- Escritura pública (INSERT / UPDATE) para el panel admin anon
CREATE POLICY "Gestion publica campos_futbol"
ON campos_futbol
FOR ALL
TO public
USING (true)
WITH CHECK (true);

COMMIT;

-- Comprobación:
-- SELECT tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE tablename = 'campos_futbol'
-- ORDER BY policyname;
