CREATE TABLE `rfgf_grupos_historicos` (
	`cod_grupo` text PRIMARY KEY NOT NULL,
	`categoria` text NOT NULL,
	`temporada` text NOT NULL,
	`competicion` text NOT NULL,
	`grupo` text NOT NULL,
	`cod_competicion` text NOT NULL,
	`cod_equipo` text NOT NULL,
	`cod_acta` text,
	`estado` text DEFAULT 'pendiente' NOT NULL,
	`intentos` integer DEFAULT 0 NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "rfgf_grupos_historicos_estado_ck" CHECK("estado" in ('pendiente', 'listo', 'sin_acta'))
);
--> statement-breakpoint
CREATE TABLE `rfgf_historico` (
	`jugador_id` text NOT NULL,
	`cod_grupo` text NOT NULL,
	`codigo` text NOT NULL,
	`cifras` text,
	`leido_en` text,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`jugador_id`, `cod_grupo`),
	FOREIGN KEY (`jugador_id`) REFERENCES `jugadores`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cod_grupo`) REFERENCES `rfgf_grupos_historicos`(`cod_grupo`) ON UPDATE no action ON DELETE cascade
);
