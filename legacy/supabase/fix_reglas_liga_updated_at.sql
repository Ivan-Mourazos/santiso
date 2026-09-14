-- Arreglo seguro para tabla reglas_liga:
-- 1) Crea columna updated_at si no existe
-- 2) Inicializa updated_at en filas antiguas
-- 3) Crea función trigger para auto-actualizar updated_at
-- 4) Crea trigger si no existe

ALTER TABLE public.reglas_liga
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE public.reglas_liga
SET updated_at = COALESCE(updated_at, now())
WHERE updated_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_reglas_liga_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reglas_liga_updated_at ON public.reglas_liga;

CREATE TRIGGER trg_reglas_liga_updated_at
BEFORE UPDATE ON public.reglas_liga
FOR EACH ROW
EXECUTE FUNCTION public.set_reglas_liga_updated_at();
