import { index, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { partidos } from "./calendario";
import { marcasTiempo } from "./comunes";
import { jugadores } from "./plantilla";

/** Convocatoria privada del grupo, independiente del acta y de la alineación. */
export const partidoConvocatorias = sqliteTable("partido_convocatorias", {
  partidoId: text("partido_id")
    .primaryKey()
    .references(() => partidos.id, { onDelete: "cascade" }),
  horaQuedada: text("hora_quedada").notNull().default(""),
  lugarQuedada: text("lugar_quedada").notNull().default(""),
  equipacion: text("equipacion").notNull().default(""),
  nota: text("nota").notNull().default(""),
  ...marcasTiempo(),
});

export const partidoConvocados = sqliteTable(
  "partido_convocados",
  {
    partidoId: text("partido_id")
      .notNull()
      .references(() => partidoConvocatorias.partidoId, { onDelete: "cascade" }),
    jugadorId: text("jugador_id")
      .notNull()
      .references(() => jugadores.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.partidoId, t.jugadorId] }),
    index("partido_convocados_jugador_idx").on(t.jugadorId),
  ],
);
