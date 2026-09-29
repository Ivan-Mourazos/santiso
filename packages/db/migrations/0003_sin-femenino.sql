PRAGMA foreign_keys=OFF;--> statement-breakpoint
-- El club ya no tiene equipo femenino. Solo quedaba su ficha de equipo del año pasado; cualquier
-- otra fila femenina hace fallar los INSERT de abajo y la migración no se aplica.
DELETE FROM `equipos` WHERE `categoria` = 'Femenino' AND `es_propio` = 1;--> statement-breakpoint
CREATE TABLE `__new_competiciones` (
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
	CONSTRAINT "competiciones_categoria_ck" CHECK("categoria" in ('Senior', 'Veteranos')),
	CONSTRAINT "competiciones_formato_ck" CHECK("formato" in ('liga', 'eliminatoria'))
);
--> statement-breakpoint
INSERT INTO `__new_competiciones`("id", "temporada_id", "categoria", "nombre", "formato", "orden", "reglas_clasificacion", "creado_en", "actualizado_en") SELECT "id", "temporada_id", "categoria", "nombre", "formato", "orden", "reglas_clasificacion", "creado_en", "actualizado_en" FROM `competiciones`;--> statement-breakpoint
DROP TABLE `competiciones`;--> statement-breakpoint
ALTER TABLE `__new_competiciones` RENAME TO `competiciones`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `competiciones_temporada_categoria_nombre_uq` ON `competiciones` (`temporada_id`,`categoria`,`nombre`);--> statement-breakpoint
CREATE TABLE `__new_equipos` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`clave` text NOT NULL,
	`categoria` text NOT NULL,
	`es_propio` integer DEFAULT false NOT NULL,
	`escudo` text,
	`escudo_3d` integer DEFAULT false NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "equipos_categoria_ck" CHECK("categoria" in ('Senior', 'Veteranos'))
);
--> statement-breakpoint
INSERT INTO `__new_equipos`("id", "nombre", "clave", "categoria", "es_propio", "escudo", "escudo_3d", "creado_en", "actualizado_en") SELECT "id", "nombre", "clave", "categoria", "es_propio", "escudo", "escudo_3d", "creado_en", "actualizado_en" FROM `equipos`;--> statement-breakpoint
DROP TABLE `equipos`;--> statement-breakpoint
ALTER TABLE `__new_equipos` RENAME TO `equipos`;--> statement-breakpoint
CREATE UNIQUE INDEX `equipos_categoria_clave_uq` ON `equipos` (`categoria`,`clave`);--> statement-breakpoint
CREATE TABLE `__new_jugadores_temporada` (
	`id` text PRIMARY KEY NOT NULL,
	`temporada_id` text NOT NULL,
	`jugador_id` text NOT NULL,
	`categoria` text NOT NULL,
	`dorsal` integer,
	`posicion` text,
	`capitania` integer,
	`foto` text,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`temporada_id`) REFERENCES `temporadas`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`jugador_id`) REFERENCES `jugadores`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "jugadores_temporada_categoria_ck" CHECK("categoria" in ('Senior', 'Veteranos')),
	CONSTRAINT "jugadores_temporada_posicion_ck" CHECK("posicion" in ('POR', 'LD', 'DFC', 'LI', 'MCD', 'MC', 'MCO', 'MD', 'MI', 'ED', 'EI', 'DC')),
	CONSTRAINT "jugadores_temporada_capitania_ck" CHECK("capitania" is null or "capitania" > 0)
);
--> statement-breakpoint
INSERT INTO `__new_jugadores_temporada`("id", "temporada_id", "jugador_id", "categoria", "dorsal", "posicion", "capitania", "foto", "creado_en", "actualizado_en") SELECT "id", "temporada_id", "jugador_id", "categoria", "dorsal", "posicion", "capitania", "foto", "creado_en", "actualizado_en" FROM `jugadores_temporada`;--> statement-breakpoint
DROP TABLE `jugadores_temporada`;--> statement-breakpoint
ALTER TABLE `__new_jugadores_temporada` RENAME TO `jugadores_temporada`;--> statement-breakpoint
CREATE UNIQUE INDEX `jugadores_temporada_uq` ON `jugadores_temporada` (`temporada_id`,`categoria`,`jugador_id`);--> statement-breakpoint
CREATE INDEX `jugadores_temporada_dorsal_idx` ON `jugadores_temporada` (`temporada_id`,`categoria`,`dorsal`);--> statement-breakpoint
CREATE INDEX `jugadores_temporada_jugador_idx` ON `jugadores_temporada` (`jugador_id`);--> statement-breakpoint
CREATE TABLE `__new_staff_temporada` (
	`id` text PRIMARY KEY NOT NULL,
	`temporada_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`tipo` text NOT NULL,
	`categoria` text,
	`cargo` text NOT NULL,
	`orden` integer DEFAULT 0 NOT NULL,
	`foto` text,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`temporada_id`) REFERENCES `temporadas`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "staff_temporada_tipo_ck" CHECK("tipo" in ('tecnico', 'directiva')),
	CONSTRAINT "staff_temporada_categoria_ck" CHECK("categoria" in ('Senior', 'Veteranos')),
	CONSTRAINT "staff_temporada_categoria_segun_tipo_ck" CHECK(("tipo" = 'directiva' and "categoria" is null) or ("tipo" = 'tecnico' and "categoria" is not null))
);
--> statement-breakpoint
INSERT INTO `__new_staff_temporada`("id", "temporada_id", "staff_id", "tipo", "categoria", "cargo", "orden", "foto", "creado_en", "actualizado_en") SELECT "id", "temporada_id", "staff_id", "tipo", "categoria", "cargo", "orden", "foto", "creado_en", "actualizado_en" FROM `staff_temporada`;--> statement-breakpoint
DROP TABLE `staff_temporada`;--> statement-breakpoint
ALTER TABLE `__new_staff_temporada` RENAME TO `staff_temporada`;--> statement-breakpoint
CREATE INDEX `staff_temporada_temporada_idx` ON `staff_temporada` (`temporada_id`,`tipo`,`categoria`);--> statement-breakpoint
CREATE INDEX `staff_temporada_staff_idx` ON `staff_temporada` (`staff_id`);