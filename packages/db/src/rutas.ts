import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Directorio de datos locales (BD, media, snapshots, copias, informes).
 * `SANTISO_DATA_DIR` lo sobrescribe y se resuelve a ruta absoluta. Sin ella se usa `<repo>/data`,
 * calculado desde este fichero: solo es fiable fuera de un bundler (CLIs y pruebas), por eso
 * `import.meta.url` únicamente se evalúa en ese caso.
 */
export function resolverDirDatos(entorno: NodeJS.ProcessEnv = process.env): string {
  const configurado = entorno.SANTISO_DATA_DIR?.trim();
  if (configurado) return path.resolve(configurado);
  // `new URL(especificador, import.meta.url)` lo resuelve el bundler como si fuera un módulo
  // (Turbopack falla con "Can't resolve ../../../"). La forma de un solo argumento es opaca para él.
  const dirFichero = path.dirname(fileURLToPath(new URL(import.meta.url)));
  return path.join(dirFichero, "..", "..", "..", "data");
}

export const DIR_DATOS = resolverDirDatos();
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
