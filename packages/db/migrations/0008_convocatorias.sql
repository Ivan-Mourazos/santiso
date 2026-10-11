CREATE TABLE `partido_convocados` (
	`partido_id` text NOT NULL,
	`jugador_id` text NOT NULL,
	PRIMARY KEY(`partido_id`, `jugador_id`),
	FOREIGN KEY (`partido_id`) REFERENCES `partido_convocatorias`(`partido_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`jugador_id`) REFERENCES `jugadores`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `partido_convocados_jugador_idx` ON `partido_convocados` (`jugador_id`);--> statement-breakpoint
CREATE TABLE `partido_convocatorias` (
	`partido_id` text PRIMARY KEY NOT NULL,
	`hora_quedada` text DEFAULT '' NOT NULL,
	`lugar_quedada` text DEFAULT '' NOT NULL,
	`equipacion` text DEFAULT '' NOT NULL,
	`nota` text DEFAULT '' NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`partido_id`) REFERENCES `partidos`(`id`) ON UPDATE no action ON DELETE cascade
);
