CREATE TABLE `bote_gastos` (
	`id` text PRIMARY KEY NOT NULL,
	`temporada_id` text NOT NULL,
	`fecha` text NOT NULL,
	`concepto` text NOT NULL,
	`importe_centimos` integer NOT NULL,
	`nota` text,
	`creado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`actualizado_en` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`temporada_id`) REFERENCES `temporadas`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "bote_gastos_importe_ck" CHECK(typeof("importe_centimos") = 'integer' and "importe_centimos" > 0),
	CONSTRAINT "bote_gastos_concepto_ck" CHECK(length(trim("concepto")) > 0)
);
--> statement-breakpoint
CREATE INDEX `bote_gastos_temporada_idx` ON `bote_gastos` (`temporada_id`,`fecha`);