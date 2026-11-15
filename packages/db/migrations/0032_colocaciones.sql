CREATE TABLE `partido_colocaciones` (
	`partido_id` text NOT NULL,
	`momento` text NOT NULL,
	`sistema` text NOT NULL,
	`huecos` text NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`partido_id`, `momento`),
	FOREIGN KEY (`partido_id`) REFERENCES `partidos`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "partido_colocaciones_momento_ck" CHECK("momento" in ('previa', 'final')),
	CONSTRAINT "partido_colocaciones_sistema_ck" CHECK("sistema" in ('4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '4-1-4-1', '5-3-2'))
);
