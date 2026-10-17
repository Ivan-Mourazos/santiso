CREATE TABLE `carteles_partido` (
	`id` text PRIMARY KEY NOT NULL,
	`partido_id` text NOT NULL,
	`paso` text NOT NULL,
	`formato` text NOT NULL,
	`clave` text NOT NULL,
	`huella` text NOT NULL,
	`peticion` text NOT NULL,
	`generado_en` text NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`partido_id`) REFERENCES `partidos`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "carteles_partido_paso_ck" CHECK("paso" in ('partido', 'convocatoria', 'once', 'resultado', 'cronoloxia', 'noso11')),
	CONSTRAINT "carteles_partido_formato_ck" CHECK("formato" in ('publicacion', 'historia'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `carteles_partido_paso_formato_uq` ON `carteles_partido` (`partido_id`,`paso`,`formato`);--> statement-breakpoint
CREATE INDEX `carteles_partido_generado_idx` ON `carteles_partido` (`generado_en`);