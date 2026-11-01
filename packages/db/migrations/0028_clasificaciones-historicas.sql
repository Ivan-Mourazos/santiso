CREATE TABLE `rfgf_historico_clasificaciones` (
	`cod_grupo` text PRIMARY KEY NOT NULL,
	`formato` text,
	`jornada` integer,
	`filas` text,
	`ronda` text,
	`estado` text DEFAULT 'pendiente' NOT NULL,
	`intentos` integer DEFAULT 0 NOT NULL,
	`vacias` integer DEFAULT 0 NOT NULL,
	`aviso` text DEFAULT '' NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`cod_grupo`) REFERENCES `rfgf_grupos_historicos`(`cod_grupo`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "historico_clasificaciones_estado_ck" CHECK("estado" in ('pendiente', 'leido', 'sin_datos', 'error')),
	CONSTRAINT "historico_clasificaciones_formato_ck" CHECK("formato" in ('liga', 'copa'))
);
