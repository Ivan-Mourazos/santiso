import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { partidos } from "./calendario";
import { checkEnum, condicion, id, marcasTiempo } from "./comunes";
import { equipos } from "./plantilla";

/** Lo que se apunta de cada acta para las tablas de toda la liga. */
export const TIPOS_EVENTO_LIGA = [
  "gol",
  "gol_propia",
  "amarilla",
  "doble_amarilla",
  "roja",
] as const;
export type TipoEventoLiga = (typeof TIPOS_EVENTO_LIGA)[number];

/**
 * Goles y tarjetas de todos los partidos de una competición, de todos los equipos, tal como
 * salen en las actas de la federación. Sirve para los goleadores de la liga y para saber quién
 * está apercibido o sancionado. Las personas de otros equipos no están en `jugadores` (que es
 * la plantilla del Santiso): aquí van por su nombre.
 */
export const ligaEventos = sqliteTable(
  "liga_eventos",
  {
    id: id(),
    partidoId: text("partido_id")
      .notNull()
      .references(() => partidos.id, { onDelete: "cascade" }),
    /** El equipo de la persona. En un gol en propia, el de quien lo marcó. */
    equipoId: text("equipo_id")
      .notNull()
      .references(() => equipos.id, { onDelete: "cascade" }),
    /** Nombre para enseñar: «Alejandro García Rey». */
    persona: text("persona").notNull(),
    /** El mismo nombre sin tildes, mayúsculas ni signos: para sumar a la misma persona. */
    personaClave: text("persona_clave").notNull(),
    tipo: text("tipo", { enum: TIPOS_EVENTO_LIGA }).notNull(),
    /** Minuto como lo escribe el acta («45+2»); vacío si no lo trae. */
    minuto: text("minuto").notNull().default(""),
    /** Las tarjetas a entrenadores y delegados no cuentan para los ciclos de los jugadores. */
    tecnico: integer("tecnico", { mode: "boolean" }).notNull().default(false),
    ...marcasTiempo(),
  },
  (t) => [
    index("liga_eventos_partido_idx").on(t.partidoId),
    index("liga_eventos_equipo_idx").on(t.equipoId),
    checkEnum("liga_eventos_tipo_ck", "tipo", TIPOS_EVENTO_LIGA),
  ],
);

/**
 * Quién jugó cada partido de la competición, de todos los equipos, según su acta en la
 * federación: titulares y suplentes por su nombre. Sirve para saber en qué otros equipos se ha
 * visto a un jugador del club. Se apunta al leer el acta, igual que `liga_eventos`.
 */
export const ligaAlineaciones = sqliteTable(
  "liga_alineaciones",
  {
    id: id(),
    partidoId: text("partido_id")
      .notNull()
      .references(() => partidos.id, { onDelete: "cascade" }),
    equipoId: text("equipo_id")
      .notNull()
      .references(() => equipos.id, { onDelete: "cascade" }),
    /** Nombre para enseñar, como en `liga_eventos`. */
    persona: text("persona").notNull(),
    personaClave: text("persona_clave").notNull(),
    dorsal: integer("dorsal"),
    titular: integer("titular", { mode: "boolean" }).notNull(),
    ...marcasTiempo(),
  },
  (t) => [
    index("liga_alineaciones_partido_idx").on(t.partidoId),
    index("liga_alineaciones_persona_idx").on(t.personaClave),
    check("liga_alineaciones_dorsal_ck", condicion(`"dorsal" is null or "dorsal" >= 0`)),
  ],
);
