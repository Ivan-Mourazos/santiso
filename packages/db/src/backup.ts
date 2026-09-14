import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Client } from "@libsql/client";
import { DIR_BACKUPS, marcaFichero } from "./rutas";

/** Copia consistente de la BD con `VACUUM INTO`. Válida con la app en marcha. Devuelve la ruta creada. */
export async function copiarBd(
  cliente: Client,
  dirDestino = DIR_BACKUPS,
  fecha = new Date(),
): Promise<string> {
  mkdirSync(dirDestino, { recursive: true });
  const destino = path.join(dirDestino, `santiso-${marcaFichero(fecha)}.db`);
  await cliente.execute({ sql: "VACUUM INTO ?", args: [destino] });
  return destino;
}
