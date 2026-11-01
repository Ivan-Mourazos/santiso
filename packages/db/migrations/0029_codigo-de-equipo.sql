CREATE TABLE `rfgf_anteriores_equipo` (
	`codigo` text PRIMARY KEY NOT NULL,
	`grupos` text,
	`estado` text DEFAULT 'pendiente' NOT NULL,
	`intentos` integer DEFAULT 0 NOT NULL,
	`aviso` text DEFAULT '' NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "anteriores_equipo_estado_ck" CHECK("estado" in ('pendiente', 'leido', 'sin_datos', 'sin_club', 'error'))
);
--> statement-breakpoint
ALTER TABLE `rfgf_anteriores_cifras` ADD `equipo` text;--> statement-breakpoint
ALTER TABLE `rfgf_anteriores_cifras` ADD `cod_equipo` text;--> statement-breakpoint
ALTER TABLE `rfgf_anteriores_grupo` ADD `partidos` text;--> statement-breakpoint
ALTER TABLE `rfgf_anteriores_peticiones` ADD `equipo_codigo` text;