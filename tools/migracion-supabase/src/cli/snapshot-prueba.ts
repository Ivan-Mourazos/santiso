/** Genera un snapshot sintético en DIR_SNAPSHOTS para probar importar/verificar sin Supabase. */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DIR_SNAPSHOTS, marcaFichero } from "@santiso/db";
import { escribirSnapshot } from "../snapshot/archivos";
import { manifiestoPara, snapshotMinimo } from "../test/fabricas";

const dir = path.join(DIR_SNAPSHOTS, marcaFichero());
const { snapshot } = snapshotMinimo();
const escudo = new Uint8Array([1, 2, 3]);
mkdirSync(path.join(dir, "media"), { recursive: true });
writeFileSync(path.join(dir, "media", "escudo_club.webp"), escudo);
escribirSnapshot(dir, snapshot, manifiestoPara(snapshot, { "escudo_club.webp": escudo }));
console.log(`Snapshot de prueba: ${dir}`);
