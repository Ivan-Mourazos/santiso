-- Limpiar tabla para evitar duplicados
DELETE FROM campos_futbol;

-- Insertar lista oficial de campos extraída de Futgal (Santiso Senior y Veteranos)
INSERT INTO campos_futbol (nombre, poblacion) VALUES
('Gándara', 'Santiso'),
('Municipal de Guntín', 'Guntín'),
('O Poste', 'O Pino'),
('A Granxa', 'Vila de Cruces'),
('Municipal de Monterroso', 'Monterroso'),
('Municipal de Taboada', 'Taboada'),
('Municipal de Portomarín', 'Portomarín'),
('Municipal de Paradela', 'Paradela'),
('Carballido', 'Curtis'),
('Silleda', 'Silleda'),
('Vila de Cruces', 'Vila de Cruces'),
('Lalín', 'Lalín'),
('Agolada', 'Agolada'),
('Municipal de Antas', 'Antas de Ulla'),
('Cerredo', 'Palas de Rei');
