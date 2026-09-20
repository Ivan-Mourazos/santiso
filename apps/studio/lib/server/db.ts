import "server-only";
import { existsSync } from "node:fs";
import { abrirDb, type ConexionDb, RUTA_BD, urlArchivo } from "@santiso/db";

declare global {
  // Una conexión por proceso, guardada en globalThis para sobrevivir a la recarga en caliente.
  // `var` es obligatorio: las declaraciones globales de TypeScript no admiten let/const.
  var santisoConexionDb: Promise<ConexionDb> | undefined;
}

/** Conexión única a `data/santiso.db` para Server Components, acciones y route handlers. */
export function obtenerDb(): Promise<ConexionDb> {
  if (!globalThis.santisoConexionDb) {
    if (!existsSync(RUTA_BD)) {
      return Promise.reject(
        new Error(`No existe la base de datos ${RUTA_BD}. Ejecuta pnpm migracion:importar.`),
      );
    }
    globalThis.santisoConexionDb = abrirDb(urlArchivo(RUTA_BD)).catch((error: unknown) => {
      globalThis.santisoConexionDb = undefined;
      throw error;
    });
  }
  return globalThis.santisoConexionDb;
}
