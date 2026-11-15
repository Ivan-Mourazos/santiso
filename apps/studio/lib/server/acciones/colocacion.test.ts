import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** BD con un partido jugado y otro por jugar, y 12 jugadores. */
async function entorno() {
  const dir = mkdtempSync(path.join(tmpdir(), "santiso-colocacion-"));
  process.env.SANTISO_DATA_DIR = dir;
  vi.resetModules();
  globalThis.santisoConexionDb = undefined;
  const bd = await import("@santiso/db");
  const { db, cerrar } = await bd.abrirDb(bd.urlArchivo(path.join(dir, "santiso.db")));
  await bd.migrarBd(db);
  const s = bd.schema;
  const [temporada] = await db
    .insert(s.temporadas)
    .values({ nombre: "2026/27", activa: true })
    .returning({ id: s.temporadas.id });
  const [competicion] = await db
    .insert(s.competiciones)
    .values({ temporadaId: temporada!.id, categoria: "Senior", nombre: "Liga" })
    .returning({ id: s.competiciones.id });
  const [santiso, rival] = await db
    .insert(s.equipos)
    .values([
      { nombre: "Santiso", clave: "santiso", categoria: "Senior", esPropio: true },
      { nombre: "Rival", clave: "rival", categoria: "Senior" },
    ])
    .returning({ id: s.equipos.id });
  const [jornada] = await db
    .insert(s.jornadas)
    .values({ competicionId: competicion!.id, numero: 1 })
    .returning({ id: s.jornadas.id });
  const [jugado, proximo] = await db
    .insert(s.partidos)
    .values([
      {
        jornadaId: jornada!.id,
        equipoLocalId: santiso!.id,
        equipoVisitanteId: rival!.id,
        estado: "finalizado",
        golesLocal: 1,
        golesVisitante: 0,
      },
      { jornadaId: jornada!.id, equipoLocalId: rival!.id, equipoVisitanteId: santiso!.id },
    ])
    .returning({ id: s.partidos.id });
  const personas = await db
    .insert(s.jugadores)
    .values(Array.from({ length: 12 }, (_, i) => ({ nombre: `Jugador ${i + 1}` })))
    .returning({ id: s.jugadores.id });
  cerrar();
  return {
    acciones: await import("./colocacion"),
    jugadoId: jugado!.id,
    proximoId: proximo!.id,
    ids: personas.map((p) => p.id),
  };
}

describe("colocación táctica", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => {
    delete process.env.SANTISO_DATA_DIR;
    vi.restoreAllMocks();
  });

  it("guarda y recupera por momento, y guardar otra vez sustituye", async () => {
    const { acciones, proximoId, ids } = await entorno();
    expect(await acciones.cargarColocacion(proximoId, "previa")).toEqual({ ok: true, datos: null });
    const previa = { sistema: "4-4-2" as const, huecos: ids.slice(0, 11) };
    const final = { sistema: "4-3-3" as const, huecos: [...ids.slice(1, 11), null] };
    expect(await acciones.guardarColocacion(proximoId, "previa", previa)).toEqual({
      ok: true,
      datos: null,
    });
    await acciones.guardarColocacion(proximoId, "final", final);
    expect(await acciones.cargarColocacion(proximoId, "previa")).toEqual({ ok: true, datos: previa });
    expect(await acciones.cargarColocacion(proximoId, "final")).toEqual({ ok: true, datos: final });
    const otra = { sistema: "5-3-2" as const, huecos: ids.slice(1, 12) };
    await acciones.guardarColocacion(proximoId, "previa", otra);
    expect(await acciones.cargarColocacion(proximoId, "previa")).toEqual({ ok: true, datos: otra });
  });

  it("la previa de un partido jugado no cambia; la final sí", async () => {
    const { acciones, jugadoId, ids } = await entorno();
    const c = { sistema: "4-4-2" as const, huecos: ids.slice(0, 11) };
    expect(await acciones.guardarColocacion(jugadoId, "previa", c)).toMatchObject({
      ok: false,
      error: "El partido ya se jugó: su alineación no se cambia.",
    });
    expect(await acciones.guardarColocacion(jugadoId, "final", c)).toEqual({ ok: true, datos: null });
  });

  it("rechaza colocaciones imposibles y jugadores o partidos inexistentes", async () => {
    const { acciones, proximoId, ids } = await entorno();
    const c = { sistema: "4-4-2" as const, huecos: ids.slice(0, 11) };
    const mal = (x: unknown) =>
      acciones.guardarColocacion(proximoId, "previa", x as Parameters<typeof acciones.guardarColocacion>[2]);
    expect(await mal({ ...c, sistema: "2-3-5" })).toMatchObject({ ok: false });
    expect(await mal({ ...c, huecos: ids.slice(0, 10) })).toMatchObject({ ok: false });
    expect(await mal({ ...c, huecos: [ids[0], ids[0], ...ids.slice(2, 11)] })).toMatchObject({
      ok: false,
    });
    expect(await mal({ ...c, huecos: ["no-existe", ...ids.slice(1, 11)] })).toMatchObject({
      ok: false,
      error: "Algún jugador ya no existe.",
    });
    expect(
      await acciones.guardarColocacion(proximoId, "otro" as "previa", c),
    ).toMatchObject({ ok: false });
    expect(await acciones.guardarColocacion("nada", "final", c)).toMatchObject({ ok: false });
  });
});
