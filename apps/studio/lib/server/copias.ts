import "server-only";

import { mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { type ConexionDb, copiarBd, DIR_BACKUPS, marcaFichero } from "@santiso/db";

/** Las copias automáticas van en su carpeta: las hechas a mano (`pnpm db:backup`) no se tocan. */
export const DIR_COPIAS_DIARIAS = path.join(DIR_BACKUPS, "diarias");
/** Cuántas se conservan. */
export const COPIAS_QUE_SE_GUARDAN = 14;

const ES_COPIA = /^santiso-\d{4}-\d{2}-\d{2}T[\d-]+\.db$/;

/**
 * Hace la copia del día si todavía no existe y borra las más antiguas de la carpeta.
 * Devuelve la ruta creada, o `null` si la de hoy ya estaba.
 */
export async function copiaDiaria(
  cliente: ConexionDb["cliente"],
  ahora = new Date(),
  dir = DIR_COPIAS_DIARIAS,
): Promise<string | null> {
  mkdirSync(dir, { recursive: true });
  const copias = () => readdirSync(dir).filter((nombre) => ES_COPIA.test(nombre)).sort();
  const hoy = `santiso-${marcaFichero(ahora).slice(0, 10)}`;
  if (copias().some((nombre) => nombre.startsWith(hoy))) return null;
  const creada = await copiarBd(cliente, dir, ahora);
  // El nombre lleva la fecha: ordenadas, las primeras son las más viejas.
  for (const vieja of copias().slice(0, -COPIAS_QUE_SE_GUARDAN)) {
    rmSync(path.join(dir, vieja), { force: true });
  }
  return creada;
}
