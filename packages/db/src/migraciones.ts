import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/libsql/migrator";
import type { Db } from "./client";

/**
 * Carpeta de migraciones SQL. Es una función para no evaluar `import.meta.url` al importar el
 * paquete, y usa `new URL(import.meta.url)` (un solo argumento) porque la forma de dos el bundler
 * la resuelve como si fuera un módulo.
 */
export const dirMigraciones = () =>
  path.join(path.dirname(fileURLToPath(new URL(import.meta.url))), "..", "migrations");

export async function migrarBd(db: Db, carpeta = dirMigraciones()): Promise<void> {
  await migrate(db, { migrationsFolder: carpeta });
}
