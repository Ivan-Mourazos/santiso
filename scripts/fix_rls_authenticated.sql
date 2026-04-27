-- ============================================================
-- RLS DEFINITIVO: authenticated write, anon read
-- Ejecutar en Supabase Dashboard → SQL Editor → New query
-- Reemplaza fix_rls_acta_importer.sql y fix_rls_campos_futbol.sql
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- HELPER: aplica el patrón estándar a cada tabla
--   SELECT → public (anon puede leer)
--   INSERT/UPDATE/DELETE → authenticated only
-- ────────────────────────────────────────────────────────────

-- partidos_liga
ALTER TABLE partidos_liga ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura publica partidos_liga" ON partidos_liga;
DROP POLICY IF EXISTS "Gestion publica partidos_liga" ON partidos_liga;
DROP POLICY IF EXISTS "Gestion admin partidos_liga" ON partidos_liga;
CREATE POLICY "Lectura publica partidos_liga" ON partidos_liga FOR SELECT TO public USING (true);
CREATE POLICY "Gestion admin partidos_liga" ON partidos_liga FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- jornadas
ALTER TABLE jornadas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura publica jornadas" ON jornadas;
DROP POLICY IF EXISTS "Gestion publica jornadas" ON jornadas;
DROP POLICY IF EXISTS "Gestion admin jornadas" ON jornadas;
CREATE POLICY "Lectura publica jornadas" ON jornadas FOR SELECT TO public USING (true);
CREATE POLICY "Gestion admin jornadas" ON jornadas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- temporadas
ALTER TABLE temporadas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura publica temporadas" ON temporadas;
DROP POLICY IF EXISTS "Gestion publica temporadas" ON temporadas;
DROP POLICY IF EXISTS "Gestion admin temporadas" ON temporadas;
CREATE POLICY "Lectura publica temporadas" ON temporadas FOR SELECT TO public USING (true);
CREATE POLICY "Gestion admin temporadas" ON temporadas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- equipos
ALTER TABLE equipos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura publica equipos" ON equipos;
DROP POLICY IF EXISTS "Gestion publica equipos" ON equipos;
DROP POLICY IF EXISTS "Gestion admin equipos" ON equipos;
CREATE POLICY "Lectura publica equipos" ON equipos FOR SELECT TO public USING (true);
CREATE POLICY "Gestion admin equipos" ON equipos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- equipo_competiciones
ALTER TABLE equipo_competiciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura publica equipo_competiciones" ON equipo_competiciones;
DROP POLICY IF EXISTS "Gestion publica equipo_competiciones" ON equipo_competiciones;
DROP POLICY IF EXISTS "Gestion admin equipo_competiciones" ON equipo_competiciones;
CREATE POLICY "Lectura publica equipo_competiciones" ON equipo_competiciones FOR SELECT TO public USING (true);
CREATE POLICY "Gestion admin equipo_competiciones" ON equipo_competiciones FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- campos_futbol
ALTER TABLE campos_futbol ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura publica campos_futbol" ON campos_futbol;
DROP POLICY IF EXISTS "Gestion publica campos_futbol" ON campos_futbol;
DROP POLICY IF EXISTS "Gestion admin campos_futbol" ON campos_futbol;
CREATE POLICY "Lectura publica campos_futbol" ON campos_futbol FOR SELECT TO public USING (true);
CREATE POLICY "Gestion admin campos_futbol" ON campos_futbol FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- jugadores
ALTER TABLE jugadores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura publica jugadores" ON jugadores;
DROP POLICY IF EXISTS "Gestion publica jugadores" ON jugadores;
DROP POLICY IF EXISTS "Gestion admin jugadores" ON jugadores;
CREATE POLICY "Lectura publica jugadores" ON jugadores FOR SELECT TO public USING (true);
CREATE POLICY "Gestion admin jugadores" ON jugadores FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- jugador_partido_stats
ALTER TABLE jugador_partido_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura publica jugador_partido_stats" ON jugador_partido_stats;
DROP POLICY IF EXISTS "Gestion publica jugador_partido_stats" ON jugador_partido_stats;
DROP POLICY IF EXISTS "Gestion admin jugador_partido_stats" ON jugador_partido_stats;
CREATE POLICY "Lectura publica jugador_partido_stats" ON jugador_partido_stats FOR SELECT TO public USING (true);
CREATE POLICY "Gestion admin jugador_partido_stats" ON jugador_partido_stats FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- partido_eventos_santiso
ALTER TABLE partido_eventos_santiso ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura publica partido_eventos_santiso" ON partido_eventos_santiso;
DROP POLICY IF EXISTS "Gestion publica partido_eventos_santiso" ON partido_eventos_santiso;
DROP POLICY IF EXISTS "Gestion admin partido_eventos_santiso" ON partido_eventos_santiso;
CREATE POLICY "Lectura publica partido_eventos_santiso" ON partido_eventos_santiso FOR SELECT TO public USING (true);
CREATE POLICY "Gestion admin partido_eventos_santiso" ON partido_eventos_santiso FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- jornada_equipo_descanso
ALTER TABLE jornada_equipo_descanso ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura publica jornada_equipo_descanso" ON jornada_equipo_descanso;
DROP POLICY IF EXISTS "Gestion publica jornada_equipo_descanso" ON jornada_equipo_descanso;
DROP POLICY IF EXISTS "Gestion admin jornada_equipo_descanso" ON jornada_equipo_descanso;
CREATE POLICY "Lectura publica jornada_equipo_descanso" ON jornada_equipo_descanso FOR SELECT TO public USING (true);
CREATE POLICY "Gestion admin jornada_equipo_descanso" ON jornada_equipo_descanso FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- sponsors (si existe)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sponsors') THEN
    ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Lectura publica sponsors" ON sponsors;
    DROP POLICY IF EXISTS "Gestion publica sponsors" ON sponsors;
    DROP POLICY IF EXISTS "Gestion admin sponsors" ON sponsors;
    CREATE POLICY "Lectura publica sponsors" ON sponsors FOR SELECT TO public USING (true);
    CREATE POLICY "Gestion admin sponsors" ON sponsors FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- staff (si existe)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff') THEN
    ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Lectura publica staff" ON staff;
    DROP POLICY IF EXISTS "Gestion publica staff" ON staff;
    DROP POLICY IF EXISTS "Gestion admin staff" ON staff;
    CREATE POLICY "Lectura publica staff" ON staff FOR SELECT TO public USING (true);
    CREATE POLICY "Gestion admin staff" ON staff FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMIT;

-- ============================================================
-- PASO MANUAL (solo una vez, después de ejecutar este script):
-- 1. Ve a Supabase Dashboard → Authentication → Users
-- 2. Clic "Invite user" o "Add user"
-- 3. Introduce tu email y contraseña
-- 4. Ya puedes hacer login en /login de la web
-- ============================================================

-- Verificación:
-- SELECT tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE tablename IN (
--   'partidos_liga','jornadas','temporadas','equipos','campos_futbol',
--   'jugadores','jugador_partido_stats','partido_eventos_santiso',
--   'jornada_equipo_descanso','sponsors','staff'
-- )
-- ORDER BY tablename, policyname;
