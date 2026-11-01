import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { checkEnum, id, marcasTiempo } from "./comunes";

import { jugadores } from "./plantilla";

import type { rfgfHistorico } from "./rfgf";

export const ESTADOS_ANTERIORES = ["pendiente", "leido", "sin_datos", "sin_club", "error"] as const;

const progreso = () => ({
  estado: text("estado", { enum: ESTADOS_ANTERIORES }).notNull().default("pendiente"),

  intentos: integer("intentos").notNull().default(0),

  aviso: text("aviso").notNull().default(""),
});

export interface GrupoAnterior {
  codEquipo?: string;
  equipo?: string;
  codGrupo: string;
  codCompeticion: string;
  competicion: string;
  grupo: string;
}

/** Caché compartida de una única página por club y temporada. */

export const rfgfAnterioresClub = sqliteTable(
  "rfgf_anteriores_club",
  {
    id: text("id").primaryKey(),
    clubCodigo: text("club_codigo").notNull(),
    temporada: text("temporada").notNull(),

    grupos: text("grupos", { mode: "json" }).$type<GrupoAnterior[]>(),
    ...progreso(),
    ...marcasTiempo(),
  },
  (t) => [
    uniqueIndex("anteriores_club_temporada_idx").on(t.clubCodigo, t.temporada),
    checkEnum("anteriores_club_estado_ck", "estado", ESTADOS_ANTERIORES),
  ],
);

export const rfgfAnterioresGrupo = sqliteTable(
  "rfgf_anteriores_grupo",
  {
    codGrupo: text("cod_grupo").primaryKey(),
    temporada: text("temporada").notNull(),
    codCompeticion: text("cod_competicion").notNull(),

    partidos: text("partidos", { mode: "json" }).$type<
      {
        codLocal: string;
        local: string;
        codVisitante: string;
        visitante: string;
        codActa: string;
      }[]
    >(),
    codActa: text("cod_acta"),
    jornada: integer("jornada").notNull().default(1),
    ...progreso(),
    ...marcasTiempo(),
  },
  () => [checkEnum("anteriores_grupo_estado_ck", "estado", ESTADOS_ANTERIORES)],
);

export const rfgfAnterioresPeticiones = sqliteTable(
  "rfgf_anteriores_peticiones",
  {
    id: id(),
    jugadorId: text("jugador_id")
      .notNull()
      .references(() => jugadores.id, { onDelete: "cascade" }),

    linea: text("linea").notNull(),
    temporada: text("temporada").notNull(),
    club: text("club").notNull(),

    codigo: text("codigo").notNull(),
    clubCodigo: text("club_codigo"),
    equipoCodigo: text("equipo_codigo"),
    manual: integer("manual", { mode: "boolean" }).notNull().default(false),

    candidatos: text("candidatos", { mode: "json" }).$type<string[]>().notNull().default([]),
    ...progreso(),
    ...marcasTiempo(),
  },
  (t) => [
    uniqueIndex("anteriores_linea_idx").on(t.jugadorId, t.linea),
    checkEnum("anteriores_peticion_estado_ck", "estado", ESTADOS_ANTERIORES),
  ],
);

export const rfgfAnterioresCifras = sqliteTable(
  "rfgf_anteriores_cifras",
  {
    id: id(),
    peticionId: text("peticion_id")
      .notNull()
      .references(() => rfgfAnterioresPeticiones.id, { onDelete: "cascade" }),

    codGrupo: text("cod_grupo")
      .notNull()
      .references(() => rfgfAnterioresGrupo.codGrupo),

    equipo: text("equipo"),
    codEquipo: text("cod_equipo"),
    cifras: text("cifras", { mode: "json" }).$type<typeof rfgfHistorico.$inferSelect.cifras>(),

    ...progreso(),
    ...marcasTiempo(),
  },
  (t) => [
    uniqueIndex("anteriores_cifras_idx").on(t.peticionId, t.codGrupo),
    checkEnum("anteriores_cifras_estado_ck", "estado", ESTADOS_ANTERIORES),
  ],
);

/** Todas las temporadas en una sola página por equipo. */
export const rfgfAnterioresEquipo = sqliteTable(
  "rfgf_anteriores_equipo",
  {
    codigo: text("codigo").primaryKey(),
    grupos: text("grupos", { mode: "json" }).$type<(GrupoAnterior & { temporada: string })[]>(),
    ...progreso(),
    ...marcasTiempo(),
  },
  () => [checkEnum("anteriores_equipo_estado_ck", "estado", ESTADOS_ANTERIORES)],
);
