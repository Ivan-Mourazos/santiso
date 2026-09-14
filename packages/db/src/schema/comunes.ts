import { sql } from "drizzle-orm";
import { check, text } from "drizzle-orm/sqlite-core";

/** Clave primaria UUID generada en la aplicación. */
export const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const AHORA_ISO = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

/** `creado_en` y `actualizado_en` en ISO UTC. Es una función: cada tabla necesita builders propios. */
export const marcasTiempo = () => ({
  creadoEn: text("creado_en").notNull().default(AHORA_ISO),
  actualizadoEn: text("actualizado_en")
    .notNull()
    .default(AHORA_ISO)
    .$onUpdateFn(() => new Date().toISOString()),
});

/** Condición SQL literal para CHECK e índices parciales (solo constantes, nunca datos de usuario). */
export const condicion = (expresion: string) => sql.raw(expresion);

/** CHECK que limita una columna de texto a un conjunto cerrado de valores del dominio. */
export const checkEnum = (nombre: string, columna: string, valores: readonly string[]) =>
  check(nombre, condicion(`"${columna}" in (${valores.map((v) => `'${v}'`).join(", ")})`));
