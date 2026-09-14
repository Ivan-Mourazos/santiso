import { mkdirSync } from "node:fs";
import { abrirDb } from "../client";
import { migrarBd } from "../migraciones";
import { DIR_DATOS, RUTA_BD, urlArchivo } from "../rutas";

mkdirSync(DIR_DATOS, { recursive: true });
const { db, cerrar } = await abrirDb(urlArchivo(RUTA_BD));
await migrarBd(db);
cerrar();
console.log(`Migraciones aplicadas en ${RUTA_BD}`);
