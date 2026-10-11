CREATE TABLE `rfgf_actas` (
	`cod_acta` text PRIMARY KEY NOT NULL,
	`competicion_id` text NOT NULL,
	`partido_id` text,
	`estado` text NOT NULL,
	`detalle` text DEFAULT '' NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`competicion_id`) REFERENCES `competiciones`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`partido_id`) REFERENCES `partidos`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "rfgf_actas_estado_ck" CHECK("estado" in ('resultado', 'guardada', 'revisar', 'error'))
);
--> statement-breakpoint
CREATE INDEX `rfgf_actas_competicion_idx` ON `rfgf_actas` (`competicion_id`);--> statement-breakpoint
CREATE INDEX `rfgf_actas_partido_idx` ON `rfgf_actas` (`partido_id`);--> statement-breakpoint
CREATE TABLE `rfgf_competiciones` (
	`competicion_id` text PRIMARY KEY NOT NULL,
	`enlace` text NOT NULL,
	`comprobado_en` text,
	`resumen` text DEFAULT '' NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`competicion_id`) REFERENCES `competiciones`(`id`) ON UPDATE no action ON DELETE cascade
);
