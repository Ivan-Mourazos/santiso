import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DIR_SNAPSHOTS } from "@santiso/db";
import { type Manifiesto, manifiestoSchema, type Snapshot, TABLAS, validarSnapshot } from "./tipos";

const rutaTabla = (dir: string, tabla: string) => path.join(dir, "tablas", `${tabla}.json`);
const aJson = (valor: unknown) => `${JSON.stringify(valor, null, 2)}\n`;

export function escribirSnapshot(dir: string, snapshot: Snapshot, manifiesto: Manifiesto): void {
  mkdirSync(path.join(dir, "tablas"), { recursive: true });
  for (const tabla of TABLAS) writeFileSync(rutaTabla(dir, tabla), aJson(snapshot[tabla]));
  writeFileSync(path.join(dir, "manifiesto.json"), aJson(manifiesto));
}

export function leerSnapshot(dir: string): { snapshot: Snapshot; manifiesto: Manifiesto } {
  const leerJson = (ruta: string): unknown => JSON.parse(readFileSync(ruta, "utf8"));
  const snapshot = validarSnapshot(
    Object.fromEntries(TABLAS.map((tabla) => [tabla, leerJson(rutaTabla(dir, tabla))])),
  );
  const manifiesto = manifiestoSchema.parse(leerJson(path.join(dir, "manifiesto.json")));
  for (const tabla of TABLAS) {
    if (manifiesto.filas[tabla] !== snapshot[tabla].length) {
      throw new Error(
        `Snapshot incoherente: ${tabla} tiene ${snapshot[tabla].length} filas y el manifiesto indica ${manifiesto.filas[tabla]}.`,
      );
    }
  }
  return { snapshot, manifiesto };
}

/** Directorio del snapshot más reciente (los nombres son marcas de tiempo ordenables). */
export function ultimoSnapshot(dirSnapshots = DIR_SNAPSHOTS): string {
  const nombres = existsSync(dirSnapshots)
    ? readdirSync(dirSnapshots, { withFileTypes: true })
        .filter((entrada) => entrada.isDirectory())
        .map((entrada) => entrada.name)
        .sort()
    : [];
  const ultimo = nombres.at(-1);
  if (!ultimo) {
    throw new Error(
      `No hay snapshots en ${dirSnapshots}. Ejecuta primero pnpm migracion:exportar.`,
    );
  }
  return path.join(dirSnapshots, ultimo);
}
