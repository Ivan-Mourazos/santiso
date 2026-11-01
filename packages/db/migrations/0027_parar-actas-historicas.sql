-- Detiene solo solicitudes en marcha. Conserva calendario, partidos, eventos y alineaciones.
UPDATE rfgf_grupos_historicos
SET partidos_estado = 'no_pedido', partidos_pedidos_en = NULL
WHERE partidos_estado IN ('en_cola', 'en_curso');
