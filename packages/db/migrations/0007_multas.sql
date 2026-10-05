CREATE TABLE `multas` (
	`id` text PRIMARY KEY NOT NULL,
	`temporada_id` text NOT NULL,
	`jugador_id` text,
	`staff_id` text,
	`concepto` text NOT NULL,
	`importe_centimos` integer NOT NULL,
	`fecha` text NOT NULL,
	`nota` text,
	`pagada_en` text,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`temporada_id`) REFERENCES `temporadas`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`jugador_id`) REFERENCES `jugadores`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "multas_una_persona_ck" CHECK(("jugador_id" is null) <> ("staff_id" is null)),
	CONSTRAINT "multas_importe_ck" CHECK("importe_centimos" > 0)
);
--> statement-breakpoint
CREATE INDEX `multas_temporada_idx` ON `multas` (`temporada_id`,`fecha`);--> statement-breakpoint
CREATE INDEX `multas_jugador_idx` ON `multas` (`jugador_id`);--> statement-breakpoint
CREATE TABLE `multas_conceptos` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`clave` text NOT NULL,
	`grupo` text NOT NULL,
	`importe_centimos` integer NOT NULL,
	`por_unidad` integer DEFAULT false NOT NULL,
	`opciones` text DEFAULT '[]' NOT NULL,
	`orden` integer DEFAULT 0 NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "multas_conceptos_grupo_ck" CHECK("grupo" in ('adestramento', 'partido')),
	CONSTRAINT "multas_conceptos_importe_ck" CHECK("importe_centimos" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `multas_conceptos_grupo_clave_uq` ON `multas_conceptos` (`grupo`,`clave`);