import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** BD con una competición, tres equipos inscritos y una jornada; devuelve ids y acciones. */
async function entorno() {
  const dir = mkdtempSync(path.join(tmpdir(), "santiso-clasificacion-"));
  process.env.SANTISO_DATA_DIR = dir;
  vi.resetModules();
  globalThis.santisoConexionDb = undefined;
  const bd = await import("@santiso/db");
  const { db, cerrar } = await bd.abrirDb(bd.urlArchivo(path.join(dir, "santiso.db")));
  await bd.migrarBd(db);

  const [temporada] = await db
    .insert(bd.schema.temporadas)
    .values({ nombre: "2026/27", activa: true })
    .returning({ id: bd.schema.temporadas.id });
  if (!temporada) throw new Error("sin temporada");
  const [competicion] = await db
    .insert(bd.schema.competiciones)
    .values({ temporadaId: temporada.id, categoria: "Senior", nombre: "Liga" })
    .returning({ id: bd.schema.competiciones.id });
  if (!competicion) throw new Error("sin competición");

  const equipos = await db
    .insert(bd.schema.equipos)
    .values([
      {
        nombre: "Santiso",
        clave: "santiso",
        categoria: "Senior",
        esPropio: true,
        escudo: "escudos/s.webp",
      },
      { nombre: "Rival A", clave: "rival a", categoria: "Senior" },
      { nombre: "Rival B", clave: "rival b", categoria: "Senior" },
    ])
    .returning({ id: bd.schema.equipos.id, nombre: bd.schema.equipos.nombre });
  await db
    .insert(bd.schema.competicionEquipos)
    .values(equipos.map((e) => ({ competicionId: competicion.id, equipoId: e.id })));
  const [jornada] = await db
    .insert(bd.schema.jornadas)
    .values({ competicionId: competicion.id, numero: 1 })
    .returning({ id: bd.schema.jornadas.id });
  if (!jornada) throw new Error("sin jornada");

  const porNombre = (nombre: string) => {
    const encontrado = equipos.find((e) => e.nombre === nombre);
    if (!encontrado) throw new Error(`sin equipo ${nombre}`);
    return encontrado.id;
  };
  cerrar();

  return {
    acciones: await import("./clasificacion"),
    competicionId: competicion.id,
    jornadaId: jornada.id,
    porNombre,
  };
}

describe("cargarPantallaClasificacion", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.SANTISO_DATA_DIR;
    vi.restoreAllMocks();
  });

  it("devuelve una fila por equipo inscrito, a cero, sin partidos", async () => {
    const { acciones, competicionId } = await entorno();
    const pantalla = await acciones.cargarPantallaClasificacion(competicionId);
    if (!pantalla.ok) throw new Error("falló la carga");
    expect(pantalla.datos.filas).toHaveLength(3);
    expect(pantalla.datos.filas.every((f) => f.puntos === 0)).toBe(true);
    expect(pantalla.datos.reglas).toEqual([]);
  });

  it("convierte la clave del escudo en una URL de media local", async () => {
    const { acciones, competicionId } = await entorno();
    const pantalla = await acciones.cargarPantallaClasificacion(competicionId);
    if (!pantalla.ok) throw new Error("falló la carga");
    const santiso = pantalla.datos.filas.find((f) => f.nombre === "Santiso");
    expect(santiso?.escudoUrl).toBe("/media/escudos/s.webp");
    expect(pantalla.datos.filas.find((f) => f.nombre === "Rival A")?.escudoUrl).toBeNull();
  });

  it("cuenta los partidos finalizados de la competición", async () => {
    const { acciones, competicionId, jornadaId, porNombre } = await entorno();
    const bd = await import("@santiso/db");
    const { db } = await (await import("@/lib/server/db")).obtenerDb();
    await db.insert(bd.schema.partidos).values({
      jornadaId,
      equipoLocalId: porNombre("Santiso"),
      equipoVisitanteId: porNombre("Rival A"),
      golesLocal: 3,
      golesVisitante: 1,
      estado: "finalizado",
    });

    const pantalla = await acciones.cargarPantallaClasificacion(competicionId);
    if (!pantalla.ok) throw new Error("falló la carga");
    expect(pantalla.datos.filas[0]).toMatchObject({ nombre: "Santiso", puntos: 3, golesFavor: 3 });
  });

  it("no cuenta los partidos de otra competición", async () => {
    const { acciones, competicionId, porNombre } = await entorno();
    const bd = await import("@santiso/db");
    const { db } = await (await import("@/lib/server/db")).obtenerDb();

    const [temporada] = await db.select({ id: bd.schema.temporadas.id }).from(bd.schema.temporadas);
    if (!temporada) throw new Error("sin temporada");
    const [otra] = await db
      .insert(bd.schema.competiciones)
      .values({ temporadaId: temporada.id, categoria: "Senior", nombre: "Copa" })
      .returning({ id: bd.schema.competiciones.id });
    if (!otra) throw new Error("sin competición");
    const [jornadaOtra] = await db
      .insert(bd.schema.jornadas)
      .values({ competicionId: otra.id, numero: 1 })
      .returning({ id: bd.schema.jornadas.id });
    if (!jornadaOtra) throw new Error("sin jornada");
    await db.insert(bd.schema.partidos).values({
      jornadaId: jornadaOtra.id,
      equipoLocalId: porNombre("Santiso"),
      equipoVisitanteId: porNombre("Rival A"),
      golesLocal: 9,
      golesVisitante: 0,
      estado: "finalizado",
    });

    const pantalla = await acciones.cargarPantallaClasificacion(competicionId);
    if (!pantalla.ok) throw new Error("falló la carga");
    expect(pantalla.datos.filas.every((f) => f.jugados === 0)).toBe(true);
  });

  it("devuelve las reglas guardadas en la competición", async () => {
    const { acciones, competicionId } = await entorno();
    const reglas = [{ id: "asc", nombre: "Ascenso", puestos: [1], color: "#10b981" }];
    const { guardarReglas } = await import("./competiciones");
    await guardarReglas(competicionId, reglas);

    const pantalla = await acciones.cargarPantallaClasificacion(competicionId);
    if (!pantalla.ok) throw new Error("falló la carga");
    expect(pantalla.datos.reglas).toEqual(reglas);
  });

  it("devuelve una pantalla vacía si la competición no existe", async () => {
    const { acciones } = await entorno();
    expect(await acciones.cargarPantallaClasificacion("no-existe")).toEqual({
      ok: true,
      datos: { filas: [], reglas: [] },
    });
  });
});
