import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DIR_BACKUPS, DIR_INFORMES, DIR_MEDIA, marcaFichero, RUTA_BD } from "@santiso/db";
import { ultimoSnapshot } from "../snapshot/archivos";

const marca = marcaFichero();
const dirSnapshot = process.argv[2] ? path.resolve(process.argv[2]) : ultimoSnapshot();
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
if (existsSync(RUTA_BD)) {
  try {
    renameSync(RUTA_BD, path.join(DIR_BACKUPS, `santiso-${marca}.db`));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EBUSY") {
      console.error("La base de datos está en uso. Cierra `pnpm dev` y repite la importación.");
      process.exit(1);
    }
    throw error;
  }
  for (const sufijo of ["-wal", "-shm"]) {
    if (existsSync(RUTA_BD + sufijo)) {
      renameSync(RUTA_BD + sufijo, path.join(DIR_BACKUPS, `santiso-${marca}.db${sufijo}`));
    }
  }
}
if (existsSync(DIR_MEDIA)) renameSync(DIR_MEDIA, path.join(DIR_BACKUPS, `media-${marca}`));
renameSync(bdTemporal, RUTA_BD);
if (existsSync(mediaTemporal)) renameSync(mediaTemporal, DIR_MEDIA);

console.log(`\nBase de datos lista: ${RUTA_BD}\nInforme: ${rutaInforme}`);
