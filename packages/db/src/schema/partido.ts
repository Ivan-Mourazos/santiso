import { LADOS_EVENTO, MINUTO_MAXIMO, TIPOS_EVENTO } from "@santiso/domain";
import { check, index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { partidos } from "./calendario";
import { checkEnum, condicion, id, marcasTiempo } from "./comunes";
import { jugadores } from "./plantilla";

/** Jugadores propios convocados a un partido. Los goles se derivan de `partido_eventos`. */
export const partidoParticipaciones = sqliteTable(
  "partido_participaciones",
  {
    partidoId: text("partido_id")
      .notNull()
      .references(() => partidos.id, { onDelete: "cascade" }),
    jugadorId: text("jugador_id")
      .notNull()
      .references(() => jugadores.id, { onDelete: "restrict" }),
    titular: integer("titular", { mode: "boolean" }).notNull().default(false),
    jugo: integer("jugo", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.partidoId, t.jugadorId] }),
    index("partido_participaciones_jugador_idx").on(t.jugadorId),
    check("partido_participaciones_titular_jugo_ck", condicion(`not "titular" or "jugo"`)),
  ],
);

/**
 * Eventos del acta. `lado` = equipo al que se anota el evento.
 * Gol en propia (`propia`): lo marca un jugador del otro equipo.
 *  - lado propio + propia → `nombreRival` es el rival que marcó en su portería.
 *  - lado rival + propia → `jugadorId` es nuestro jugador que marcó en nuestra portería.
 */
export const partidoEventos = sqliteTable(
  "partido_eventos",
  {
    id: id(),
    partidoId: text("partido_id")
      .notNull()
      .references(() => partidos.id, { onDelete: "cascade" }),
    tipo: text("tipo", { enum: TIPOS_EVENTO }).notNull(),
    lado: text("lado", { enum: LADOS_EVENTO }).notNull(),
    propia: integer("propia", { mode: "boolean" }).notNull().default(false),
    /** null = sin minuto o posterior al final. */
    minuto: integer("minuto"),
    /** Jugador propio: autor, amonestado o jugador que entra. */
    jugadorId: text("jugador_id").references(() => jugadores.id, { onDelete: "restrict" }),
    /** Cambios: jugador propio que sale. */
    jugadorSaleId: text("jugador_sale_id").references(() => jugadores.id, { onDelete: "restrict" }),
    nombreRival: text("nombre_rival"),
    ...marcasTiempo(),
  },
  (t) => [
    index("partido_eventos_partido_minuto_idx").on(t.partidoId, t.minuto),
    checkEnum("partido_eventos_tipo_ck", "tipo", TIPOS_EVENTO),
    checkEnum("partido_eventos_lado_ck", "lado", LADOS_EVENTO),
    check("partido_eventos_propia_solo_gol_ck", condicion(`not "propia" or "tipo" = 'gol'`)),
    check(
      "partido_eventos_cambio_ck",
      condicion(
        `"tipo" <> 'cambio' or ("lado" = 'propio' and "jugador_id" is not null and "jugador_sale_id" is not null)`,
      ),
    ),
    check(
      "partido_eventos_minuto_ck",
      condicion(`"minuto" is null or "minuto" between 0 and ${MINUTO_MAXIMO}`),
    ),
  ],
);
