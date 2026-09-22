import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Carpeta de datos de las pruebas de escritura. Fuera del repositorio y fuera de `data/`: estas
 * pruebas crean, editan y quitan jugadores, y nunca deben tocar la base de datos real.
 */
export const DIR_ESCRITURA =
  process.env.SANTISO_E2E_DIR ?? mkdtempSync(path.join(os.tmpdir(), "santiso-e2e-escritura-"));
export const PUERTO_ESCRITURA = 3111;
