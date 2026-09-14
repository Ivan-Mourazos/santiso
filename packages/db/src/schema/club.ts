import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { id, marcasTiempo } from "./comunes";

export const patrocinadores = sqliteTable("patrocinadores", {
  id: id(),
  nombre: text("nombre").notNull(),
  clave: text("clave").notNull().unique(),
  logo: text("logo"),
  webUrl: text("web_url"),
  orden: integer("orden").notNull().default(0),
  enCarteles: integer("en_carteles", { mode: "boolean" }).notNull().default(false),
  ...marcasTiempo(),
});

/** Configuración global clave → valor JSON. Claves y formas en `@santiso/domain` (`AJUSTES`). */
export const ajustes = sqliteTable("ajustes", {
  id: text("id").primaryKey(),
  valor: text("valor", { mode: "json" }).$type<unknown>().notNull(),
  actualizadoEn: text("actualizado_en")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`)
    .$onUpdateFn(() => new Date().toISOString()),
});
