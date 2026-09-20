import { existsSync, renameSync } from "node:fs";

/**
 * Lógica de intercambio de ficheros de `pnpm migracion:importar`, separada del script de CLI
 * para poder probarla con directorios temporales reales (sin depender de `data/`).
 */

/** Windows a veces reporta EPERM (en vez de EBUSY) cuando otro proceso tiene el fichero abierto. */
export const esErrorFicheroEnUso = (error: unknown): boolean =>
  error instanceof Error && "code" in error && (error.code === "EBUSY" || error.code === "EPERM");

/** La BD actual está bloqueada por otro proceso (normalmente `pnpm dev`). */
export class BdEnUsoError extends Error {}

/**
 * El intercambio de ficheros falló a medio hacer; el llamador ya deshizo lo que había movido y
 * restauró la BD anterior, así que el mensaje solo informa del estado final.
 */
export class IntercambioFallidoError extends Error {}

/**
 * Mueve la BD actual (y sus `-wal`/`-shm`) a `backups/`. Devuelve los sufijos que sí existían y se
 * movieron, para poder restaurarlos si un paso posterior falla.
 */
export function moverBdActualABackup(rutaBd: string, bdBackup: string): string[] {
  if (!existsSync(rutaBd)) return [];
  try {
    renameSync(rutaBd, bdBackup);
  } catch (error) {
    if (esErrorFicheroEnUso(error)) {
      throw new BdEnUsoError(
        "La base de datos está en uso. Cierra `pnpm dev` y repite la importación.",
      );
    }
    throw error;
  }
  const sufijosRespaldados: string[] = [];
  try {
    for (const sufijo of ["-wal", "-shm"]) {
      if (existsSync(rutaBd + sufijo)) {
        renameSync(rutaBd + sufijo, bdBackup + sufijo);
        sufijosRespaldados.push(sufijo);
      }
    }
  } catch (error) {
    // Intenta todos los pasos aunque uno falle; conserva las copias para recuperación manual.
    const fallos: string[] = [];
    const restaurar = (origen: string, destino: string) => {
      try {
        renameSync(origen, destino);
      } catch (fallo) {
        fallos.push(`${origen} -> ${destino}: ${String(fallo)}`);
      }
    };
    for (const sufijo of [...sufijosRespaldados].reverse()) {
      restaurar(bdBackup + sufijo, rutaBd + sufijo);
    }
    restaurar(bdBackup, rutaBd);
    if (fallos.length > 0) {
      throw new IntercambioFallidoError(
        `No se pudo restaurar todo automáticamente: ${fallos.join("; ")}. ` +
          `No uses la app. Revisa ${rutaBd} y ${bdBackup}. Error original: ${String(error)}`,
      );
    }
    if (esErrorFicheroEnUso(error)) {
      throw new BdEnUsoError(
        "La base de datos está en uso. Cierra `pnpm dev` y repite la importación.",
      );
    }
    throw error;
  }
  return sufijosRespaldados;
}

export interface ParametrosIntercambio {
  rutaBd: string;
  dirMedia: string;
  bdTemporal: string;
  mediaTemporal: string;
  bdBackup: string;
  mediaBackup: string;
  /** Sufijos (`-wal`, `-shm`) que `moverBdActualABackup` respaldó y hay que poder devolver. */
  sufijosBdRespaldados: string[];
}

/**
 * Sustituye la BD y la carpeta de media por las construidas por la importación. Si cualquier paso
 * falla, deshace en orden inverso lo que ya se había movido y devuelve también la BD anterior
 * desde su copia en `backups/`, de forma que `data/` queda como estaba antes de llamar a esta
 * función (y la build nueva sigue intacta en las rutas `.importando`).
 */
export function intercambiarFicheros(parametros: ParametrosIntercambio): void {
  const {
    rutaBd,
    dirMedia,
    bdTemporal,
    mediaTemporal,
    bdBackup,
    mediaBackup,
    sufijosBdRespaldados,
  } = parametros;

  const deshacer: Array<() => void> = [];
  try {
    if (existsSync(dirMedia)) {
      renameSync(dirMedia, mediaBackup);
      deshacer.push(() => renameSync(mediaBackup, dirMedia));
    }
    renameSync(bdTemporal, rutaBd);
    deshacer.push(() => renameSync(rutaBd, bdTemporal));
    if (existsSync(mediaTemporal)) {
      renameSync(mediaTemporal, dirMedia);
      deshacer.push(() => renameSync(dirMedia, mediaTemporal));
    }
  } catch (error) {
    const fallosAlDeshacer: string[] = [];
    const intentar = (paso: () => void) => {
      try {
        paso();
      } catch (errorDeshacer) {
        fallosAlDeshacer.push(
          errorDeshacer instanceof Error ? errorDeshacer.message : String(errorDeshacer),
        );
      }
    };
    for (const paso of deshacer.reverse()) intentar(paso);
    if (existsSync(bdBackup)) {
      intentar(() => renameSync(bdBackup, rutaBd));
      for (const sufijo of sufijosBdRespaldados) {
        intentar(() => renameSync(bdBackup + sufijo, rutaBd + sufijo));
      }
    }
    const motivo = error instanceof Error ? error.message : String(error);
    if (fallosAlDeshacer.length > 0) {
      throw new IntercambioFallidoError(
        `No se pudo completar el intercambio de ficheros (${motivo}) y no se pudo restaurar todo automáticamente (${fallosAlDeshacer.join("; ")}). ` +
          `No uses la app hasta revisar ${rutaBd}, ${bdBackup} y ${bdTemporal}: ninguna copia se ha borrado.`,
      );
    }
    throw new IntercambioFallidoError(
      `No se pudo completar el intercambio de ficheros (${motivo}). ` +
        `Se restauraron los datos anteriores en ${rutaBd}; la build nueva de la importación sigue disponible en ${bdTemporal}.`,
    );
  }
}
