CREATE TABLE `campos` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`clave` text NOT NULL,
	`poblacion` text,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `campos_clave_unique` ON `campos` (`clave`);--> statement-breakpoint
CREATE TABLE `jornada_descansos` (
	`jornada_id` text NOT NULL,
	`equipo_id` text NOT NULL,
	PRIMARY KEY(`jornada_id`, `equipo_id`),
	FOREIGN KEY (`jornada_id`) REFERENCES `jornadas`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`equipo_id`) REFERENCES `equipos`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `jornada_descansos_equipo_idx` ON `jornada_descansos` (`equipo_id`);--> statement-breakpoint
CREATE TABLE `jornadas` (
	`id` text PRIMARY KEY NOT NULL,
	`competicion_id` text NOT NULL,
	`numero` integer NOT NULL,
	`nombre_fase` text,
	`fecha_inicio` text,
	`fecha_fin` text,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`competicion_id`) REFERENCES `competiciones`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "jornadas_numero_ck" CHECK("numero" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jornadas_competicion_numero_uq` ON `jornadas` (`competicion_id`,`numero`);--> statement-breakpoint
CREATE TABLE `partidos` (
	`id` text PRIMARY KEY NOT NULL,
	`jornada_id` text NOT NULL,
	`equipo_local_id` text NOT NULL,
	`equipo_visitante_id` text NOT NULL,
	`goles_local` integer,
	`goles_visitante` integer,
	`estado` text DEFAULT 'programado' NOT NULL,
	`fecha` text,
	`campo_id` text,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`jornada_id`) REFERENCES `jornadas`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`equipo_local_id`) REFERENCES `equipos`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`equipo_visitante_id`) REFERENCES `equipos`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`campo_id`) REFERENCES `campos`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "partidos_estado_ck" CHECK("estado" in ('programado', 'en_juego', 'finalizado', 'aplazado', 'cancelado')),
	CONSTRAINT "partidos_equipos_distintos_ck" CHECK("equipo_local_id" <> "equipo_visitante_id"),
	CONSTRAINT "partidos_marcador_completo_ck" CHECK(("goles_local" is null) = ("goles_visitante" is null)),
	CONSTRAINT "partidos_goles_no_negativos_ck" CHECK(coalesce("goles_local", 0) >= 0 and coalesce("goles_visitante", 0) >= 0),
	CONSTRAINT "partidos_finalizado_con_marcador_ck" CHECK("estado" <> 'finalizado' or "goles_local" is not null)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `partidos_jornada_cruce_uq` ON `partidos` (`jornada_id`,`equipo_local_id`,`equipo_visitante_id`);--> statement-breakpoint
CREATE INDEX `partidos_fecha_idx` ON `partidos` (`fecha`);--> statement-breakpoint
CREATE INDEX `partidos_local_idx` ON `partidos` (`equipo_local_id`);--> statement-breakpoint
CREATE INDEX `partidos_visitante_idx` ON `partidos` (`equipo_visitante_id`);--> statement-breakpoint
CREATE TABLE `ajustes` (
	`id` text PRIMARY KEY NOT NULL,
	`valor` text NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `patrocinadores` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`clave` text NOT NULL,
	`logo` text,
	`web_url` text,
	`orden` integer DEFAULT 0 NOT NULL,
	`en_carteles` integer DEFAULT false NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `patrocinadores_clave_unique` ON `patrocinadores` (`clave`);--> statement-breakpoint
CREATE TABLE `clasificacion_ajustes` (
	`id` text PRIMARY KEY NOT NULL,
	`competicion_id` text NOT NULL,
	`equipo_id` text NOT NULL,
	`puntos` integer NOT NULL,
	`motivo` text NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`competicion_id`) REFERENCES `competiciones`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`equipo_id`) REFERENCES `equipos`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "clasificacion_ajustes_puntos_ck" CHECK("puntos" <> 0)
);
--> statement-breakpoint
CREATE INDEX `clasificacion_ajustes_competicion_idx` ON `clasificacion_ajustes` (`competicion_id`);--> statement-breakpoint
CREATE TABLE `competicion_alias` (
	`competicion_id` text NOT NULL,
	`alias` text NOT NULL,
	`clave` text NOT NULL,
	PRIMARY KEY(`competicion_id`, `clave`),
	FOREIGN KEY (`competicion_id`) REFERENCES `competiciones`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `competicion_equipos` (
	`competicion_id` text NOT NULL,
	`equipo_id` text NOT NULL,
	PRIMARY KEY(`competicion_id`, `equipo_id`),
	FOREIGN KEY (`competicion_id`) REFERENCES `competiciones`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`equipo_id`) REFERENCES `equipos`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `competicion_equipos_equipo_idx` ON `competicion_equipos` (`equipo_id`);--> statement-breakpoint
CREATE TABLE `competiciones` (
	`id` text PRIMARY KEY NOT NULL,
	`temporada_id` text NOT NULL,
	`categoria` text NOT NULL,
	`nombre` text NOT NULL,
	`formato` text DEFAULT 'liga' NOT NULL,
	`orden` integer DEFAULT 0 NOT NULL,
	`reglas_clasificacion` text DEFAULT '[]' NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`temporada_id`) REFERENCES `temporadas`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "competiciones_categoria_ck" CHECK("categoria" in ('Senior', 'Femenino', 'Veteranos')),
	CONSTRAINT "competiciones_formato_ck" CHECK("formato" in ('liga', 'eliminatoria'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `competiciones_temporada_categoria_nombre_uq` ON `competiciones` (`temporada_id`,`categoria`,`nombre`);--> statement-breakpoint
CREATE TABLE `temporadas` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`activa` integer DEFAULT false NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `temporadas_nombre_unique` ON `temporadas` (`nombre`);--> statement-breakpoint
CREATE UNIQUE INDEX `temporadas_una_activa_uq` ON `temporadas` (`activa`) WHERE "activa" = 1;--> statement-breakpoint
CREATE TABLE `partido_eventos` (
	`id` text PRIMARY KEY NOT NULL,
	`partido_id` text NOT NULL,
	`tipo` text NOT NULL,
	`lado` text NOT NULL,
	`propia` integer DEFAULT false NOT NULL,
	`minuto` integer,
	`jugador_id` text,
	`jugador_sale_id` text,
	`nombre_rival` text,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`partido_id`) REFERENCES `partidos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`jugador_id`) REFERENCES `jugadores`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`jugador_sale_id`) REFERENCES `jugadores`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "partido_eventos_tipo_ck" CHECK("tipo" in ('gol', 'tarjeta_amarilla', 'tarjeta_roja', 'cambio')),
	CONSTRAINT "partido_eventos_lado_ck" CHECK("lado" in ('propio', 'rival')),
	CONSTRAINT "partido_eventos_propia_solo_gol_ck" CHECK(not "propia" or "tipo" = 'gol'),
	CONSTRAINT "partido_eventos_cambio_ck" CHECK("tipo" <> 'cambio' or ("lado" = 'propio' and "jugador_id" is not null and "jugador_sale_id" is not null)),
	CONSTRAINT "partido_eventos_minuto_ck" CHECK("minuto" is null or "minuto" between 0 and 130)
);
--> statement-breakpoint
CREATE INDEX `partido_eventos_partido_minuto_idx` ON `partido_eventos` (`partido_id`,`minuto`);--> statement-breakpoint
CREATE TABLE `partido_participaciones` (
	`partido_id` text NOT NULL,
	`jugador_id` text NOT NULL,
	`titular` integer DEFAULT false NOT NULL,
	`jugo` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`partido_id`, `jugador_id`),
	FOREIGN KEY (`partido_id`) REFERENCES `partidos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`jugador_id`) REFERENCES `jugadores`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "partido_participaciones_titular_jugo_ck" CHECK(not "titular" or "jugo")
);
--> statement-breakpoint
CREATE INDEX `partido_participaciones_jugador_idx` ON `partido_participaciones` (`jugador_id`);--> statement-breakpoint
CREATE TABLE `equipos` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`clave` text NOT NULL,
	`categoria` text NOT NULL,
	`es_propio` integer DEFAULT false NOT NULL,
	`escudo` text,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "equipos_categoria_ck" CHECK("categoria" in ('Senior', 'Femenino', 'Veteranos'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `equipos_categoria_clave_uq` ON `equipos` (`categoria`,`clave`);--> statement-breakpoint
CREATE TABLE `jugadores` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`apodo` text,
	`dorsal` integer,
	`posicion` text,
	`posiciones_conocidas` text DEFAULT '[]' NOT NULL,
	`capitania` integer,
	`categoria` text NOT NULL,
	`foto` text,
	`fecha_nacimiento` text,
	`historial` text DEFAULT '[]' NOT NULL,
	`compromiso` integer,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "jugadores_categoria_ck" CHECK("categoria" in ('Senior', 'Femenino', 'Veteranos')),
	CONSTRAINT "jugadores_posicion_ck" CHECK("posicion" in ('POR', 'LD', 'DFC', 'LI', 'MCD', 'MC', 'MCO', 'MD', 'MI', 'ED', 'EI', 'DC')),
	CONSTRAINT "jugadores_capitania_ck" CHECK("capitania" is null or "capitania" > 0)
);
--> statement-breakpoint
CREATE INDEX `jugadores_categoria_dorsal_idx` ON `jugadores` (`categoria`,`dorsal`);--> statement-breakpoint
CREATE TABLE `staff` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`cargo` text NOT NULL,
	`tipo` text NOT NULL,
	`categoria` text,
	`foto` text,
	`orden` integer DEFAULT 0 NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "staff_tipo_ck" CHECK("tipo" in ('tecnico', 'directiva')),
	CONSTRAINT "staff_categoria_ck" CHECK("categoria" in ('Senior', 'Femenino', 'Veteranos')),
	CONSTRAINT "staff_categoria_segun_tipo_ck" CHECK(("tipo" = 'directiva' and "categoria" is null) or ("tipo" = 'tecnico' and "categoria" is not null))
);
