import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { manifiestoPara, snapshotMinimo } from "../test/fabricas";
import { escribirSnapshot, leerSnapshot, ultimoSnapshot } from "./archivos";

const dirTemporal = () => mkdtempSync(path.join(tmpdir(), "santiso-snapshot-"));

describe("escribirSnapshot / leerSnapshot", () => {
  it("guarda y recupera el mismo contenido", () => {
    const dir = dirTemporal();
    const { snapshot } = snapshotMinimo();
    const manifiesto = manifiestoPara(snapshot);
    escribirSnapshot(dir, snapshot, manifiesto);
    const leido = leerSnapshot(dir);
    expect(leido.snapshot).toEqual(snapshot);
    expect(leido.manifiesto).toEqual(manifiesto);
  });

  it("detecta un manifiesto que no cuadra con las tablas", () => {
    const dir = dirTemporal();
    const { snapshot } = snapshotMinimo();
    escribirSnapshot(dir, snapshot, {
      ...manifiestoPara(snapshot),
      filas: { ...manifiestoPara(snapshot).filas, partidos_liga: 5 },
    });
    expect(() => leerSnapshot(dir)).toThrow(/partidos_liga/);
  });
});

describe("ultimoSnapshot", () => {
  it("elige el directorio más reciente por nombre", () => {
    const dir = dirTemporal();
    for (const nombre of ["2026-09-13T10-00-00", "2026-09-13T20-15-03", "2026-09-12T23-59-59"]) {
      mkdirSync(path.join(dir, nombre));
    }
    writeFileSync(path.join(dir, "notas.txt"), "no es un snapshot");
    expect(path.basename(ultimoSnapshot(dir))).toBe("2026-09-13T20-15-03");
  });

  it("explica qué hacer si no hay snapshots", () => {
    expect(() => ultimoSnapshot(dirTemporal())).toThrow(/pnpm migracion:exportar/);
  });
});
