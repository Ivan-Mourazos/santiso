import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { partidos } from "./calendario";
import { checkEnum, marcasTiempo } from "./comunes";
import { competiciones } from "./competicion";

/** Qué pasó con un acta de la federación al traerla. */
export const ESTADOS_ACTA_RFGF = ["resultado", "guardada", "revisar", "error"] as const;
export type EstadoActaRfgf = (typeof ESTADOS_ACTA_RFGF)[number];

/**
 * Sincronización con la web de la federación (futgal.es). Cada competición guarda el enlace de
 * su calendario y cuándo se miró por última vez.
 */
export const rfgfCompeticiones = sqliteTable("rfgf_competiciones", {
  competicionId: text("competicion_id")
    .primaryKey()
    .references(() => competiciones.id, { onDelete: "cascade" }),
  /** El enlace tal como lo pegó el usuario. */
  enlace: text("enlace").notNull(),
  /** Última comprobación, ISO. */
  comprobadoEn: text("comprobado_en"),
  /** Resumen de esa comprobación, para enseñarlo. Vacío si no hubo novedad. */
  resumen: text("resumen").notNull().default(""),
  ...marcasTiempo(),
});

/**
 * Un acta de la federación ya tratada. Evita volver a descargarla y deja constancia de qué se
 * hizo: solo el resultado (partido ajeno), el acta completa, o por qué hay que revisarla.
 */
export const rfgfActas = sqliteTable(
  "rfgf_actas",
  {
    /** Código del acta en la federación. */
    codActa: text("cod_acta").primaryKey(),
    competicionId: text("competicion_id")
      .notNull()
      .references(() => competiciones.id, { onDelete: "cascade" }),
    partidoId: text("partido_id").references(() => partidos.id, { onDelete: "set null" }),
    estado: text("estado", { enum: ESTADOS_ACTA_RFGF }).notNull(),
    /** Qué se guardó o qué falló, en una frase. */
    detalle: text("detalle").notNull().default(""),
    ...marcasTiempo(),
  },
  (t) => [
    index("rfgf_actas_competicion_idx").on(t.competicionId),
    index("rfgf_actas_partido_idx").on(t.partidoId),
    checkEnum("rfgf_actas_estado_ck", "estado", ESTADOS_ACTA_RFGF),
  ],
);
