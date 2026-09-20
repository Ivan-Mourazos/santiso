import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("GET /api/estado", () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.santisoConexionDb = undefined;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.SANTISO_DATA_DIR;
    vi.restoreAllMocks();
  });

  it("informa de la temporada activa y del número de partidos", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "santiso-estado-"));
    process.env.SANTISO_DATA_DIR = dir;
    const bd = await import("@santiso/db");
    const inicial = await bd.abrirDb(bd.urlArchivo(path.join(dir, "santiso.db")));
    await bd.migrarBd(inicial.db);
    await inicial.db.insert(bd.schema.temporadas).values({ nombre: "2026/27", activa: true });
    inicial.cerrar();

    const { GET } = await import("./route");
    const respuesta = await GET();

    expect(respuesta.status).toBe(200);
    await expect(respuesta.json()).resolves.toEqual({
      ok: true,
      temporadaActiva: "2026/27",
      partidos: 0,
    });
  });

  it("responde 503 si no hay base de datos", async () => {
    process.env.SANTISO_DATA_DIR = mkdtempSync(path.join(tmpdir(), "santiso-estado-"));
    const { GET } = await import("./route");
    const respuesta = await GET();
    expect(respuesta.status).toBe(503);
    await expect(respuesta.json()).resolves.toMatchObject({ ok: false });
  });
});
