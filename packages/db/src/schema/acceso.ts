import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { checkEnum, id, marcasTiempo } from "./comunes";

/**
 * Quién puede entrar. `admin` lo hace todo; `tecnico` (el cuerpo técnico) usa el día a día
 * —convocatoria, alineación, multas, actas, carteles— pero no toca temporadas, competiciones
 * ni usuarios.
 */
export const ROLES_USUARIO = ["admin", "tecnico"] as const;
export type RolUsuario = (typeof ROLES_USUARIO)[number];

export const usuarios = sqliteTable(
  "usuarios",
  {
    id: id(),
    /** Nombre para entrar: minúsculas, sin espacios. */
    usuario: text("usuario").notNull().unique(),
    nombre: text("nombre").notNull(),
    rol: text("rol", { enum: ROLES_USUARIO }).notNull(),
    /** `scrypt$<sal>$<clave>` en hexadecimal. La contraseña no se guarda. */
    claveHash: text("clave_hash").notNull(),
    activo: integer("activo", { mode: "boolean" }).notNull().default(true),
    ...marcasTiempo(),
  },
  () => [checkEnum("usuarios_rol_ck", "rol", ROLES_USUARIO)],
);

export const sesiones = sqliteTable(
  "sesiones",
  {
    /** SHA-256 del valor de la cookie: quien lea la base no puede suplantar a nadie. */
    id: text("id").primaryKey(),
    usuarioId: text("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    /** ISO. Pasada esta fecha la sesión no vale. */
    expiraEn: text("expira_en").notNull(),
    ...marcasTiempo(),
  },
  (t) => [index("sesiones_usuario_idx").on(t.usuarioId)],
);
