import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function entorno() {
  const dir = mkdtempSync(path.join(tmpdir(), "santiso-campos-"));
  process.env.SANTISO_DATA_DIR = dir;
  vi.resetModules();
  globalThis.santisoConexionDb = undefined;
  const bd = await import("@santiso/db");
  const inicial = await bd.abrirDb(bd.urlArchivo(path.join(dir, "santiso.db")));
  await bd.migrarBd(inicial.db);
  inicial.cerrar();
  return await import("./campos");
}

describe("acciones de campos", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.SANTISO_DATA_DIR;
    vi.restoreAllMocks();
  });

  it("crea un campo nuevo", async () => {
    const { asegurarCampo } = await entorno();
    expect(await asegurarCampo("A Carballeira", "Santiso")).toMatchObject({
      ok: true,
      datos: { nombre: "A Carballeira", poblacion: "Santiso" },
    });
  });

  it("reutiliza el campo existente aunque cambien tildes y mayúsculas", async () => {
    const { asegurarCampo } = await entorno();
    const primero = await asegurarCampo("A Carballeira", "Santiso");
    const segundo = await asegurarCampo("  a carballeira ", null);
    if (!primero.ok || !segundo.ok) throw new Error("fallaron");
    expect(segundo.datos.id).toBe(primero.datos.id);
  });

  it("rellena la población si el campo no la tenía", async () => {
    const { asegurarCampo } = await entorno();
    await asegurarCampo("A Carballeira", null);
    expect(await asegurarCampo("A Carballeira", "Santiso")).toMatchObject({
      ok: true,
      datos: { poblacion: "Santiso" },
    });
  });

  it("no pisa una población ya registrada", async () => {
    const { asegurarCampo } = await entorno();
    await asegurarCampo("A Carballeira", "Santiso");
    expect(await asegurarCampo("A Carballeira", "Otra villa")).toMatchObject({
      ok: true,
      datos: { poblacion: "Santiso" },
    });
  });

  it("trata la población en blanco como ausente", async () => {
    const { asegurarCampo } = await entorno();
    expect(await asegurarCampo("A Carballeira", "   ")).toMatchObject({
      ok: true,
      datos: { poblacion: null },
    });
  });

  it("rechaza un nombre vacío", async () => {
    const { asegurarCampo } = await entorno();
    expect(await asegurarCampo("   ", null)).toMatchObject({ ok: false });
  });

  it("lista los campos por nombre", async () => {
    const { asegurarCampo, cargarCampos } = await entorno();
    await asegurarCampo("Zulo", null);
    await asegurarCampo("A Carballeira", null);

    const listado = await cargarCampos();
    if (!listado.ok) throw new Error("el listado falló");
    expect(listado.datos.map((c) => c.nombre)).toEqual(["A Carballeira", "Zulo"]);
  });
});
