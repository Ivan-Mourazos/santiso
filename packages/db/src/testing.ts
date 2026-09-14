import { abrirDb, type ConexionDb } from "./client";
import { migrarBd } from "./migraciones";

/** BD en memoria con todas las migraciones aplicadas. */
export async function crearDbPrueba(): Promise<ConexionDb> {
  const conexion = await abrirDb(":memory:");
  await migrarBd(conexion.db);
  return conexion;
}
