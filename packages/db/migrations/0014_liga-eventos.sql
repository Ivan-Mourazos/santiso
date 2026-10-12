CREATE TABLE `liga_eventos` (
	`id` text PRIMARY KEY NOT NULL,
	`partido_id` text NOT NULL,
	`equipo_id` text NOT NULL,
	`persona` text NOT NULL,
	`persona_clave` text NOT NULL,
	`tipo` text NOT NULL,
	`minuto` text DEFAULT '' NOT NULL,
	`tecnico` integer DEFAULT false NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`partido_id`) REFERENCES `partidos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`equipo_id`) REFERENCES `equipos`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "liga_eventos_tipo_ck" CHECK("tipo" in ('gol', 'gol_propia', 'amarilla', 'doble_amarilla', 'roja'))
);
--> statement-breakpoint
CREATE INDEX `liga_eventos_partido_idx` ON `liga_eventos` (`partido_id`);--> statement-breakpoint
CREATE INDEX `liga_eventos_equipo_idx` ON `liga_eventos` (`equipo_id`);--> statement-breakpoint
ALTER TABLE `competiciones` ADD `amarillas_ciclo` integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `rfgf_actas` ADD `eventos` integer DEFAULT false NOT NULL;