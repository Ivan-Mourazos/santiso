CREATE TABLE `rfgf_jugadores` (
	`codigo` text NOT NULL,
	`competicion_id` text NOT NULL,
	`jugador_id` text,
	`nombre` text NOT NULL,
	`cod_acta` text NOT NULL,
	`cifras` text,
	`leido_en` text,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`codigo`, `competicion_id`),
	FOREIGN KEY (`competicion_id`) REFERENCES `competiciones`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`jugador_id`) REFERENCES `jugadores`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `rfgf_jugadores_jugador_idx` ON `rfgf_jugadores` (`jugador_id`);