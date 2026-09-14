import { ESTADOS_PARTIDO } from "@santiso/domain";
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
import { competiciones } from "./competicion";
import { equipos } from "./plantilla";

export const campos = sqliteTable("campos", {
  id: id(),
  nombre: text("nombre").notNull(),
  clave: text("clave").notNull().unique(),
  poblacion: text("poblacion"),
  ...marcasTiempo(),
});

export const jornadas = sqliteTable(
  "jornadas",
  {
    id: id(),
    competicionId: text("competicion_id")
      .notNull()
      .references(() => competiciones.id, { onDelete: "cascade" }),
    numero: integer("numero").notNull(),
    /** Solo eliminatorias: "Semifinal", "Final"… */
    nombreFase: text("nombre_fase"),
    /** "YYYY-MM-DD". */
    fechaInicio: text("fecha_inicio"),
    fechaFin: text("fecha_fin"),
    ...marcasTiempo(),
  },
  (t) => [
    uniqueIndex("jornadas_competicion_numero_uq").on(t.competicionId, t.numero),
    check("jornadas_numero_ck", condicion(`"numero" > 0`)),
  ],
);

export const jornadaDescansos = sqliteTable(
  "jornada_descansos",
  {
    jornadaId: text("jornada_id")
      .notNull()
      .references(() => jornadas.id, { onDelete: "cascade" }),
    equipoId: text("equipo_id")
      .notNull()
      .references(() => equipos.id, { onDelete: "restrict" }),
  },
  (t) => [
    primaryKey({ columns: [t.jornadaId, t.equipoId] }),
    index("jornada_descansos_equipo_idx").on(t.equipoId),
  ],
);

export const partidos = sqliteTable(
  "partidos",
  {
    id: id(),
    jornadaId: text("jornada_id")
      .notNull()
      .references(() => jornadas.id, { onDelete: "cascade" }),
    equipoLocalId: text("equipo_local_id")
      .notNull()
      .references(() => equipos.id, { onDelete: "restrict" }),
    equipoVisitanteId: text("equipo_visitante_id")
      .notNull()
      .references(() => equipos.id, { onDelete: "restrict" }),
    golesLocal: integer("goles_local"),
    golesVisitante: integer("goles_visitante"),
    estado: text("estado", { enum: ESTADOS_PARTIDO }).notNull().default("programado"),
    /** Hora local de pared "YYYY-MM-DDTHH:mm", sin zona. */
    fecha: text("fecha"),
    campoId: text("campo_id").references(() => campos.id, { onDelete: "set null" }),
    ...marcasTiempo(),
  },
  (t) => [
    uniqueIndex("partidos_jornada_cruce_uq").on(t.jornadaId, t.equipoLocalId, t.equipoVisitanteId),
    index("partidos_fecha_idx").on(t.fecha),
    index("partidos_local_idx").on(t.equipoLocalId),
    index("partidos_visitante_idx").on(t.equipoVisitanteId),
    checkEnum("partidos_estado_ck", "estado", ESTADOS_PARTIDO),
    check("partidos_equipos_distintos_ck", condicion(`"equipo_local_id" <> "equipo_visitante_id"`)),
    check(
      "partidos_marcador_completo_ck",
      condicion(`("goles_local" is null) = ("goles_visitante" is null)`),
    ),
    check(
      "partidos_goles_no_negativos_ck",
      condicion(`coalesce("goles_local", 0) >= 0 and coalesce("goles_visitante", 0) >= 0`),
    ),
    check(
      "partidos_finalizado_con_marcador_ck",
      condicion(`"estado" <> 'finalizado' or "goles_local" is not null`),
    ),
  ],
);
