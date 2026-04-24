-- Fix RLS para tablas usadas por calendario/equipos/descansos.
-- Ejecutar en Supabase SQL Editor.
-- Este proyecto ya usa politicas public/all en varias tablas admin.

BEGIN;

-- equipo_competiciones: necesario para listar equipos por competicion.
ALTER TABLE equipo_competiciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura publica equipo_competiciones" ON equipo_competiciones;
CREATE POLICY "Lectura publica equipo_competiciones"
ON equipo_competiciones
FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "Gestion publica equipo_competiciones" ON equipo_competiciones;
CREATE POLICY "Gestion publica equipo_competiciones"
ON equipo_competiciones
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- jornada_equipo_descanso: necesario para mostrar/gestionar equipos que descansan.
ALTER TABLE jornada_equipo_descanso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura publica jornada_equipo_descanso" ON jornada_equipo_descanso;
CREATE POLICY "Lectura publica jornada_equipo_descanso"
ON jornada_equipo_descanso
FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "Gestion publica jornada_equipo_descanso" ON jornada_equipo_descanso;
CREATE POLICY "Gestion publica jornada_equipo_descanso"
ON jornada_equipo_descanso
FOR ALL
TO public
USING (true)
WITH CHECK (true);

COMMIT;

-- Comprobacion:
-- SELECT tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE tablename IN ('equipo_competiciones', 'jornada_equipo_descanso')
-- ORDER BY tablename, policyname;
