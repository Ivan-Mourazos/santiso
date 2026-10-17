import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { checkEnum, condicion, id, marcasTiempo } from "./comunes";
import { TIPOS_EVENTO_LIGA } from "./liga";
import { rfgfGruposHistoricos } from "./rfgf";

export const ESTADOS_PARTIDO_HISTORICO = ["pendiente", "listo", "sin_acta", "error"] as const;

/** Archivo independiente: no crea equipos, jornadas, partidos activos ni estadísticas. */
export const rfgfHistoricoPartidos = sqliteTable(
  "rfgf_historico_partidos",
  {
    id: id(),
    codGrupo: text("cod_grupo")
      .notNull()
      .references(() => rfgfGruposHistoricos.codGrupo, { onDelete: "cascade" }),
    jornada: integer("jornada").notNull(),
    fechaNominal: text("fecha_nominal").notNull(),
    /** Fecha efectiva publicada en acta o PDF de jornada, nunca inferida del calendario. */
    fecha: text("fecha"),
    local: text("local").notNull(),
    visitante: text("visitante").notNull(),
    santisoLocal: integer("santiso_local", { mode: "boolean" }).notNull(),
    golesLocal: integer("goles_local"),
    golesVisitante: integer("goles_visitante"),
    codActa: text("cod_acta"),
    codigosEn: text("codigos_en"),
    /** Acta ya interpretada, también si su formato no es compatible. */
    actaLeidaEn: text("acta_leida_en"),
    resultadoEn: text("resultado_en"),
    estado: text("estado", { enum: ESTADOS_PARTIDO_HISTORICO }).notNull().default("pendiente"),
    intentos: integer("intentos").notNull().default(0),
    aviso: text("aviso").notNull().default(""),
    ...marcasTiempo(),
  },
  (t) => [
    uniqueIndex("rfgf_historico_partidos_cruce_uq").on(t.codGrupo, t.jornada, t.local, t.visitante),
    index("rfgf_historico_partidos_cola_idx").on(t.codGrupo, t.estado, t.actualizadoEn),
    checkEnum("rfgf_historico_partidos_estado_ck", "estado", ESTADOS_PARTIDO_HISTORICO),
    check(
      "rfgf_historico_partidos_marcador_ck",
      condicion(
        "(goles_local is null and goles_visitante is null) or (goles_local is not null and goles_visitante is not null and goles_local >= 0 and goles_visitante >= 0)",
      ),
    ),
    check("rfgf_historico_partidos_jornada_ck", condicion("jornada > 0 and intentos >= 0")),
  ],
);

/** Mismos tipos y nombres que liga_eventos; lado sustituye a equipo_id, sin enlace a plantilla. */
export const rfgfHistoricoEventos = sqliteTable(
  "rfgf_historico_eventos",
  {
    id: id(),
    partidoId: text("partido_id")
      .notNull()
      .references(() => rfgfHistoricoPartidos.id, { onDelete: "cascade" }),
    lado: text("lado", { enum: ["local", "visitante"] }).notNull(),
    persona: text("persona").notNull(),
    personaClave: text("persona_clave").notNull(),
    tipo: text("tipo", { enum: TIPOS_EVENTO_LIGA }).notNull(),
    minuto: text("minuto").notNull().default(""),
    tecnico: integer("tecnico", { mode: "boolean" }).notNull().default(false),
    ...marcasTiempo(),
  },
  (t) => [
    index("rfgf_historico_eventos_partido_idx").on(t.partidoId),
    checkEnum("rfgf_historico_eventos_tipo_ck", "tipo", TIPOS_EVENTO_LIGA),
    checkEnum("rfgf_historico_eventos_lado_ck", "lado", ["local", "visitante"]),
  ],
);
