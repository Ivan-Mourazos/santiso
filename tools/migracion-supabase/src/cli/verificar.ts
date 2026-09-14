import { existsSync } from "node:fs";
import { abrirDb, DIR_MEDIA, RUTA_BD, urlArchivo } from "@santiso/db";
import { leerSnapshot, resolverArgSnapshot, ultimoSnapshot } from "../snapshot/archivos";
import { transformar } from "../transformar";
import { verificarImportacion } from "../verificar";

if (!existsSync(RUTA_BD)) {
  console.error(`No existe ${RUTA_BD}. Ejecuta primero pnpm migracion:importar.`);
  process.exit(1);
}

const dirSnapshot = resolverArgSnapshot(process.argv[2]) ?? ultimoSnapshot();
const { snapshot, manifiesto } = leerSnapshot(dirSnapshot);
const { modelo } = transformar(snapshot);
const { db, cliente, cerrar } = await abrirDb(urlArchivo(RUTA_BD));
const resultado = await verificarImportacion({
  db,
  cliente,
  origen: snapshot,
  modelo,
  dirMedia: DIR_MEDIA,
  manifiesto,
});
cerrar();

for (const c of resultado.comprobaciones) {
  console.log(`${c.ok ? "OK   " : "FALLO"} ${c.nombre}: ${c.detalle}`);
}
process.exit(resultado.ok ? 0 : 1);
