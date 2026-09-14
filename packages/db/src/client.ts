import { type Client, createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

export type Db = LibSQLDatabase<typeof schema>;
export type TransaccionDb = Parameters<Parameters<Db["transaction"]>[0]>[0];

export interface ConexionDb {
  db: Db;
  cliente: Client;
  /** Ojo: libSQL no libera el fichero hasta que termina el proceso. */
  cerrar: () => void;
}

export interface OpcionesConexion {
  /** WAL para uso normal; `false` deja un único fichero (BD que otro proceso moverá después). */
  wal?: boolean;
}

export async function abrirDb(
  url: string,
  { wal = true }: OpcionesConexion = {},
): Promise<ConexionDb> {
  // `timeout` es el busy_timeout de @libsql/client: se aplica a cada conexión que abre el
  // cliente, incluidas las que crea internamente `transaction()` (el PRAGMA manual solo cubría
  // la conexión inicial del pool).
  const cliente = createClient({ url, timeout: 5000 });
  await cliente.execute("PRAGMA foreign_keys = ON");
  if (url.startsWith("file:")) {
    await cliente.execute(`PRAGMA journal_mode = ${wal ? "WAL" : "DELETE"}`);
    await cliente.execute("PRAGMA busy_timeout = 5000");
  }
  return { db: drizzle(cliente, { schema }), cliente, cerrar: () => cliente.close() };
}
