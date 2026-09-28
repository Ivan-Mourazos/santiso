import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { abrirDb } from "../client";
import { aplicarLimpieza, ensayarLimpieza, informeEnMarkdown } from "../limpieza";
import { DIR_BACKUPS, DIR_INFORMES, DIR_MEDIA, RUTA_BD, marcaFichero, urlArchivo } from "../rutas";

/**
 * pnpm db:limpiar-temporada --temporada 2025/26            → ensayo: informe, sin cambios
 * pnpm db:limpiar-temporada --temporada 2025/26 --aplicar  → copia completa y limpieza
 * Con `--normalizar`, además deja los textos uniformes (misma transacción, mismo informe).
 * Con `--aplicar`, `pnpm dev` debe estar parado: se mueven ficheros de media.
 */
const { values } = parseArgs({
  options: {
    temporada: { type: "string" },
    aplicar: { type: "boolean", default: false },
    normalizar: { type: "boolean", default: false },
  },
});
const temporada = values.temporada?.trim();
if (!temporada) {
  console.error("Uso: pnpm db:limpiar-temporada --temporada 2025/26 [--aplicar]");
  process.exit(1);
}
if (!existsSync(RUTA_BD)) {
  console.error(`No existe la base de datos ${RUTA_BD}.`);
  process.exit(1);
}

const marca = marcaFichero();
const sufijo = temporada.replaceAll("/", "-");
const { cliente, cerrar } = await abrirDb(urlArchivo(RUTA_BD));
try {
  let informe;
  if (values.aplicar) {
    mkdirSync(DIR_BACKUPS, { recursive: true });
    const copia = path.join(DIR_BACKUPS, `archivo-temporada-${sufijo}-${marca}.db`);
    await cliente.execute({ sql: "VACUUM INTO ?", args: [copia] });
    console.log(`Copia completa: ${copia}`);
    informe = await aplicarLimpieza(
      cliente,
      temporada,
      DIR_MEDIA,
      path.join(DIR_BACKUPS, `media-${sufijo}-${marca}`),
      { normalizar: values.normalizar },
    );
  } else {
    informe = await ensayarLimpieza(cliente, temporada, { normalizar: values.normalizar });
  }
  mkdirSync(DIR_INFORMES, { recursive: true });
  const destino = path.join(
    DIR_INFORMES,
    `limpieza-${sufijo}-${values.aplicar ? "aplicada" : "ensayo"}-${marca}.md`,
  );
  writeFileSync(destino, informeEnMarkdown(informe, Boolean(values.aplicar)));
  console.log(informeEnMarkdown(informe, Boolean(values.aplicar)));
  console.log(`Informe: ${destino}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  cerrar();
}
