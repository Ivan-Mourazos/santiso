import {
  DURACION_PARTE_MAX,
  DURACION_PARTE_MIN,
  ESTADOS_RELOJ,
  LADOS_EVENTO,
  MINUTO_MAXIMO,
  TIPOS_EVENTO,
} from "@santiso/domain";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { partidos } from "./calendario";
import { checkEnum, condicion, marcasTiempo } from "./comunes";
import { jugadores } from "./plantilla";

/**
 * Libreta del delegado durante el partido: apuntes personales para cerrar el acta con el árbitro.
 * Nunca alimenta el acta (`partido_eventos`) ni las estadísticas.
 * Cronómetro guardado con marcas de tiempo (epoch ms) para que el minuto no dependa del móvil.
 */
export const partidoDirecto = sqliteTable(
  "partido_directo",
  {
    partidoId: text("partido_id")
      .primaryKey()
      .references(() => partidos.id, { onDelete: "cascade" }),
    duracionParte: integer("duracion_parte").notNull().default(45),
    estado: text("estado", { enum: ESTADOS_RELOJ }).notNull().default("previo"),
    inicioParte: integer("inicio_parte"),
    pausadoMs: integer("pausado_ms").notNull().default(0),
    pausaDesde: integer("pausa_desde"),
    ...marcasTiempo(),
  },
  () => [
    checkEnum("partido_directo_estado_ck", "estado", ESTADOS_RELOJ),
    check(
      "partido_directo_duracion_ck",
      condicion(`"duracion_parte" between ${DURACION_PARTE_MIN} and ${DURACION_PARTE_MAX}`),
    ),
    check("partido_directo_pausado_ck", condicion(`"pausado_ms" >= 0`)),
  ],
);

/**
 * Lo apuntado en la libreta. `id` lo genera el móvil para que reenviar tras un corte no duplique.
 * Del rival solo se sabe el dorsal; de los nuestros, jugador y dorsal. Se admite incompleto.
 */
export const partidoDirectoEventos = sqliteTable(
  "partido_directo_eventos",
  {
    id: text("id").primaryKey(),
    partidoId: text("partido_id")
      .notNull()
      .references(() => partidos.id, { onDelete: "cascade" }),
    tipo: text("tipo", { enum: TIPOS_EVENTO }).notNull(),
    lado: text("lado", { enum: LADOS_EVENTO }).notNull(),
    propia: integer("propia", { mode: "boolean" }).notNull().default(false),
    parte: integer("parte").notNull(),
    minuto: integer("minuto"),
    jugadorId: text("jugador_id").references(() => jugadores.id, { onDelete: "set null" }),
    jugadorSaleId: text("jugador_sale_id").references(() => jugadores.id, {
      onDelete: "set null",
    }),
    dorsal: integer("dorsal"),
    dorsalSale: integer("dorsal_sale"),
    nota: text("nota").notNull().default(""),
    ...marcasTiempo(),
  },
  (t) => [
    index("partido_directo_eventos_partido_idx").on(t.partidoId, t.parte, t.minuto),
    checkEnum("partido_directo_eventos_tipo_ck", "tipo", TIPOS_EVENTO),
    checkEnum("partido_directo_eventos_lado_ck", "lado", LADOS_EVENTO),
    check("partido_directo_eventos_parte_ck", condicion(`"parte" in (1, 2)`)),
    check("partido_directo_eventos_propia_ck", condicion(`not "propia" or "tipo" = 'gol'`)),
    check(
      "partido_directo_eventos_minuto_ck",
      condicion(`"minuto" is null or "minuto" between 0 and ${MINUTO_MAXIMO}`),
    ),
    check(
      "partido_directo_eventos_dorsal_ck",
      condicion(
        `("dorsal" is null or "dorsal" >= 0) and ("dorsal_sale" is null or "dorsal_sale" >= 0)`,
      ),
    ),
  ],
);
