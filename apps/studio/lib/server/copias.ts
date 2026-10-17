import "server-only";

import { cpSync, existsSync, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import {
  type ConexionDb,
  copiarBd,
  DIR_BACKUPS,
  DIR_MEDIA,
  listarCopiasCompletas,
  marcaFichero,
} from "@santiso/db";

/** Las copias automáticas van en su carpeta: las hechas a mano (`pnpm db:backup`) no se tocan. */
export const DIR_COPIAS_DIARIAS = path.join(DIR_BACKUPS, "diarias");
/** Cuántas se conservan. */
export const COPIAS_QUE_SE_GUARDAN = 14;

function aplicarRetencion(dir: string) {
  for (const vieja of listarCopiasCompletas(dir).slice(0, -COPIAS_QUE_SE_GUARDAN)) {
    rmSync(vieja, { recursive: true });
  }
}

/** Destino externo dedicado a diarias: tampoco toca copias manuales de esa ubicación. */
function copiarFuera(creada: string, raiz: string) {
  if (!path.isAbsolute(raiz) || !statSync(raiz).isDirectory())
    throw new Error("STUDIO_COPIA_EXTERNA debe ser un directorio absoluto existente.");
  const dir = path.join(raiz, "diarias");
  mkdirSync(dir, { recursive: true });
  const nombre = path.basename(creada);
  const destino = path.join(dir, nombre);
  if (!existsSync(destino)) {
    const temporal = path.join(dir, `.${nombre}.tmp`);
    mkdirSync(temporal);
    try {
      cpSync(creada, temporal, { recursive: true, errorOnExist: true, force: false });
      renameSync(temporal, destino);
    } catch (error) {
      rmSync(temporal, { recursive: true, force: true });
      throw error;
    }
  }
  aplicarRetencion(dir);
}

/**
 * Hace la copia del día si todavía no existe y borra las más antiguas de la carpeta.
 * Devuelve la ruta creada, o `null` si la de hoy ya estaba.
 */
export async function copiaDiaria(
  cliente: ConexionDb["cliente"],
  ahora = new Date(),
  dir = DIR_COPIAS_DIARIAS,
  opciones: { dirMedia?: string; dirExterno?: string } = {},
): Promise<string | null> {
  mkdirSync(dir, { recursive: true });
  const copias = listarCopiasCompletas(dir);
  const hoy = `santiso-${marcaFichero(ahora).slice(0, 10)}`;
  if (copias.some((ruta) => path.basename(ruta).startsWith(hoy))) return null;
  const creada = await copiarBd(cliente, dir, ahora, opciones.dirMedia ?? DIR_MEDIA);
  // El nombre lleva la fecha: ordenadas, las primeras son las más viejas.
  aplicarRetencion(dir);
  const externo = opciones.dirExterno ?? process.env.STUDIO_COPIA_EXTERNA;
  if (externo) {
    try {
      copiarFuera(creada, externo);
    } catch (error) {
      console.error("[copias] La copia externa falló; la copia local sigue disponible.", error);
    }
  }
  return creada;
}
