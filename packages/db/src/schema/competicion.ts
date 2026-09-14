import { CATEGORIAS, FORMATOS_COMPETICION, type ReglaClasificacion } from "@santiso/domain";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { checkEnum, condicion, id, marcasTiempo } from "./comunes";
import { equipos } from "./plantilla";

export const temporadas = sqliteTable(
  "temporadas",
  {
    id: id(),
    /** "2026/27". */
    nombre: text("nombre").notNull().unique(),
    activa: integer("activa", { mode: "boolean" }).notNull().default(false),
    ...marcasTiempo(),
  },
  (t) => [uniqueIndex("temporadas_una_activa_uq").on(t.activa).where(condicion(`"activa" = 1`))],
);

export const competiciones = sqliteTable(
  "competiciones",
  {
    id: id(),
    temporadaId: text("temporada_id")
      .notNull()
      .references(() => temporadas.id, { onDelete: "restrict" }),
    categoria: text("categoria", { enum: CATEGORIAS }).notNull(),
    nombre: text("nombre").notNull(),
    formato: text("formato", { enum: FORMATOS_COMPETICION }).notNull().default("liga"),
    orden: integer("orden").notNull().default(0),
    reglasClasificacion: text("reglas_clasificacion", { mode: "json" })
      .$type<ReglaClasificacion[]>()
      .notNull()
      .default(sql`'[]'`),
    ...marcasTiempo(),
  },
  (t) => [
    uniqueIndex("competiciones_temporada_categoria_nombre_uq").on(
      t.temporadaId,
      t.categoria,
      t.nombre,
    ),
    checkEnum("competiciones_categoria_ck", "categoria", CATEGORIAS),
    checkEnum("competiciones_formato_ck", "formato", FORMATOS_COMPETICION),
  ],
);

/** Nombres alternativos con los que aparece una competición en actas e importaciones. */
export const competicionAlias = sqliteTable(
  "competicion_alias",
  {
    competicionId: text("competicion_id")
      .notNull()
      .references(() => competiciones.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    clave: text("clave").notNull(),
  },
  (t) => [primaryKey({ columns: [t.competicionId, t.clave] })],
);

export const competicionEquipos = sqliteTable(
  "competicion_equipos",
  {
    competicionId: text("competicion_id")
      .notNull()
      .references(() => competiciones.id, { onDelete: "cascade" }),
    equipoId: text("equipo_id")
      .notNull()
      .references(() => equipos.id, { onDelete: "restrict" }),
  },
  (t) => [
    primaryKey({ columns: [t.competicionId, t.equipoId] }),
    index("competicion_equipos_equipo_idx").on(t.equipoId),
  ],
);

/** Ajustes manuales sobre la clasificación calculada (sanciones, puntos concedidos). */
export const clasificacionAjustes = sqliteTable(
  "clasificacion_ajustes",
  {
    id: id(),
    competicionId: text("competicion_id")
      .notNull()
      .references(() => competiciones.id, { onDelete: "cascade" }),
    equipoId: text("equipo_id")
      .notNull()
      .references(() => equipos.id, { onDelete: "restrict" }),
    /** Delta de puntos: negativo = sanción. */
    puntos: integer("puntos").notNull(),
    motivo: text("motivo").notNull(),
    ...marcasTiempo(),
  },
  (t) => [
    index("clasificacion_ajustes_competicion_idx").on(t.competicionId),
    check("clasificacion_ajustes_puntos_ck", condicion(`"puntos" <> 0`)),
  ],
);
