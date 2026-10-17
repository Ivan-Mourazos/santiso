CREATE TABLE `rfgf_historico_eventos` (
	`id` text PRIMARY KEY NOT NULL,
	`partido_id` text NOT NULL,
	`lado` text NOT NULL,
	`persona` text NOT NULL,
	`persona_clave` text NOT NULL,
	`tipo` text NOT NULL,
	`minuto` text DEFAULT '' NOT NULL,
	`tecnico` integer DEFAULT false NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`partido_id`) REFERENCES `rfgf_historico_partidos`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "rfgf_historico_eventos_tipo_ck" CHECK("tipo" in ('gol', 'gol_propia', 'amarilla', 'doble_amarilla', 'roja')),
	CONSTRAINT "rfgf_historico_eventos_lado_ck" CHECK("lado" in ('local', 'visitante'))
);
--> statement-breakpoint
CREATE INDEX `rfgf_historico_eventos_partido_idx` ON `rfgf_historico_eventos` (`partido_id`);--> statement-breakpoint
CREATE TABLE `rfgf_historico_partidos` (
	`id` text PRIMARY KEY NOT NULL,
	`cod_grupo` text NOT NULL,
	`jornada` integer NOT NULL,
	`fecha_nominal` text NOT NULL,
	`fecha` text,
	`local` text NOT NULL,
	`visitante` text NOT NULL,
	`santiso_local` integer NOT NULL,
	`goles_local` integer,
	`goles_visitante` integer,
	`cod_acta` text,
	`codigos_en` text,
	`acta_leida_en` text,
	`resultado_en` text,
	`estado` text DEFAULT 'pendiente' NOT NULL,
	`intentos` integer DEFAULT 0 NOT NULL,
	`aviso` text DEFAULT '' NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`cod_grupo`) REFERENCES `rfgf_grupos_historicos`(`cod_grupo`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "rfgf_historico_partidos_estado_ck" CHECK("estado" in ('pendiente', 'listo', 'sin_acta', 'error')),
	CONSTRAINT "rfgf_historico_partidos_marcador_ck" CHECK((goles_local is null and goles_visitante is null) or (goles_local is not null and goles_visitante is not null and goles_local >= 0 and goles_visitante >= 0)),
	CONSTRAINT "rfgf_historico_partidos_jornada_ck" CHECK(jornada > 0 and intentos >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rfgf_historico_partidos_cruce_uq` ON `rfgf_historico_partidos` (`cod_grupo`,`jornada`,`local`,`visitante`);--> statement-breakpoint
CREATE INDEX `rfgf_historico_partidos_cola_idx` ON `rfgf_historico_partidos` (`cod_grupo`,`estado`,`actualizado_en`);--> statement-breakpoint
-- Añadido sin reconstruir grupos: conserva las referencias de rfgf_historico.
ALTER TABLE `rfgf_grupos_historicos` ADD `partidos_pedidos_en` text;--> statement-breakpoint
ALTER TABLE `rfgf_grupos_historicos` ADD `partidos_estado` text DEFAULT 'no_pedido' NOT NULL CONSTRAINT "rfgf_grupos_historicos_partidos_estado_ck" CHECK("partidos_estado" in ('no_pedido', 'en_cola', 'en_curso', 'terminado', 'no_compatible'));--> statement-breakpoint
ALTER TABLE `rfgf_grupos_historicos` ADD `partidos_aviso` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `rfgf_grupos_historicos` ADD `partidos_calendario_en` text;--> statement-breakpoint
ALTER TABLE `rfgf_grupos_historicos` ADD `partidos_intentos` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `rfgf_grupos_historicos` ADD `partidos_actualizado_en` text;
