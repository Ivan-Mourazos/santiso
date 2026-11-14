CREATE TABLE `partido_directo` (
	`partido_id` text PRIMARY KEY NOT NULL,
	`duracion_parte` integer DEFAULT 45 NOT NULL,
	`estado` text DEFAULT 'previo' NOT NULL,
	`inicio_parte` integer,
	`pausado_ms` integer DEFAULT 0 NOT NULL,
	`pausa_desde` integer,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`partido_id`) REFERENCES `partidos`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "partido_directo_estado_ck" CHECK("estado" in ('previo', 'primera', 'descanso', 'segunda', 'final')),
	CONSTRAINT "partido_directo_duracion_ck" CHECK("duracion_parte" between 10 and 60),
	CONSTRAINT "partido_directo_pausado_ck" CHECK("pausado_ms" >= 0)
);
--> statement-breakpoint
CREATE TABLE `partido_directo_eventos` (
	`id` text PRIMARY KEY NOT NULL,
	`partido_id` text NOT NULL,
	`tipo` text NOT NULL,
	`lado` text NOT NULL,
	`propia` integer DEFAULT false NOT NULL,
	`parte` integer NOT NULL,
	`minuto` integer,
	`jugador_id` text,
	`jugador_sale_id` text,
	`dorsal` integer,
	`dorsal_sale` integer,
	`nota` text DEFAULT '' NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`partido_id`) REFERENCES `partidos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`jugador_id`) REFERENCES `jugadores`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`jugador_sale_id`) REFERENCES `jugadores`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "partido_directo_eventos_tipo_ck" CHECK("tipo" in ('gol', 'tarjeta_amarilla', 'tarjeta_roja', 'cambio')),
	CONSTRAINT "partido_directo_eventos_lado_ck" CHECK("lado" in ('propio', 'rival')),
	CONSTRAINT "partido_directo_eventos_parte_ck" CHECK("parte" in (1, 2)),
	CONSTRAINT "partido_directo_eventos_propia_ck" CHECK(not "propia" or "tipo" = 'gol'),
	CONSTRAINT "partido_directo_eventos_minuto_ck" CHECK("minuto" is null or "minuto" between 0 and 130),
	CONSTRAINT "partido_directo_eventos_dorsal_ck" CHECK(("dorsal" is null or "dorsal" >= 0) and ("dorsal_sale" is null or "dorsal_sale" >= 0))
);
--> statement-breakpoint
CREATE INDEX `partido_directo_eventos_partido_idx` ON `partido_directo_eventos` (`partido_id`,`parte`,`minuto`);