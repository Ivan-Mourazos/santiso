import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/libsql/migrator";
import type { Db } from "./client";

export const DIR_MIGRACIONES = fileURLToPath(new URL("../migrations", import.meta.url));

export async function migrarBd(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder: DIR_MIGRACIONES });
}
