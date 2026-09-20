import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** BD migrada con una temporada activa «2026/27» y otra inactiva; devuelve acciones e ids. */
async function entorno() {
  const dir = mkdtempSync(path.join(tmpdir(), "santiso-competiciones-"));
  process.env.SANTISO_DATA_DIR = dir;
  vi.resetModules();
  globalThis.santisoConexionDb = undefined;
  const bd = await import("@santiso/db");
  const inicial = await bd.abrirDb(bd.urlArchivo(path.join(dir, "santiso.db")));
  await bd.migrarBd(inicial.db);
  const [temporada] = await inicial.db
    .insert(bd.schema.temporadas)
    .values({ nombre: "2026/27", activa: true })
    .returning({ id: bd.schema.temporadas.id });
  const [otra] = await inicial.db
    .insert(bd.schema.temporadas)
    .values({ nombre: "2025/26", activa: false })
    .returning({ id: bd.schema.temporadas.id });
  inicial.cerrar();
  if (!temporada || !otra) throw new Error("no se crearon las temporadas");
  return { acciones: await import("./competiciones"), temporadaId: temporada.id, otraId: otra.id };
}

describe("acciones de competiciones", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.SANTISO_DATA_DIR;
    vi.restoreAllMocks();
  });

  it("crea la competición en la temporada activa", async () => {
    const { acciones } = await entorno();
    expect(
      await acciones.crearCompeticion({
        nombre: "Primeira Galega",
        categoria: "Senior",
        formato: "liga",
      }),
    ).toMatchObject({
      ok: true,
      datos: { nombre: "Primeira Galega", categoria: "Senior", formato: "liga", activa: true },
    });
  });

  it("asigna el orden siguiente dentro de la categoría", async () => {
    const { acciones } = await entorno();
    const primera = await acciones.crearCompeticion({
      nombre: "Liga",
      categoria: "Senior",
      formato: "liga",
    });
    const segunda = await acciones.crearCompeticion({
      nombre: "Copa",
      categoria: "Senior",
      formato: "eliminatoria",
    });
    if (!primera.ok || !segunda.ok) throw new Error("no se crearon");
    expect(segunda.datos.orden).toBeGreaterThan(primera.datos.orden);
  });

  it("rechaza una categoría desconocida", async () => {
    const { acciones } = await entorno();
    expect(
      await acciones.crearCompeticion({ nombre: "X", categoria: "Cadete", formato: "liga" }),
    ).toMatchObject({ ok: false });
  });

  it("rechaza un formato desconocido", async () => {
    const { acciones } = await entorno();
    expect(
      await acciones.crearCompeticion({ nombre: "X", categoria: "Senior", formato: "triangular" }),
    ).toMatchObject({ ok: false });
  });

  it("rechaza un nombre repetido en la misma categoría y temporada", async () => {
    const { acciones } = await entorno();
    await acciones.crearCompeticion({ nombre: "Liga", categoria: "Senior", formato: "liga" });
    expect(
      await acciones.crearCompeticion({ nombre: "Liga", categoria: "Senior", formato: "liga" }),
    ).toMatchObject({ ok: false, error: "Ya existe una competición con ese nombre." });
  });

  it("admite el mismo nombre en otra categoría", async () => {
    const { acciones } = await entorno();
    await acciones.crearCompeticion({ nombre: "Liga", categoria: "Senior", formato: "liga" });
    expect(
      await acciones.crearCompeticion({ nombre: "Liga", categoria: "Femenino", formato: "liga" }),
    ).toMatchObject({ ok: true });
  });

  it("solo lista las competiciones de la temporada activa", async () => {
    const { acciones, otraId } = await entorno();
    await acciones.crearCompeticion({ nombre: "Liga", categoria: "Senior", formato: "liga" });

    const bd = await import("@santiso/db");
    const { db } = await (await import("@/lib/server/db")).obtenerDb();
    await db
      .insert(bd.schema.competiciones)
      .values({ temporadaId: otraId, categoria: "Senior", nombre: "Liga vieja" });

    const listado = await acciones.cargarCompeticiones();
    if (!listado.ok) throw new Error("el listado falló");
    expect(listado.datos.map((c) => c.nombre)).toEqual(["Liga"]);
  });

  it("guarda y devuelve las reglas de clasificación", async () => {
    const { acciones } = await entorno();
    const creada = await acciones.crearCompeticion({
      nombre: "Liga",
      categoria: "Senior",
      formato: "liga",
    });
    if (!creada.ok) throw new Error("no se creó");

    const reglas = [{ id: "asc", nombre: "Ascenso", puestos: [1, 2], color: "#10b981" }];
    expect(await acciones.guardarReglas(creada.datos.id, reglas)).toEqual({
      ok: true,
      datos: null,
    });

    const { reglasDeCompeticion } = await import("@/lib/server/consultas/competiciones");
    expect(await reglasDeCompeticion(creada.datos.id)).toEqual(reglas);
  });

  it("rechaza reglas con un color inválido y no las guarda", async () => {
    const { acciones } = await entorno();
    const creada = await acciones.crearCompeticion({
      nombre: "Liga",
      categoria: "Senior",
      formato: "liga",
    });
    if (!creada.ok) throw new Error("no se creó");

    const malas = [{ id: "asc", nombre: "Ascenso", puestos: [1], color: "verde" }];
    expect(await acciones.guardarReglas(creada.datos.id, malas)).toMatchObject({ ok: false });

    const { reglasDeCompeticion } = await import("@/lib/server/consultas/competiciones");
    expect(await reglasDeCompeticion(creada.datos.id)).toEqual([]);
  });

  it("borra una competición sin jornadas", async () => {
    const { acciones } = await entorno();
    const creada = await acciones.crearCompeticion({
      nombre: "Liga",
      categoria: "Senior",
      formato: "liga",
    });
    if (!creada.ok) throw new Error("no se creó");

    expect(await acciones.borrarCompeticion(creada.datos.id)).toEqual({ ok: true, datos: null });

    const listado = await acciones.cargarCompeticiones();
    if (!listado.ok) throw new Error("el listado falló");
    expect(listado.datos).toHaveLength(0);
  });

  it("se niega a borrar una competición que tiene jornadas", async () => {
    const { acciones } = await entorno();
    const creada = await acciones.crearCompeticion({
      nombre: "Liga",
      categoria: "Senior",
      formato: "liga",
    });
    if (!creada.ok) throw new Error("no se creó");

    const bd = await import("@santiso/db");
    const { db } = await (await import("@/lib/server/db")).obtenerDb();
    await db.insert(bd.schema.jornadas).values({ competicionId: creada.datos.id, numero: 1 });

    expect(await acciones.borrarCompeticion(creada.datos.id)).toMatchObject({
      ok: false,
      error: "No se puede borrar: la competición tiene jornadas.",
    });
  });
});
