CREATE TABLE `jugadores_temporada` (
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
	CONSTRAINT "jugadores_temporada_categoria_ck" CHECK("categoria" in ('Senior', 'Femenino', 'Veteranos')),
	CONSTRAINT "jugadores_temporada_posicion_ck" CHECK("posicion" in ('POR', 'LD', 'DFC', 'LI', 'MCD', 'MC', 'MCO', 'MD', 'MI', 'ED', 'EI', 'DC')),
	CONSTRAINT "jugadores_temporada_capitania_ck" CHECK("capitania" is null or "capitania" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jugadores_temporada_uq` ON `jugadores_temporada` (`temporada_id`,`categoria`,`jugador_id`);--> statement-breakpoint
CREATE INDEX `jugadores_temporada_dorsal_idx` ON `jugadores_temporada` (`temporada_id`,`categoria`,`dorsal`);--> statement-breakpoint
CREATE INDEX `jugadores_temporada_jugador_idx` ON `jugadores_temporada` (`jugador_id`);--> statement-breakpoint
CREATE TABLE `staff_temporada` (
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
	CONSTRAINT "staff_temporada_categoria_ck" CHECK("categoria" in ('Senior', 'Femenino', 'Veteranos')),
	CONSTRAINT "staff_temporada_categoria_segun_tipo_ck" CHECK(("tipo" = 'directiva' and "categoria" is null) or ("tipo" = 'tecnico' and "categoria" is not null))
);
--> statement-breakpoint
CREATE INDEX `staff_temporada_temporada_idx` ON `staff_temporada` (`temporada_id`,`tipo`,`categoria`);--> statement-breakpoint
CREATE INDEX `staff_temporada_staff_idx` ON `staff_temporada` (`staff_id`);--> statement-breakpoint
-- ─── Traspaso de datos (escrito a mano, no generado) ─────────────────────────────────────
-- Hasta aquí `jugadores` y `staff` conservan sus columnas viejas. Se copian a las inscripciones
-- por temporada ANTES de reconstruir esas tablas. Toda la migración corre dentro de
-- `client.migrate` de libSQL, con las claves foráneas desactivadas y en una sola transacción:
-- el DROP TABLE de más abajo no borra en cascada, y si algo falla no se aplica nada.
--
-- Jugadores: a la última temporada en la que tienen convocatoria; sin ninguna, a la activa.
INSERT INTO `jugadores_temporada` ("id", "temporada_id", "jugador_id", "categoria", "dorsal", "posicion", "capitania", "foto")
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))), destino.temporada_id, j.id, j.categoria, j.dorsal, j.posicion, j.capitania, j.foto
FROM `jugadores` j
JOIN (
  SELECT j2.id AS jugador_id, coalesce(
    (SELECT t.id
       FROM `partido_participaciones` pp
       JOIN `partidos` p ON p.id = pp.partido_id
       JOIN `jornadas` jo ON jo.id = p.jornada_id
       JOIN `competiciones` c ON c.id = jo.competicion_id
       JOIN `temporadas` t ON t.id = c.temporada_id
      WHERE pp.jugador_id = j2.id
      ORDER BY t.nombre DESC
      LIMIT 1),
    (SELECT id FROM `temporadas` WHERE activa = 1)
  ) AS temporada_id
  FROM `jugadores` j2
) destino ON destino.jugador_id = j.id
WHERE destino.temporada_id IS NOT NULL;--> statement-breakpoint
-- Staff: no tiene convocatorias. Va a la temporada anterior a la activa (por nombre:
-- "2025/26" < "2026/27"); si no la hay, a la activa. En la base de datos real, a 2025/26,
-- que es cuando se dio de alta.
INSERT INTO `staff_temporada` ("id", "temporada_id", "staff_id", "tipo", "categoria", "cargo", "orden", "foto")
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))), destino.temporada_id, s.id, s.tipo, s.categoria, s.cargo, s.orden, s.foto
FROM `staff` s
JOIN (
  SELECT coalesce(
    (SELECT id FROM `temporadas`
      WHERE nombre < (SELECT nombre FROM `temporadas` WHERE activa = 1)
      ORDER BY nombre DESC
      LIMIT 1),
    (SELECT id FROM `temporadas` WHERE activa = 1)
  ) AS temporada_id
) destino
WHERE destino.temporada_id IS NOT NULL;--> statement-breakpoint
-- ─── Fin del traspaso ──────────────────────────────────────────────────────────────────────
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_jugadores` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`apodo` text,
	`posiciones_conocidas` text DEFAULT '[]' NOT NULL,
	`fecha_nacimiento` text,
	`historial` text DEFAULT '[]' NOT NULL,
	`compromiso` integer,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_jugadores`("id", "nombre", "apodo", "posiciones_conocidas", "fecha_nacimiento", "historial", "compromiso", "creado_en", "actualizado_en") SELECT "id", "nombre", "apodo", "posiciones_conocidas", "fecha_nacimiento", "historial", "compromiso", "creado_en", "actualizado_en" FROM `jugadores`;--> statement-breakpoint
DROP TABLE `jugadores`;--> statement-breakpoint
ALTER TABLE `__new_jugadores` RENAME TO `jugadores`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_staff` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_staff`("id", "nombre", "creado_en", "actualizado_en") SELECT "id", "nombre", "creado_en", "actualizado_en" FROM `staff`;--> statement-breakpoint
DROP TABLE `staff`;--> statement-breakpoint
ALTER TABLE `__new_staff` RENAME TO `staff`;