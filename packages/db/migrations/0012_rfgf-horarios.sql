CREATE TABLE `rfgf_partidos` (
	`partido_id` text PRIMARY KEY NOT NULL,
	`fecha` text NOT NULL,
	`campo` text DEFAULT '' NOT NULL,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`partido_id`) REFERENCES `partidos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `rfgf_competiciones` ADD `horarios_en` text;