import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ_REPO = fileURLToPath(new URL("../../../", import.meta.url));

/** Directorio de datos locales (BD, media, snapshots, copias, informes). `SANTISO_DATA_DIR` lo sobrescribe. */
export const DIR_DATOS = process.env.SANTISO_DATA_DIR ?? path.join(RAIZ_REPO, "data");
export const RUTA_BD = path.join(DIR_DATOS, "santiso.db");
export const DIR_MEDIA = path.join(DIR_DATOS, "media");
export const DIR_SNAPSHOTS = path.join(DIR_DATOS, "snapshots");
export const DIR_BACKUPS = path.join(DIR_DATOS, "backups");
export const DIR_INFORMES = path.join(DIR_DATOS, "informes");

/** URL `file:` para libSQL a partir de una ruta del sistema (barras normales también en Windows). */
export const urlArchivo = (ruta: string) => `file:${ruta.replaceAll("\\", "/")}`;

/** Marca de tiempo apta para nombres de fichero: `2026-09-13T20-15-03`. */
export const marcaFichero = (fecha = new Date()) =>
  fecha.toISOString().slice(0, 19).replaceAll(":", "-");
