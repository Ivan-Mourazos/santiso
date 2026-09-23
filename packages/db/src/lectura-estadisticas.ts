import { stat } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type InStatement, type ResultSet } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { Db } from "./client";
import * as schema from "./schema";

export interface LecturaEstadisticas {
  db: Db;
  ejecutar: (consulta: InStatement) => Promise<ResultSet>;
  cerrar: () => Promise<void>;
}

/** Snapshot de auditoría: una sola conexión, query_only y ninguna configuración de WAL. */
export async function abrirLecturaEstadisticas(archivo: string): Promise<LecturaEstadisticas> {
  if (!isAbsolute(archivo)) throw new Error("La ruta de la base de datos debe ser absoluta.");
  if (!(await stat(archivo)).isFile())
    throw new Error("La ruta no es un fichero de base de datos.");
  const cliente = createClient({ url: pathToFileURL(archivo).href, concurrency: 1 });
  try {
    const tx = await cliente.transaction("read");
    await tx.execute("PRAGMA query_only = ON");
    return {
      // Drizzle requiere Client aunque sus SELECT solo usan execute. El adaptador conserva
      // ese contrato y encierra todas las consultas en la transacción ya abierta.
      db: drizzle(
        new Proxy(cliente, {
          get(target, propiedad) {
            if (propiedad === "execute") return tx.execute.bind(tx);
            if (propiedad === "batch") return tx.batch.bind(tx);
            if (
              ["transaction", "migrate", "sync", "reconnect", "executeMultiple"].includes(
                String(propiedad),
              )
            ) {
              return () => {
                throw new Error("Operación no admitida en el lector de estadísticas.");
              };
            }
            const valor = Reflect.get(target, propiedad, target);
            return typeof valor === "function" ? valor.bind(target) : valor;
          },
        }),
        { schema },
      ),
      ejecutar: (consulta) => tx.execute(consulta),
      cerrar: async () => {
        try {
          await tx.rollback();
        } finally {
          tx.close();
          cliente.close();
        }
      },
    };
  } catch (error) {
    cliente.close();
    throw error;
  }
}
