import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { abrirDb, migrarBd, urlArchivo } from "@santiso/db";
import { describe, expect, it } from "vitest";

import { COPIAS_QUE_SE_GUARDAN, copiaDiaria } from "./copias";

async function entorno() {
  const dir = mkdtempSync(path.join(tmpdir(), "santiso-copias-"));
  const conexion = await abrirDb(urlArchivo(path.join(dir, "santiso.db")));
  await migrarBd(conexion.db);
  return { conexion, destino: path.join(dir, "diarias") };
}

describe("copia diaria", () => {
  it("hace una sola copia al día", async () => {
    const { conexion, destino } = await entorno();
    const primera = await copiaDiaria(conexion.cliente, new Date("2026-10-12T08:00:00Z"), destino);
    const segunda = await copiaDiaria(conexion.cliente, new Date("2026-10-12T19:00:00Z"), destino);
    const manana = await copiaDiaria(conexion.cliente, new Date("2026-10-13T08:00:00Z"), destino);
    conexion.cerrar();
    expect(path.basename(primera ?? "")).toBe("santiso-2026-10-12T08-00-00.db");
    expect(segunda).toBeNull();
    expect(manana).not.toBeNull();
    expect(readdirSync(destino)).toHaveLength(2);
  });

  it("conserva las últimas y no borra lo que no es una copia suya", async () => {
    const { conexion, destino } = await entorno();
    for (let dia = 1; dia <= COPIAS_QUE_SE_GUARDAN + 3; dia += 1) {
      await copiaDiaria(conexion.cliente, new Date(Date.UTC(2026, 8, dia, 8)), destino);
      if (dia === 1) writeFileSync(path.join(destino, "notas.txt"), "no tocar");
    }
    conexion.cerrar();
    const ficheros = readdirSync(destino).sort();
    expect(ficheros).toContain("notas.txt");
    const copias = ficheros.filter((nombre) => nombre.endsWith(".db"));
    expect(copias).toHaveLength(COPIAS_QUE_SE_GUARDAN);
    expect(copias[0]).toBe("santiso-2026-09-04T08-00-00.db");
  });
});
