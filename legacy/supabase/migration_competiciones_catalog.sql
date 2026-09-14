-- Catálogo normalizado de competiciones + columna competicion_id en tablas relacionadas.
-- Ejecutar en Supabase SQL Editor (bloque completo, una vez).
-- Después: desplegar código que usa competicion_id; el campo texto "competicion" se mantiene en sync por trigger.

BEGIN;

-- ── 1. Tablas catálogo ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.competiciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    categoria TEXT NOT NULL,
    nombre TEXT NOT NULL,
    orden INTEGER NOT NULL DEFAULT 0,
    activa BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (categoria, nombre)
);

CREATE TABLE IF NOT EXISTS public.competicion_etiquetas (
    competicion_id UUID NOT NULL REFERENCES public.competiciones (id) ON DELETE CASCADE,
    categoria TEXT NOT NULL,
    etiqueta TEXT NOT NULL,
    PRIMARY KEY (competicion_id, etiqueta)
);

CREATE UNIQUE INDEX IF NOT EXISTS competicion_etiquetas_categoria_etiqueta_lower_key
    ON public.competicion_etiquetas (categoria, lower(trim(etiqueta)));

CREATE INDEX IF NOT EXISTS idx_competiciones_categoria_orden
    ON public.competiciones (categoria, orden);

-- UUIDs fijos (coinciden con datos semilla; filas huérfanas usan gen_random_uuid tras migrar)
INSERT INTO public.competiciones (id, categoria, nombre, orden, activa) VALUES
    ('a1000001-0001-4001-8001-000000000001', 'Senior', 'Terceira Galicia - Santiago - Fase Previa - Grupo 4', 0, true),
    ('a1000001-0002-4002-8002-000000000002', 'Senior', 'Terceira Galicia - Santiago - Fase Copa - Grupo 4', 1, true),
    ('a1000001-0003-4003-8003-000000000003', 'Femenino', 'Segunda División Galega - Grupo 2', 0, true),
    ('a1000001-0004-4004-8004-000000000004', 'Veteranos', 'División Da Honra - Veteranos - Santiago', 0, true),
    ('a1000001-0005-4005-8005-000000000005', 'Veteranos', 'Veteranos Copa - Santiago', 1, true)
ON CONFLICT (id) DO NOTHING;

-- Etiquetas = nombre canónico + alias históricos (único por categoría+texto)
INSERT INTO public.competicion_etiquetas (competicion_id, categoria, etiqueta) VALUES
    ('a1000001-0001-4001-8001-000000000001', 'Senior', 'Terceira Galicia - Santiago - Fase Previa - Grupo 4'),
    ('a1000001-0001-4001-8001-000000000001', 'Senior', 'Terceira Galicia - Santiago - Grupo 4'),
    ('a1000001-0001-4001-8001-000000000001', 'Senior', 'División de Honor'),
    ('a1000001-0001-4001-8001-000000000001', 'Senior', 'Division de Honor'),

    ('a1000001-0002-4002-8002-000000000002', 'Senior', 'Terceira Galicia - Santiago - Fase Copa - Grupo 4'),
    ('a1000001-0002-4002-8002-000000000002', 'Senior', 'Fase Grupo Copa'),

    ('a1000001-0003-4003-8003-000000000003', 'Femenino', 'Segunda División Galega - Grupo 2'),
    ('a1000001-0003-4003-8003-000000000003', 'Femenino', 'LGF 2ª División'),
    ('a1000001-0003-4003-8003-000000000003', 'Femenino', 'LGF 2a División'),
    ('a1000001-0003-4003-8003-000000000003', 'Femenino', 'LGF 2A División'),

    ('a1000001-0004-4004-8004-000000000004', 'Veteranos', 'División Da Honra - Veteranos - Santiago'),
    ('a1000001-0004-4004-8004-000000000004', 'Veteranos', 'Division Da Honra - Veteranos - Santiago'),
    ('a1000001-0004-4004-8004-000000000004', 'Veteranos', 'División Da Honra Veteranos Santiago'),
    ('a1000001-0004-4004-8004-000000000004', 'Veteranos', 'Liga principal'),
    ('a1000001-0004-4004-8004-000000000004', 'Veteranos', 'División de Honor'),
    ('a1000001-0004-4004-8004-000000000004', 'Veteranos', 'Division de Honor'),

    ('a1000001-0005-4005-8005-000000000005', 'Veteranos', 'Veteranos Copa - Santiago'),
    ('a1000001-0005-4005-8005-000000000005', 'Veteranos', 'Veteranos Copa'),
    ('a1000001-0005-4005-8005-000000000005', 'Veteranos', 'Copa Veteranos - Santiago'),
    ('a1000001-0005-4005-8005-000000000005', 'Veteranos', 'Copa Veteranos')
ON CONFLICT (categoria, lower(trim(etiqueta))) DO NOTHING;

-- ── 2. Columna competicion_id (nullable hasta backfill) ──────────────────────
ALTER TABLE public.jornadas ADD COLUMN IF NOT EXISTS competicion_id UUID REFERENCES public.competiciones (id);
ALTER TABLE public.partidos_liga ADD COLUMN IF NOT EXISTS competicion_id UUID REFERENCES public.competiciones (id);
ALTER TABLE public.equipo_competiciones ADD COLUMN IF NOT EXISTS competicion_id UUID REFERENCES public.competiciones (id);
ALTER TABLE public.reglas_liga ADD COLUMN IF NOT EXISTS competicion_id UUID REFERENCES public.competiciones (id);

-- ── 3. Backfill por etiquetas ────────────────────────────────────────────────
UPDATE public.jornadas j
SET competicion_id = e.competicion_id
FROM public.competicion_etiquetas e
WHERE j.categoria = e.categoria
  AND lower(trim(COALESCE(j.competicion, ''))) = lower(trim(e.etiqueta))
  AND j.competicion_id IS NULL;

UPDATE public.partidos_liga p
SET competicion_id = e.competicion_id
FROM public.competicion_etiquetas e
WHERE p.categoria = e.categoria
  AND lower(trim(COALESCE(p.competicion, ''))) = lower(trim(e.etiqueta))
  AND p.competicion_id IS NULL;

UPDATE public.equipo_competiciones ec
SET competicion_id = e.competicion_id
FROM public.competicion_etiquetas e
WHERE ec.categoria = e.categoria
  AND lower(trim(COALESCE(ec.competicion, ''))) = lower(trim(e.etiqueta))
  AND ec.competicion_id IS NULL;

UPDATE public.reglas_liga r
SET competicion_id = e.competicion_id
FROM public.competicion_etiquetas e
WHERE r.categoria = e.categoria
  AND lower(trim(COALESCE(r.competicion, ''))) = lower(trim(e.etiqueta))
  AND r.competicion_id IS NULL;

-- Filas huérfanas → nueva fila catálogo + etiqueta (= texto actual)
INSERT INTO public.competiciones (categoria, nombre, orden, activa)
SELECT sq.categoria, sq.nombre, 99, true
FROM (
    SELECT DISTINCT j.categoria, trim(j.competicion) AS nombre
    FROM public.jornadas j
    WHERE j.competicion_id IS NULL
      AND j.competicion IS NOT NULL
      AND trim(j.competicion) <> ''

    UNION
    SELECT DISTINCT p.categoria, trim(p.competicion) AS nombre
    FROM public.partidos_liga p
    WHERE p.competicion_id IS NULL
      AND p.competicion IS NOT NULL
      AND trim(p.competicion) <> ''

    UNION
    SELECT DISTINCT ec.categoria, trim(ec.competicion) AS nombre
    FROM public.equipo_competiciones ec
    WHERE ec.competicion_id IS NULL
      AND ec.competicion IS NOT NULL
      AND trim(ec.competicion) <> ''

    UNION
    SELECT DISTINCT r.categoria, trim(r.competicion) AS nombre
    FROM public.reglas_liga r
    WHERE r.competicion_id IS NULL
      AND r.competicion IS NOT NULL
      AND trim(r.competicion) <> ''
) sq
WHERE NOT EXISTS (
    SELECT 1 FROM public.competiciones c
    WHERE c.categoria = sq.categoria AND c.nombre = sq.nombre
)
ON CONFLICT (categoria, nombre) DO NOTHING;

INSERT INTO public.competicion_etiquetas (competicion_id, categoria, etiqueta)
SELECT c.id, c.categoria, c.nombre
FROM public.competiciones c
WHERE NOT EXISTS (
    SELECT 1 FROM public.competicion_etiquetas e
    WHERE e.competicion_id = c.id AND lower(trim(e.etiqueta)) = lower(trim(c.nombre))
)
ON CONFLICT (categoria, lower(trim(etiqueta))) DO NOTHING;

UPDATE public.jornadas j
SET competicion_id = c.id
FROM public.competiciones c
WHERE j.competicion_id IS NULL
  AND j.categoria = c.categoria
  AND lower(trim(j.competicion)) = lower(trim(c.nombre));

UPDATE public.partidos_liga p
SET competicion_id = c.id
FROM public.competiciones c
WHERE p.competicion_id IS NULL
  AND p.categoria = c.categoria
  AND lower(trim(p.competicion)) = lower(trim(c.nombre));

UPDATE public.equipo_competiciones ec
SET competicion_id = c.id
FROM public.competiciones c
WHERE ec.competicion_id IS NULL
  AND ec.categoria = c.categoria
  AND lower(trim(ec.competicion)) = lower(trim(c.nombre));

UPDATE public.reglas_liga r
SET competicion_id = c.id
FROM public.competiciones c
WHERE r.competicion_id IS NULL
  AND r.categoria = c.categoria
  AND lower(trim(r.competicion)) = lower(trim(c.nombre));

-- Si algo sigue NULL, asignar competición fallback por categoría (primera por orden)
UPDATE public.jornadas j
SET competicion_id = (
    SELECT c.id FROM public.competiciones c
    WHERE c.categoria = j.categoria AND c.activa
    ORDER BY c.orden NULLS LAST, c.nombre LIMIT 1
)
WHERE j.competicion_id IS NULL;

UPDATE public.partidos_liga p
SET competicion_id = (
    SELECT c.id FROM public.competiciones c
    WHERE c.categoria = p.categoria AND c.activa
    ORDER BY c.orden NULLS LAST, c.nombre LIMIT 1
)
WHERE p.competicion_id IS NULL;

UPDATE public.equipo_competiciones ec
SET competicion_id = (
    SELECT c.id FROM public.competiciones c
    WHERE c.categoria = ec.categoria AND c.activa
    ORDER BY c.orden NULLS LAST, c.nombre LIMIT 1
)
WHERE ec.competicion_id IS NULL;

UPDATE public.reglas_liga r
SET competicion_id = (
    SELECT c.id FROM public.competiciones c
    WHERE c.categoria = r.categoria AND c.activa
    ORDER BY c.orden NULLS LAST, c.nombre LIMIT 1
)
WHERE r.competicion_id IS NULL;

ALTER TABLE public.jornadas ALTER COLUMN competicion_id SET NOT NULL;
ALTER TABLE public.partidos_liga ALTER COLUMN competicion_id SET NOT NULL;
ALTER TABLE public.equipo_competiciones ALTER COLUMN competicion_id SET NOT NULL;
ALTER TABLE public.reglas_liga ALTER COLUMN competicion_id SET NOT NULL;

-- ── 4. Sincronizar texto legacy "competicion" ───────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_competicion_text_from_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.competicion_id IS NOT NULL THEN
        SELECT c.nombre INTO NEW.competicion
        FROM public.competiciones c
        WHERE c.id = NEW.competicion_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jornadas_sync_comp_txt ON public.jornadas;
CREATE TRIGGER trg_jornadas_sync_comp_txt
    BEFORE INSERT OR UPDATE OF competicion_id ON public.jornadas
    FOR EACH ROW
    EXECUTE PROCEDURE public.sync_competicion_text_from_id();

DROP TRIGGER IF EXISTS trg_partidos_sync_comp_txt ON public.partidos_liga;
CREATE TRIGGER trg_partidos_sync_comp_txt
    BEFORE INSERT OR UPDATE OF competicion_id ON public.partidos_liga
    FOR EACH ROW
    EXECUTE PROCEDURE public.sync_competicion_text_from_id();

DROP TRIGGER IF EXISTS trg_equipo_comp_sync_comp_txt ON public.equipo_competiciones;
CREATE TRIGGER trg_equipo_comp_sync_comp_txt
    BEFORE INSERT OR UPDATE OF competicion_id ON public.equipo_competiciones
    FOR EACH ROW
    EXECUTE PROCEDURE public.sync_competicion_text_from_id();

DROP TRIGGER IF EXISTS trg_reglas_sync_comp_txt ON public.reglas_liga;
CREATE TRIGGER trg_reglas_sync_comp_txt
    BEFORE INSERT OR UPDATE OF competicion_id ON public.reglas_liga
    FOR EACH ROW
    EXECUTE PROCEDURE public.sync_competicion_text_from_id();

UPDATE public.jornadas SET competicion_id = competicion_id;
UPDATE public.partidos_liga SET competicion_id = competicion_id;
UPDATE public.equipo_competiciones SET competicion_id = competicion_id;
UPDATE public.reglas_liga SET competicion_id = competicion_id;

-- ── 5. Dedup equipo_competiciones ────────────────────────────────────────────
DELETE FROM public.equipo_competiciones ec1
    USING public.equipo_competiciones ec2
WHERE ec1.ctid > ec2.ctid
  AND ec1.equipo_id = ec2.equipo_id
  AND ec1.competicion_id = ec2.competicion_id;

-- ── 6. Dedup reglas_liga ─────────────────────────────────────────────────────
DELETE FROM public.reglas_liga r1
    USING public.reglas_liga r2
WHERE r1.ctid > r2.ctid
  AND r1.temporada_id = r2.temporada_id
  AND r1.categoria = r2.categoria
  AND r1.competicion_id = r2.competicion_id;

-- ── 7. Sustituir UNIQUE / índices que usaban texto ───────────────────────────
ALTER TABLE public.equipo_competiciones
    DROP CONSTRAINT IF EXISTS equipo_competiciones_equipo_id_categoria_competicion_key,
    DROP CONSTRAINT IF EXISTS equipo_competiciones_equipo_competicion_id_key;

ALTER TABLE public.equipo_competiciones
    ADD CONSTRAINT equipo_competiciones_equipo_competicion_id_key UNIQUE (equipo_id, competicion_id);

ALTER TABLE public.reglas_liga
    DROP CONSTRAINT IF EXISTS reglas_liga_temporada_id_categoria_competicion_key,
    DROP CONSTRAINT IF EXISTS reglas_liga_temporada_cat_comp_id_key;

ALTER TABLE public.reglas_liga
    ADD CONSTRAINT reglas_liga_temporada_cat_comp_id_key UNIQUE (temporada_id, categoria, competicion_id);

DROP INDEX IF EXISTS idx_reglas_liga_temporada;
CREATE INDEX IF NOT EXISTS idx_reglas_liga_temporada_comp
    ON public.reglas_liga (temporada_id, categoria, competicion_id);

ALTER TABLE public.jornadas
    DROP CONSTRAINT IF EXISTS jornadas_temporada_categoria_comp_num_unique,
    DROP CONSTRAINT IF EXISTS jornadas_temporada_cat_compid_num_unique;

ALTER TABLE public.jornadas
    ADD CONSTRAINT jornadas_temporada_cat_compid_num_unique
        UNIQUE NULLS NOT DISTINCT (temporada_id, categoria, competicion_id, numero);

DROP INDEX IF EXISTS idx_partidos_liga_finalizados_comp;
CREATE INDEX IF NOT EXISTS idx_partidos_liga_finalizados_comp_id
    ON public.partidos_liga (categoria, competicion_id, fecha)
    WHERE estado = 'finalizado';

DROP INDEX IF EXISTS idx_jornadas_categoria_comp;
CREATE INDEX IF NOT EXISTS idx_jornadas_cat_comp_id
    ON public.jornadas (temporada_id, categoria, competicion_id);

DROP INDEX IF EXISTS idx_equipo_comp_cat_comp;
CREATE INDEX IF NOT EXISTS idx_equipo_comp_comp_id
    ON public.equipo_competiciones (categoria, competicion_id);

COMMIT;

-- RLS lectura pública catálogo
ALTER TABLE public.competiciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competicion_etiquetas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura publica competiciones" ON public.competiciones;
CREATE POLICY "Lectura publica competiciones"
    ON public.competiciones FOR SELECT TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Gestion admin competiciones" ON public.competiciones;
CREATE POLICY "Gestion admin competiciones"
    ON public.competiciones FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lectura publica competicion_etiquetas" ON public.competicion_etiquetas;
CREATE POLICY "Lectura publica competicion_etiquetas"
    ON public.competicion_etiquetas FOR SELECT TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Gestion admin competicion_etiquetas" ON public.competicion_etiquetas;
CREATE POLICY "Gestion admin competicion_etiquetas"
    ON public.competicion_etiquetas FOR ALL TO authenticated
    USING (true) WITH CHECK (true);
