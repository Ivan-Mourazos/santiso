CREATE TABLE `partido_alineaciones` (
	`partido_id` text NOT NULL,
	`jugador_id` text NOT NULL,
	`titular` integer NOT NULL,
	`capitan` integer DEFAULT false NOT NULL,
	`orden` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`partido_id`, `jugador_id`),
	FOREIGN KEY (`partido_id`) REFERENCES `partidos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`jugador_id`) REFERENCES `jugadores`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "partido_alineaciones_capitan_titular_ck" CHECK(not "capitan" or "titular")
);
