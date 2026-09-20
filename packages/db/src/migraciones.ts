import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/libsql/migrator";
import type { Db } from "./client";

/** Carpeta de migraciones SQL. Es una función para no evaluar `import.meta.url` al importar el paquete. */
export const dirMigraciones = () => fileURLToPath(new URL("../migrations", import.meta.url));

export async function migrarBd(db: Db, carpeta = dirMigraciones()): Promise<void> {
  await migrate(db, { migrationsFolder: carpeta });
}
