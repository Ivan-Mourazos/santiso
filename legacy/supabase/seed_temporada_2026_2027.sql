-- ==========================================================
-- SEED TEMPORADA 2026-2027: TERCERA FUTGAL (SENIOR) E 1ª GALICIA (VETERANOS)
-- ==========================================================

-- 1. Crear temporada 2026-2027 e poñela activa
INSERT INTO temporadas (id, nombre, activa)
VALUES ('t2026-2027', '2026/2027', true)
ON CONFLICT (id) DO UPDATE SET activa = true;

UPDATE temporadas SET activa = false WHERE id != 't2026-2027';

-- 2. Competicións
INSERT INTO competiciones (id, categoria, nombre, orden, activa, formato)
VALUES 
  ('comp-senior-2026', 'Senior', 'Tercera Futgal - Gr. 3', 1, true, 'liga'),
  ('comp-veteranos-2026', 'Veteranos', 'Veteranos 1ª Galicia - Gr. 2', 2, true, 'liga')
ON CONFLICT (id) DO UPDATE SET 
  nombre = EXCLUDED.nombre,
  activa = true,
  orden = EXCLUDED.orden;

-- 3. Equipos Senior
INSERT INTO equipos (nombre, categoria)
VALUES 
  ('U.D. SANTISO F.C.', 'Senior'),
  ('C.D. SAN MAMED', 'Senior'),
  ('C.D. BERRES', 'Senior'),
  ('ATLETICO ETER', 'Senior'),
  ('CLUB ARENAL', 'Senior'),
  ('C.S.D ARZUA "B"', 'Senior'),
  ('GUERREROS DEL SOL', 'Senior'),
  ('S.D. CRUCES', 'Senior'),
  ('S.D. BANDEIRA', 'Senior'),
  ('S.D. TOURO', 'Senior'),
  ('VILATUXE F.C.', 'Senior'),
  ('VISTA ALEGRE S.D.', 'Senior'),
  ('C.D. COMPAÑÍA DE MARIA', 'Senior'),
  ('A.C.U.D. CAMPORRAPADO', 'Senior')
ON CONFLICT (nombre) DO NOTHING;

-- 4. Equipos Veteranos
INSERT INTO equipos (nombre, categoria)
VALUES 
  ('U.D. SANTISO F.C. SOLAINA', 'Veteranos'),
  ('C.D. VETERANOS BERMÉS', 'Veteranos'),
  ('S.D. TORDOIA', 'Veteranos'),
  ('S.E. ABELLA S.D.E C.', 'Veteranos'),
  ('PREFABRICADOS FARO RODEIRO VETERANS', 'Veteranos'),
  ('S.D.C. RECESENDE', 'Veteranos'),
  ('CAF SILLEDA', 'Veteranos'),
  ('VETERANOS BALOMPIE FOGAR DE BREOGAN', 'Veteranos'),
  ('CLUB TABERNA DO PORTUGUES-BOQUEIXON VETERANOS', 'Veteranos'),
  ('S.D. CACHEIRAS', 'Veteranos'),
  ('S.D. TOURO VETERANOS', 'Veteranos'),
  ('ULLA OIL VETERANOS', 'Veteranos'),
  ('MELIDE VETERANOS', 'Veteranos'),
  ('SR CALO - MILONGAS', 'Veteranos'),
  ('RESMON C.F.', 'Veteranos')
ON CONFLICT (nombre) DO NOTHING;
