import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** BD con temporada activa, un jugador y un entrenador. */
async function entorno() {
  const dir = mkdtempSync(path.join(tmpdir(), "santiso-multas-"));
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
  const [jugador] = await db
    .insert(s.jugadores)
    .values({ nombre: "Brais Rei", apodo: "Bareto" })
    .returning({ id: s.jugadores.id });
  await db.insert(s.jugadoresTemporada).values({
    temporadaId: temporada!.id,
    jugadorId: jugador!.id,
    categoria: "Senior",
    dorsal: 9,
  });
  const [mister] = await db
    .insert(s.staff)
    .values({ nombre: "Manuel Adestrador" })
    .returning({ id: s.staff.id });
  await db.insert(s.staffTemporada).values({
    temporadaId: temporada!.id,
    staffId: mister!.id,
    tipo: "tecnico",
    categoria: "Senior",
    cargo: "Entrenador",
  });
  cerrar();
  return {
    acciones: await import("./multas"),
    jugador: `jugador:${jugador!.id}`,
    mister: `staff:${mister!.id}`,
  };
}

describe("multas del club", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 6, 12, 0));
  });
  afterEach(() => {
    delete process.env.SANTISO_DATA_DIR;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function pantalla(acciones: Awaited<ReturnType<typeof entorno>>["acciones"]) {
    const r = await acciones.cargarPantallaMultas();
    if (!r.ok) throw new Error(r.error);
    return r.datos;
  }

  it("la primera vez carga las normas del club, una sola vez, y la gente de la temporada", async () => {
    const { acciones } = await entorno();
    const primera = await pantalla(acciones);
    expect(primera.conceptos).toHaveLength(13);
    expect(primera.conceptos.filter((c) => c.grupo === "partido")).toHaveLength(11);
    expect(primera.personas.map((p) => [p.nombre, p.detalle, p.adestrador])).toEqual([
      ["Brais Rei (Bareto)", "Senior · 9", false],
      ["Manuel Adestrador", "Senior · Entrenador", true],
    ]);
    expect((await pantalla(acciones)).conceptos).toHaveLength(13);
  });

  it("pone multas con el importe de las normas: doble al entrenador, por unidad la prenda", async () => {
    const { acciones, jugador, mister } = await entorno();
    const { conceptos } = await pantalla(acciones);
    const id = (nombre: string, grupo = "partido") =>
      conceptos.find((c) => c.nombre === nombre && c.grupo === grupo)!.id;
    const base = { unidades: 1, fecha: "2026-10-05" };

    expect(
      await acciones.ponerMulta({
        ...base,
        personaClave: jugador,
        conceptoId: id("Chegar tarde (inxustificado)"),
      }),
    ).toEqual({ ok: true, datos: null });
    await acciones.ponerMulta({
      ...base,
      personaClave: mister,
      conceptoId: id("Tarxeta amarela (protesta, etc.)"),
      nota: "  protestou  ",
    });
    await acciones.ponerMulta({
      ...base,
      personaClave: jugador,
      conceptoId: id("Non traer material"),
      unidades: 1,
      opciones: ["Medias 1ª", "Peto", "Algo que no existe"],
      fecha: "2026-10-04",
    });
    // Importe a mano: manda sobre las normas.
    await acciones.ponerMulta({
      ...base,
      personaClave: jugador,
      conceptoId: id("Non ir no bus"),
      importeCentimos: 1000,
      fecha: "2026-10-03",
    });

    const { multas } = await pantalla(acciones);
    expect(multas.map((m) => [m.persona, m.concepto, m.importeCentimos, m.nota])).toEqual([
      ["Manuel Adestrador", "Tarxeta amarela (protesta, etc.)", 600, "protestou"],
      // «Chegar tarde» existe en los dos grupos: este es el de partido (1,50 €).
      ["Brais Rei", "Chegar tarde (inxustificado)", 150, null],
      ["Brais Rei", "Non traer material: Medias 1ª, Peto", 200, null],
      ["Brais Rei", "Non ir no bus", 1000, null],
    ]);
  });

  it("valida persona, motivo, fecha e importe", async () => {
    const { acciones, jugador } = await entorno();
    const { conceptos } = await pantalla(acciones);
    const buena = {
      personaClave: jugador,
      conceptoId: conceptos[0]!.id,
      unidades: 1,
      fecha: "2026-10-05",
    };
    expect(await acciones.ponerMulta({ ...buena, personaClave: "" })).toMatchObject({ ok: false });
    expect(await acciones.ponerMulta({ ...buena, personaClave: "jugador:nadie" })).toMatchObject({
      ok: false,
      error: "Esa persona no está en la plantilla de esta temporada.",
    });
    expect(await acciones.ponerMulta({ ...buena, conceptoId: "nada" })).toMatchObject({
      ok: false,
    });
    expect(await acciones.ponerMulta({ ...buena, fecha: "ayer" })).toMatchObject({ ok: false });
    expect(await acciones.ponerMulta({ ...buena, importeCentimos: 0 })).toMatchObject({
      ok: false,
    });
    expect((await pantalla(acciones)).multas).toEqual([]);
  });

  it("cobrar pone la fecha de hoy, se puede deshacer, y quitar la borra", async () => {
    const { acciones, jugador } = await entorno();
    const { conceptos } = await pantalla(acciones);
    await acciones.ponerMulta({
      personaClave: jugador,
      conceptoId: conceptos[0]!.id,
      unidades: 1,
      fecha: "2026-10-05",
    });
    const [multa] = (await pantalla(acciones)).multas;
    expect(multa?.pagadaEn).toBeNull();

    await acciones.cambiarPagoMulta(multa!.id, true);
    expect((await pantalla(acciones)).multas[0]?.pagadaEn).toBe("2026-10-06");
    await acciones.cambiarPagoMulta(multa!.id, false);
    expect((await pantalla(acciones)).multas[0]?.pagadaEn).toBeNull();

    await acciones.quitarMulta(multa!.id);
    expect((await pantalla(acciones)).multas).toEqual([]);
  });

  it("el catálogo se edita sin tocar las multas ya puestas y no admite repetidos", async () => {
    const { acciones, jugador } = await entorno();
    const { conceptos } = await pantalla(acciones);
    const bus = conceptos.find((c) => c.nombre === "Non ir no bus")!;
    await acciones.ponerMulta({
      personaClave: jugador,
      conceptoId: bus.id,
      unidades: 1,
      fecha: "2026-10-05",
    });

    expect(
      await acciones.guardarConcepto({ ...bus, nombre: "Non ir no autobús", importeCentimos: 2500 }),
    ).toEqual({ ok: true, datos: null });
    expect(
      await acciones.guardarConcepto({
        nombre: "vir en mal estado",
        grupo: "partido",
        importeCentimos: 100,
        porUnidad: false,
        activo: true,
      }),
    ).toMatchObject({ ok: false, error: "Ya hay un concepto con ese nombre en ese grupo." });
    expect(
      await acciones.guardarConcepto({
        nombre: "Móbil no vestiario",
        grupo: "partido",
        importeCentimos: 200,
        porUnidad: false,
        activo: true,
      }),
    ).toEqual({ ok: true, datos: null });

    const despues = await pantalla(acciones);
    expect(despues.conceptos).toHaveLength(14);
    expect(despues.conceptos.find((c) => c.id === bus.id)).toMatchObject({
      nombre: "Non ir no autobús",
      importeCentimos: 2500,
    });
    expect(despues.multas[0]).toMatchObject({ concepto: "Non ir no bus", importeCentimos: 2000 });
  });
});
