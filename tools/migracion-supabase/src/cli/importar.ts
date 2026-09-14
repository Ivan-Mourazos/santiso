import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DIR_BACKUPS, DIR_INFORMES, DIR_MEDIA, marcaFichero, RUTA_BD } from "@santiso/db";
import { resolverArgSnapshot, ultimoSnapshot } from "../snapshot/archivos";
import {
  BdEnUsoError,
  IntercambioFallidoError,
  intercambiarFicheros,
  moverBdActualABackup,
} from "./intercambio-bd";

const marca = marcaFichero();
const dirSnapshot = resolverArgSnapshot(process.argv[2]) ?? ultimoSnapshot();
const bdTemporal = `${RUTA_BD}.importando`;
const mediaTemporal = `${DIR_MEDIA}.importando`;
const rutaInforme = path.join(DIR_INFORMES, `migracion-${marca}.md`);

// Restos de una importación fallida: su proceso ya terminó, así que no están bloqueados.
rmSync(bdTemporal, { force: true });
rmSync(mediaTemporal, { recursive: true, force: true });
mkdirSync(path.dirname(RUTA_BD), { recursive: true });

console.log(`Importando ${dirSnapshot}`);
const tsx = createRequire(import.meta.url).resolve("tsx/cli");
const hijo = fileURLToPath(new URL("./construir-bd.ts", import.meta.url));
try {
  execFileSync(process.execPath, [tsx, hijo, dirSnapshot, bdTemporal, mediaTemporal, rutaInforme], {
    stdio: "inherit",
  });
} catch {
  console.error(
    `\nLa importación no se completó y la BD actual no se ha tocado. Informe (si existe): ${rutaInforme}`,
  );
  process.exit(1);
}

// libSQL solo libera los ficheros al terminar su proceso: el cambio se hace aquí, con el hijo ya cerrado.
mkdirSync(DIR_BACKUPS, { recursive: true });
const bdBackup = path.join(DIR_BACKUPS, `santiso-${marca}.db`);
const mediaBackup = path.join(DIR_BACKUPS, `media-${marca}`);

let sufijosBdRespaldados: string[];
try {
  sufijosBdRespaldados = moverBdActualABackup(RUTA_BD, bdBackup);
} catch (error) {
  if (error instanceof BdEnUsoError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}

try {
  intercambiarFicheros({
    rutaBd: RUTA_BD,
    dirMedia: DIR_MEDIA,
    bdTemporal,
    mediaTemporal,
    bdBackup,
    mediaBackup,
    sufijosBdRespaldados,
  });
} catch (error) {
  if (error instanceof IntercambioFallidoError) {
    console.error(`\n${error.message}`);
    process.exit(1);
  }
  throw error;
}

console.log(`\nBase de datos lista: ${RUTA_BD}\nInforme: ${rutaInforme}`);
