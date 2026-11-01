import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { checkEnum, marcasTiempo } from "./comunes";
import { rfgfGruposHistoricos } from "./rfgf";

/** Misma forma de FilaOficial, sin acoplar la base al lector de PDF. */
export interface FilaClasificacionHistorica {
  posicion: number;
  equipo: string;
  puntos: number;
  jugados: number;
  ganados: number;
  empatados: number;
  perdidos: number;
  golesFavor: number;
  golesContra: number;
  sancion: number;
}
export const ESTADOS_CLASIFICACION_HISTORICA = [
  "pendiente",
  "leido",
  "sin_datos",
  "error",
] as const;
export const rfgfHistoricoClasificaciones = sqliteTable(
  "rfgf_historico_clasificaciones",
  {
    codGrupo: text("cod_grupo")
      .primaryKey()
      .references(() => rfgfGruposHistoricos.codGrupo, { onDelete: "cascade" }),
    formato: text("formato", { enum: ["liga", "copa"] }),
    jornada: integer("jornada"),
    filas: text("filas", { mode: "json" }).$type<FilaClasificacionHistorica[]>(),
    ronda: text("ronda"),
    estado: text("estado", { enum: ESTADOS_CLASIFICACION_HISTORICA })
      .notNull()
      .default("pendiente"),
    /** Fallos de red consecutivos de la página pendiente. */
    intentos: integer("intentos").notNull().default(0),
    /** Clasificaciones válidas pero vacías, en jornadas descendentes. */
    vacias: integer("vacias").notNull().default(0),
    aviso: text("aviso").notNull().default(""),
    ...marcasTiempo(),
  },
  () => [
    checkEnum("historico_clasificaciones_estado_ck", "estado", ESTADOS_CLASIFICACION_HISTORICA),
    checkEnum("historico_clasificaciones_formato_ck", "formato", ["liga", "copa"]),
  ],
);
