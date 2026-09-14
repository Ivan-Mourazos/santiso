-- Fix schema tras diagnóstico admin.
-- Seguro/idempotente para Supabase.

BEGIN;

-- 1) reglas_liga: created_at faltante
ALTER TABLE public.reglas_liga
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

UPDATE public.reglas_liga
SET created_at = COALESCE(created_at, now())
WHERE created_at IS NULL;

ALTER TABLE public.reglas_liga
ALTER COLUMN created_at SET DEFAULT now();

-- 2) jornadas: fecha_inicio debe soportar hora
-- Si hoy es date, convertir a timestamptz conservando día.
ALTER TABLE public.jornadas
ALTER COLUMN fecha_inicio TYPE TIMESTAMPTZ
USING (
  CASE
    WHEN fecha_inicio IS NULL THEN NULL
    ELSE (fecha_inicio::timestamp AT TIME ZONE 'UTC')
  END
);

COMMIT;
