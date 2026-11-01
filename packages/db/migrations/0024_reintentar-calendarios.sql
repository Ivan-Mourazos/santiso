-- Estos grupos se dieron por no compatibles cuando solo se sabía leer el PDF de una liga limpia.
-- Ahora se leen de la web: vuelven a la cola. Lo ya traído de otros grupos no se toca.
UPDATE `rfgf_grupos_historicos`
SET `partidos_estado` = 'en_cola', `partidos_aviso` = '', `partidos_calendario_en` = NULL, `partidos_intentos` = 0
WHERE `partidos_estado` = 'no_compatible';
