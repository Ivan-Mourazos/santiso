import { existsSync } from "node:fs";
import { copiarBd } from "../backup";
import { abrirDb } from "../client";
import { RUTA_BD, urlArchivo } from "../rutas";

if (!existsSync(RUTA_BD)) {
  console.error(`No existe la base de datos ${RUTA_BD}.`);
  process.exit(1);
}
const { cliente, cerrar } = await abrirDb(urlArchivo(RUTA_BD));
try {
  const destino = await copiarBd(cliente);
  console.log(`Copia completa creada: ${destino}`);
} finally {
  cerrar();
}
