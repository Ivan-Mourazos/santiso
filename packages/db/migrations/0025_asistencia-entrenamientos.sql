CREATE TABLE `asistencias` (
	`id` text PRIMARY KEY NOT NULL,
	`entrenamiento_id` text NOT NULL,
	`jugador_id` text,
	`staff_id` text,
	`estado` text NOT NULL,
	`justificado` integer DEFAULT false NOT NULL,
	`motivo` text,
	`multa_id` text,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`entrenamiento_id`) REFERENCES `entrenamientos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`jugador_id`) REFERENCES `jugadores`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`multa_id`) REFERENCES `multas`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "asistencias_persona_ck" CHECK(("jugador_id" is null) <> ("staff_id" is null)),
	CONSTRAINT "asistencias_estado_ck" CHECK("estado" in ('presente', 'tarde', 'ausente'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `asistencias_jugador_uq` ON `asistencias` (`entrenamiento_id`,`jugador_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `asistencias_staff_uq` ON `asistencias` (`entrenamiento_id`,`staff_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `asistencias_multa_uq` ON `asistencias` (`multa_id`);--> statement-breakpoint
CREATE TABLE `entrenamientos` (
	`id` text PRIMARY KEY NOT NULL,
	`temporada_id` text NOT NULL,
	`categoria` text NOT NULL,
	`fecha` text NOT NULL,
	`hora` text,
	`nota` text,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`temporada_id`) REFERENCES `temporadas`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "entrenamientos_categoria_ck" CHECK("categoria" in ('Senior', 'Veteranos'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entrenamientos_dia_uq` ON `entrenamientos` (`temporada_id`,`categoria`,`fecha`);