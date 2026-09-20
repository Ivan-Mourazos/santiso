import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** BD migrada y vacía en un temporal; devuelve el módulo de acciones ya apuntando a ella. */
async function entorno() {
  const dir = mkdtempSync(path.join(tmpdir(), "santiso-temporadas-"));
  process.env.SANTISO_DATA_DIR = dir;
  vi.resetModules();
  globalThis.santisoConexionDb = undefined;
  const bd = await import("@santiso/db");
  const inicial = await bd.abrirDb(bd.urlArchivo(path.join(dir, "santiso.db")));
  await bd.migrarBd(inicial.db);
  inicial.cerrar();
  return await import("./temporadas");
}

describe("acciones de temporadas", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.SANTISO_DATA_DIR;
    vi.restoreAllMocks();
  });

  it("la primera temporada creada queda activa", async () => {
    const { crearTemporada, cargarTemporadas } = await entorno();

    const creada = await crearTemporada("2025/26");
    expect(creada).toMatchObject({ ok: true, datos: { nombre: "2025/26", activa: true } });

    const listado = await cargarTemporadas();
    if (!listado.ok) throw new Error("el listado falló");
    expect(listado.datos).toHaveLength(1);
  });

  it("normaliza el nombre antes de guardarlo", async () => {
    const { crearTemporada } = await entorno();
    expect(await crearTemporada("  25/26 ")).toMatchObject({
      ok: true,
      datos: { nombre: "2025/26" },
    });
  });

  it("rechaza un nombre inválido sin tocar la base de datos", async () => {
    const { crearTemporada, cargarTemporadas } = await entorno();

    expect(await crearTemporada("temporada que viene")).toMatchObject({ ok: false });

    const listado = await cargarTemporadas();
    if (!listado.ok) throw new Error("el listado falló");
    expect(listado.datos).toHaveLength(0);
  });

  it("rechaza un nombre repetido", async () => {
    const { crearTemporada } = await entorno();
    await crearTemporada("2025/26");
    expect(await crearTemporada("2025/26")).toMatchObject({
      ok: false,
      error: "Ya existe una temporada con ese nombre.",
    });
  });

  it("la segunda temporada no queda activa", async () => {
    const { crearTemporada } = await entorno();
    await crearTemporada("2025/26");
    expect(await crearTemporada("2026/27")).toMatchObject({ ok: true, datos: { activa: false } });
  });

  it("activar una temporada deja exactamente una activa", async () => {
    const { crearTemporada, activarTemporada, cargarTemporadas } = await entorno();
    await crearTemporada("2025/26");
    const segunda = await crearTemporada("2026/27");
    if (!segunda.ok) throw new Error("no se creó la segunda");

    expect(await activarTemporada(segunda.datos.id)).toEqual({ ok: true, datos: null });

    const listado = await cargarTemporadas();
    if (!listado.ok) throw new Error("el listado falló");
    const activas = listado.datos.filter((t) => t.activa);
    expect(activas).toHaveLength(1);
    expect(activas[0]?.nombre).toBe("2026/27");
  });

  it("activar una temporada inexistente falla y no cambia la activa", async () => {
    const { crearTemporada, activarTemporada, cargarTemporadas } = await entorno();
    await crearTemporada("2025/26");

    expect(await activarTemporada("no-existe")).toMatchObject({ ok: false });

    const listado = await cargarTemporadas();
    if (!listado.ok) throw new Error("el listado falló");
    expect(listado.datos.filter((t) => t.activa)).toHaveLength(1);
  });

  it("lista la activa primero y el resto por nombre descendente", async () => {
    const { crearTemporada, activarTemporada, cargarTemporadas } = await entorno();
    await crearTemporada("2024/25");
    await crearTemporada("2026/27");
    const media = await crearTemporada("2025/26");
    if (!media.ok) throw new Error("no se creó la de en medio");
    await activarTemporada(media.datos.id);

    const listado = await cargarTemporadas();
    if (!listado.ok) throw new Error("el listado falló");
    expect(listado.datos.map((t) => t.nombre)).toEqual(["2025/26", "2026/27", "2024/25"]);
  });
});
