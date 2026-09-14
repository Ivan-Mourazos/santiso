import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sha256 } from "./hash";
import { escribirSnapshot } from "./snapshot/archivos";
import { clavesMedia } from "./snapshot/media";
import { type Manifiesto, TABLAS, type TablaOrigen, validarSnapshot } from "./snapshot/tipos";
import { type ConfigSupabase, descargarMedia, type Fetch, leerTabla } from "./supabase/cliente";

export interface OpcionesExportacion {
  config: ConfigSupabase;
  dir: string;
  fetchImpl?: Fetch;
  registrar?: (mensaje: string) => void;
}

/** Vuelca tablas y media referenciada a `dir`. Solo lectura sobre Supabase. */
export async function exportarSnapshot({
  config,
  dir,
  fetchImpl = fetch,
  registrar = console.log,
}: OpcionesExportacion): Promise<Manifiesto> {
  const crudo: Partial<Record<TablaOrigen, unknown>> = {};
  for (const tabla of TABLAS) {
    const filas = await leerTabla(config, tabla, fetchImpl);
    crudo[tabla] = filas;
    registrar(`${tabla}: ${filas.length} filas`);
  }
  const snapshot = validarSnapshot(crudo);

  const media: Manifiesto["media"] = {};
  for (const clave of [...clavesMedia(snapshot)].sort()) {
    const bytes = await descargarMedia(config, clave, fetchImpl);
    const destino = path.join(dir, "media", ...clave.split("/"));
    mkdirSync(path.dirname(destino), { recursive: true });
    writeFileSync(destino, bytes);
    media[clave] = { bytes: bytes.length, sha256: sha256(bytes) };
  }
  registrar(`media: ${Object.keys(media).length} ficheros`);

  const manifiesto: Manifiesto = {
    creadoEn: new Date().toISOString(),
    origen: new URL(config.url).host,
    filas: Object.fromEntries(TABLAS.map((tabla) => [tabla, snapshot[tabla].length])),
    media,
  };
  escribirSnapshot(dir, snapshot, manifiesto);
  return manifiesto;
}
