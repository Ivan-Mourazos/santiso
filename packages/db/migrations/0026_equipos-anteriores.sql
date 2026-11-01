CREATE TABLE `rfgf_anteriores_cifras` (
	`id` text PRIMARY KEY NOT NULL,
	`peticion_id` text NOT NULL,
	`cod_grupo` text NOT NULL,
	`cifras` text,
	`estado` text DEFAULT 'pendiente' NOT NULL,
	`intentos` integer DEFAULT 0 NOT NULL,
	`aviso` text DEFAULT '' NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`peticion_id`) REFERENCES `rfgf_anteriores_peticiones`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cod_grupo`) REFERENCES `rfgf_anteriores_grupo`(`cod_grupo`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "anteriores_cifras_estado_ck" CHECK("estado" in ('pendiente', 'leido', 'sin_datos', 'sin_club', 'error'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `anteriores_cifras_idx` ON `rfgf_anteriores_cifras` (`peticion_id`,`cod_grupo`);--> statement-breakpoint
CREATE TABLE `rfgf_anteriores_club` (
	`id` text PRIMARY KEY NOT NULL,
	`club_codigo` text NOT NULL,
	`temporada` text NOT NULL,
	`grupos` text,
	`estado` text DEFAULT 'pendiente' NOT NULL,
	`intentos` integer DEFAULT 0 NOT NULL,
	`aviso` text DEFAULT '' NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "anteriores_club_estado_ck" CHECK("estado" in ('pendiente', 'leido', 'sin_datos', 'sin_club', 'error'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `anteriores_club_temporada_idx` ON `rfgf_anteriores_club` (`club_codigo`,`temporada`);--> statement-breakpoint
CREATE TABLE `rfgf_anteriores_grupo` (
	`cod_grupo` text PRIMARY KEY NOT NULL,
	`temporada` text NOT NULL,
	`cod_competicion` text NOT NULL,
	`cod_acta` text,
	`jornada` integer DEFAULT 1 NOT NULL,
	`estado` text DEFAULT 'pendiente' NOT NULL,
	`intentos` integer DEFAULT 0 NOT NULL,
	`aviso` text DEFAULT '' NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "anteriores_grupo_estado_ck" CHECK("estado" in ('pendiente', 'leido', 'sin_datos', 'sin_club', 'error'))
);
--> statement-breakpoint
CREATE TABLE `rfgf_anteriores_peticiones` (
	`id` text PRIMARY KEY NOT NULL,
	`jugador_id` text NOT NULL,
	`linea` text NOT NULL,
	`temporada` text NOT NULL,
	`club` text NOT NULL,
	`codigo` text NOT NULL,
	`club_codigo` text,
	`manual` integer DEFAULT false NOT NULL,
	`candidatos` text DEFAULT '[]' NOT NULL,
	`estado` text DEFAULT 'pendiente' NOT NULL,
	`intentos` integer DEFAULT 0 NOT NULL,
	`aviso` text DEFAULT '' NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`jugador_id`) REFERENCES `jugadores`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "anteriores_peticion_estado_ck" CHECK("estado" in ('pendiente', 'leido', 'sin_datos', 'sin_club', 'error'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `anteriores_linea_idx` ON `rfgf_anteriores_peticiones` (`jugador_id`,`linea`);