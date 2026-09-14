/** Proceso hijo de `importar`: crea, importa y verifica la BD temporal. Al terminar, libera los ficheros. */
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { abrirDb, migrarBd, urlArchivo } from "@santiso/db";
import { importarModelo } from "../importar";
import { renderizarInforme } from "../informe";
import { leerSnapshot } from "../snapshot/archivos";
import { transformar } from "../transformar";
import { ErrorMigracion } from "../transformar/tipos";
import { verificarImportacion } from "../verificar";

const [dirSnapshot, rutaBd, dirMedia, rutaInforme] = process.argv.slice(2);
if (!dirSnapshot || !rutaBd || !dirMedia || !rutaInforme) {
  console.error("Uso: construir-bd <dirSnapshot> <rutaBd> <dirMedia> <rutaInforme>");
  process.exit(2);
}

try {
  const { snapshot, manifiesto } = leerSnapshot(dirSnapshot);
  const { modelo, informe } = transformar(snapshot);

  const { db, cliente, cerrar } = await abrirDb(urlArchivo(rutaBd), { wal: false });
  await migrarBd(db);
  await importarModelo(db, modelo);

  const mediaSnapshot = path.join(dirSnapshot, "media");
  if (existsSync(mediaSnapshot)) cpSync(mediaSnapshot, dirMedia, { recursive: true });

  const verificacion = await verificarImportacion({
    db,
    cliente,
    origen: snapshot,
    modelo,
    dirMedia,
    manifiesto,
  });
  cerrar();

  mkdirSync(path.dirname(rutaInforme), { recursive: true });
  writeFileSync(
    rutaInforme,
    renderizarInforme({ dirSnapshot, modelo, informe, verificacion, fecha: new Date() }),
  );
  for (const c of verificacion.comprobaciones) {
    console.log(`${c.ok ? "OK   " : "FALLO"} ${c.nombre}: ${c.detalle}`);
  }
  process.exit(verificacion.ok ? 0 : 1);
} catch (error) {
  console.error(error instanceof ErrorMigracion ? `Migración detenida: ${error.message}` : error);
  process.exit(1);
}
