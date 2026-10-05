import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { temporadas } from "./competicion";
import { condicion, id, marcasTiempo } from "./comunes";
import { jugadores, staff } from "./plantilla";

/**
 * Conceptos de multa del club (retraso, protestar…), con su importe por defecto en céntimos.
 * Los que ya no se usan se desactivan: las multas viejas conservan su nombre.
 */
export const multasConceptos = sqliteTable(
  "multas_conceptos",
  {
    id: id(),
    nombre: text("nombre").notNull(),
    /** `claveNombre(nombre)`: no hay dos conceptos que se llamen igual. */
    clave: text("clave").notNull(),
    /** Dónde se aplica: en los entrenamientos o en los partidos. */
    grupo: text("grupo", { enum: ["adestramento", "partido"] }).notNull(),
    importeCentimos: integer("importe_centimos").notNull(),
    /** Se cobra por unidad («1 € por prenda»): al poner la multa se pide cuántas. */
    porUnidad: integer("por_unidad", { mode: "boolean" }).notNull().default(false),
    /**
     * Qué se puede marcar en un concepto por unidad («Medias 1ª», «Peto»…): cada una cuenta
     * una unidad. Vacío = se pide solo la cantidad.
     */
    opciones: text("opciones", { mode: "json" }).$type<string[]>().notNull().default([]),
    orden: integer("orden").notNull().default(0),
    activo: integer("activo", { mode: "boolean" }).notNull().default(true),
    ...marcasTiempo(),
  },
  (t) => [
    // «Chegar tarde» existe en entrenamientos y en partidos: la clave se repite entre grupos.
    uniqueIndex("multas_conceptos_grupo_clave_uq").on(t.grupo, t.clave),
    check("multas_conceptos_grupo_ck", condicion(`"grupo" in ('adestramento', 'partido')`)),
    check("multas_conceptos_importe_ck", condicion(`"importe_centimos" > 0`)),
  ],
);

/**
 * Multa interna a un jugador o a alguien del cuerpo técnico (uno de los dos). Datos privados
 * del vestuario: no entran en carteles ni en exportaciones. El nombre del concepto y el importe
 * se copian en la multa: cambiar el catálogo después no reescribe lo ya puesto.
 */
export const multas = sqliteTable(
  "multas",
  {
    id: id(),
    temporadaId: text("temporada_id")
      .notNull()
      .references(() => temporadas.id, { onDelete: "cascade" }),
    jugadorId: text("jugador_id").references(() => jugadores.id, { onDelete: "cascade" }),
    staffId: text("staff_id").references(() => staff.id, { onDelete: "cascade" }),
    concepto: text("concepto").notNull(),
    importeCentimos: integer("importe_centimos").notNull(),
    /** Día de la multa, `AAAA-MM-DD`. */
    fecha: text("fecha").notNull(),
    nota: text("nota"),
    /** Día en que se pagó, `AAAA-MM-DD`; `null` = pendiente. */
    pagadaEn: text("pagada_en"),
    ...marcasTiempo(),
  },
  (t) => [
    index("multas_temporada_idx").on(t.temporadaId, t.fecha),
    index("multas_jugador_idx").on(t.jugadorId),
    check("multas_una_persona_ck", condicion(`("jugador_id" is null) <> ("staff_id" is null)`)),
    check("multas_importe_ck", condicion(`"importe_centimos" > 0`)),
  ],
);
