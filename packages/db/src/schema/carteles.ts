import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { partidos } from "./calendario";
import { checkEnum, id, marcasTiempo } from "./comunes";

export const PASOS_CARTEL_PARTIDO = [
  "partido",
  "convocatoria",
  "once",
  "resultado",
  "cronoloxia",
  "noso11",
] as const;
export type PasoCartelPartido = (typeof PASOS_CARTEL_PARTIDO)[number];
export const FORMATOS_CARTEL_PARTIDO = ["publicacion", "historia"] as const;

/** Un PNG por paso y formato; la petición permite reabrirlo sin perder los ajustes manuales. */
export const cartelesPartido = sqliteTable(
  "carteles_partido",
  {
    id: id(),
    partidoId: text("partido_id")
      .notNull()
      .references(() => partidos.id, { onDelete: "cascade" }),
    paso: text("paso", { enum: PASOS_CARTEL_PARTIDO }).notNull(),
    formato: text("formato", { enum: FORMATOS_CARTEL_PARTIDO }).notNull(),
    clave: text("clave").notNull(),
    huella: text("huella").notNull(),
    peticion: text("peticion", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    generadoEn: text("generado_en").notNull(),
    ...marcasTiempo(),
  },
  (t) => [
    uniqueIndex("carteles_partido_paso_formato_uq").on(t.partidoId, t.paso, t.formato),
    index("carteles_partido_generado_idx").on(t.generadoEn),
    checkEnum("carteles_partido_paso_ck", "paso", PASOS_CARTEL_PARTIDO),
    checkEnum("carteles_partido_formato_ck", "formato", FORMATOS_CARTEL_PARTIDO),
  ],
);
