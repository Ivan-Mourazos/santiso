CREATE TABLE `fotos_partido` (
	`id` text PRIMARY KEY NOT NULL,
	`partido_id` text NOT NULL,
	`clave` text NOT NULL,
	`ancho` integer NOT NULL,
	`alto` integer NOT NULL,
	`foco_x` real DEFAULT 0.5 NOT NULL,
	`foco_y` real DEFAULT 0.4 NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`partido_id`) REFERENCES `partidos`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "fotos_partido_foco_ck" CHECK("foco_x" between 0 and 1 and "foco_y" between 0 and 1)
);
--> statement-breakpoint
CREATE INDEX `fotos_partido_partido_idx` ON `fotos_partido` (`partido_id`);