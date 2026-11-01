import { check, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { temporadas } from "./competicion";
import { condicion, id, marcasTiempo } from "./comunes";
import { jugadores, staff } from "./plantilla";
import { multas } from "./multas";

export const entrenamientos = sqliteTable(
  "entrenamientos",
  {
    id: id(),
    temporadaId: text("temporada_id")
      .notNull()
      .references(() => temporadas.id, { onDelete: "cascade" }),
    categoria: text("categoria", { enum: ["Senior", "Veteranos"] }).notNull(),
    fecha: text("fecha").notNull(),
    hora: text("hora"),
    nota: text("nota"),
    ...marcasTiempo(),
  },
  (t) => [
    uniqueIndex("entrenamientos_dia_uq").on(t.temporadaId, t.categoria, t.fecha),
    check("entrenamientos_categoria_ck", condicion(`"categoria" in ('Senior', 'Veteranos')`)),
  ],
);

export const asistencias = sqliteTable(
  "asistencias",
  {
    id: id(),
    entrenamientoId: text("entrenamiento_id")
      .notNull()
      .references(() => entrenamientos.id, { onDelete: "cascade" }),
    jugadorId: text("jugador_id").references(() => jugadores.id, { onDelete: "cascade" }),
    staffId: text("staff_id").references(() => staff.id, { onDelete: "cascade" }),
    estado: text("estado", { enum: ["presente", "tarde", "ausente"] }).notNull(),
    justificado: integer("justificado", { mode: "boolean" }).notNull().default(false),
    motivo: text("motivo"),
    multaId: text("multa_id").references(() => multas.id, { onDelete: "set null" }),
    ...marcasTiempo(),
  },
  (t) => [
    uniqueIndex("asistencias_jugador_uq").on(t.entrenamientoId, t.jugadorId),
    uniqueIndex("asistencias_staff_uq").on(t.entrenamientoId, t.staffId),
    uniqueIndex("asistencias_multa_uq").on(t.multaId),
    check("asistencias_persona_ck", condicion(`("jugador_id" is null) <> ("staff_id" is null)`)),
    check("asistencias_estado_ck", condicion(`"estado" in ('presente', 'tarde', 'ausente')`)),
  ],
);
