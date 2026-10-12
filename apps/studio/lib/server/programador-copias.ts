import "server-only";

import { copiaDiaria } from "./copias";
import { comoSistema, obtenerDb } from "./db";

/** Cada cuánto se mira si falta la copia de hoy. */
const CADA_MS = 60 * 60_000;

declare global {
  var santisoProgramadorCopias: ReturnType<typeof setInterval> | undefined;
}

/**
 * Copia diaria de la base de datos. Solo con `STUDIO_COPIA_DIARIA=1`, que lleva la copia de uso
 * diario: desde que entra más gente a escribir, un error ajeno tiene que poder deshacerse.
 */
export function iniciarProgramadorCopias() {
  if (process.env.STUDIO_COPIA_DIARIA !== "1" || globalThis.santisoProgramadorCopias) return;
  const comprobar = async () => {
    try {
      const creada = await comoSistema(async () => copiaDiaria((await obtenerDb()).cliente));
      if (creada) console.info(`[copias] Copia diaria: ${creada}`);
    } catch (error) {
      console.error("[copias] La copia diaria falló.", error);
    }
  };
  globalThis.santisoProgramadorCopias = setInterval(() => void comprobar(), CADA_MS);
  setTimeout(() => void comprobar(), 30_000);
}
