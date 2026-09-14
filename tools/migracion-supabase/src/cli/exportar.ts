import path from "node:path";
import { fileURLToPath } from "node:url";
import { DIR_SNAPSHOTS, marcaFichero } from "@santiso/db";
import { exportarSnapshot } from "../exportar";
import { leerConfig } from "../supabase/cliente";

const rutaEnv = fileURLToPath(new URL("../../../../apps/studio/.env.local", import.meta.url));
const config = leerConfig(rutaEnv);
const dir = path.join(DIR_SNAPSHOTS, marcaFichero());

console.log(`Exportando desde ${new URL(config.url).host} a ${dir}`);
const manifiesto = await exportarSnapshot({ config, dir });
const filas = Object.values(manifiesto.filas).reduce((total, cantidad) => total + cantidad, 0);
console.log(
  `Snapshot listo: ${filas} filas y ${Object.keys(manifiesto.media).length} ficheros de media.`,
);
