CREATE TABLE `rfgf_equipos_club` (
	`categoria` text PRIMARY KEY NOT NULL,
	`cod_equipo` text NOT NULL,
	`temporadas_en` text NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "rfgf_equipos_club_categoria_ck" CHECK("categoria" in ('Senior', 'Veteranos'))
);
--> statement-breakpoint
CREATE TABLE `rfgf_historico_alineaciones` (
	`id` text PRIMARY KEY NOT NULL,
	`partido_id` text NOT NULL,
	`lado` text NOT NULL,
	`persona` text NOT NULL,
	`persona_clave` text NOT NULL,
	`dorsal` integer,
	`titular` integer NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`partido_id`) REFERENCES `rfgf_historico_partidos`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "rfgf_historico_alineaciones_lado_ck" CHECK("lado" in ('local', 'visitante'))
);
--> statement-breakpoint
CREATE INDEX `rfgf_historico_alineaciones_partido_idx` ON `rfgf_historico_alineaciones` (`partido_id`);--> statement-breakpoint
CREATE INDEX `rfgf_historico_alineaciones_persona_idx` ON `rfgf_historico_alineaciones` (`persona_clave`);--> statement-breakpoint
CREATE TABLE `rfgf_clubes` (
	`codigo` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`clave` text NOT NULL,
	`delegacion` text,
	`comarca` text,
	`direccion` text,
	`localidad` text,
	`provincia` text,
	`codigo_postal` text,
	`fecha_fundacion` text,
	`fecha_inscripcion_federacion` text,
	`camiseta` text,
	`pantalon` text,
	`medias` text,
	`numero_equipos` integer,
	`leido_en` text NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rfgf_clubes_clave_idx` ON `rfgf_clubes` (`clave`);--> statement-breakpoint
CREATE TABLE `liga_alineaciones` (
	`id` text PRIMARY KEY NOT NULL,
	`partido_id` text NOT NULL,
	`equipo_id` text NOT NULL,
	`persona` text NOT NULL,
	`persona_clave` text NOT NULL,
	`dorsal` integer,
	`titular` integer NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`partido_id`) REFERENCES `partidos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`equipo_id`) REFERENCES `equipos`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "liga_alineaciones_dorsal_ck" CHECK("dorsal" is null or "dorsal" >= 0)
);
--> statement-breakpoint
CREATE INDEX `liga_alineaciones_partido_idx` ON `liga_alineaciones` (`partido_id`);--> statement-breakpoint
CREATE INDEX `liga_alineaciones_persona_idx` ON `liga_alineaciones` (`persona_clave`);--> statement-breakpoint
ALTER TABLE `equipos` ADD `color_federacion` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `equipos` ADD `club_codigo` text REFERENCES rfgf_clubes(codigo) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `equipos` ADD `club_manual` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `equipos_club_idx` ON `equipos` (`club_codigo`);