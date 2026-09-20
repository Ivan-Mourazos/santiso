import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dirTemporal = () => mkdtempSync(path.join(tmpdir(), "santiso-studio-"));

describe("obtenerDb", () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.santisoConexionDb = undefined;
  });
  afterEach(() => {
    delete process.env.SANTISO_DATA_DIR;
  });

  it("falla con instrucciones si no existe la base de datos", async () => {
    process.env.SANTISO_DATA_DIR = dirTemporal();
    const { obtenerDb } = await import("./db");
    await expect(obtenerDb()).rejects.toThrow(/pnpm migracion:importar/);
    expect(globalThis.santisoConexionDb).toBeUndefined();
  });

  it("abre la base de datos existente una sola vez", async () => {
    const dir = dirTemporal();
    process.env.SANTISO_DATA_DIR = dir;
    const bd = await import("@santiso/db");
    const inicial = await bd.abrirDb(bd.urlArchivo(path.join(dir, "santiso.db")));
    await bd.migrarBd(inicial.db);
    inicial.cerrar();

    const { obtenerDb } = await import("./db");
    const primera = obtenerDb();
    expect(obtenerDb()).toBe(primera);
    const { cliente } = await primera;
    const fila = (await cliente.execute("select count(*) as total from temporadas")).rows[0];
    expect(fila?.["total"]).toBe(0);
  });
});
