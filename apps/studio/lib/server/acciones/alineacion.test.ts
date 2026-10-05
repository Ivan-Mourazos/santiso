import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** BD con dos partidos del Santiso (uno jugado, uno por jugar) y una plantilla de 13. */
async function entorno() {
  const dir = mkdtempSync(path.join(tmpdir(), "santiso-alineacion-"));
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
      { nombre: "U.D. Santiso F.C.", clave: "santiso", categoria: "Senior", esPropio: true },
      { nombre: "C.D. Berres", clave: "berres", categoria: "Senior", color: "#d32f2f" },
    ])
    .returning({ id: s.equipos.id });
  const jornadas = await db
    .insert(s.jornadas)
    .values([
      { competicionId: competicion!.id, numero: 1 },
      { competicionId: competicion!.id, numero: 2 },
    ])
    .returning({ id: s.jornadas.id });
  const [jugado, proximo] = await db
    .insert(s.partidos)
    .values([
      {
        jornadaId: jornadas[0]!.id,
        equipoLocalId: santiso!.id,
        equipoVisitanteId: rival!.id,
        fecha: "2026-09-27T18:00",
        estado: "finalizado",
        golesLocal: 1,
        golesVisitante: 0,
      },
      {
        jornadaId: jornadas[1]!.id,
        equipoLocalId: rival!.id,
        equipoVisitanteId: santiso!.id,
        fecha: "2026-10-11T17:00",
      },
    ])
    .returning({ id: s.partidos.id });
  const personas = await db
    .insert(s.jugadores)
    .values(Array.from({ length: 13 }, (_, i) => ({ nombre: `Jugador ${i + 1}` })))
    .returning({ id: s.jugadores.id });
  await db.insert(s.jugadoresTemporada).values(
    personas.map((p, i) => ({
      temporadaId: temporada!.id,
      jugadorId: p.id,
      categoria: "Senior" as const,
      dorsal: i + 1,
      capitania: i === 3 ? 1 : null,
    })),
  );
  cerrar();
  return {
    acciones: await import("./alineacion"),
    jugadoId: jugado!.id,
    proximoId: proximo!.id,
    ids: personas.map((p) => p.id),
  };
}

describe("alineación anunciada", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 5, 12, 0));
  });
  afterEach(() => {
    delete process.env.SANTISO_DATA_DIR;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("propone el próximo partido por jugar, con la plantilla por dorsal y su capitán", async () => {
    const { acciones, proximoId } = await entorno();
    const pantalla = await acciones.cargarPantallaAlineacion("Senior");
    if (!pantalla.ok) throw new Error(pantalla.error);
    expect(pantalla.datos.partidoId).toBe(proximoId);
    expect(pantalla.datos.partidos).toHaveLength(1);
    expect(pantalla.datos.partidos[0]).toMatchObject({
      santisoLocal: false,
      jornada: 2,
      rival: { nombre: "C.D. Berres", color: "#d32f2f" },
      finalizado: false,
    });
    expect(pantalla.datos.jugadores.map((j) => j.dorsal)).toEqual(
      Array.from({ length: 13 }, (_, i) => i + 1),
    );
    expect(pantalla.datos.jugadores.filter((j) => j.capitan).map((j) => j.dorsal)).toEqual([4]);
    expect(pantalla.datos.alineacion).toEqual({ titulares: [], suplentes: [], capitanId: null });
  });

  it("guarda y recupera la alineación en su orden, sin crear convocatoria de acta", async () => {
    const { acciones, proximoId, ids } = await entorno();
    const alineacion = {
      titulares: ids.slice(0, 11),
      suplentes: [ids[12]!, ids[11]!],
      capitanId: ids[3]!,
    };
    expect(await acciones.guardarAlineacion(proximoId, alineacion)).toEqual({
      ok: true,
      datos: null,
    });
    const pantalla = await acciones.cargarPantallaAlineacion("Senior", proximoId);
    expect(pantalla.ok && pantalla.datos.alineacion).toEqual(alineacion);

    const bd = await import("@santiso/db");
    const { db } = await (await import("@/lib/server/db")).obtenerDb();
    expect(await db.select().from(bd.schema.partidoParticipaciones)).toHaveLength(0);

    // Guardar otra vez sustituye, no acumula.
    await acciones.guardarAlineacion(proximoId, { ...alineacion, suplentes: [] });
    const otra = await acciones.cargarPantallaAlineacion("Senior", proximoId);
    expect(otra.ok && otra.datos.alineacion.suplentes).toEqual([]);
  });

  it("no cambia un partido ya jugado ni acepta alineaciones imposibles", async () => {
    const { acciones, jugadoId, proximoId, ids } = await entorno();
    const once = { titulares: ids.slice(0, 11), suplentes: [], capitanId: null };
    expect(await acciones.guardarAlineacion(jugadoId, once)).toMatchObject({
      ok: false,
      error: "El partido ya se jugó: su alineación no se cambia.",
    });
    expect(
      await acciones.guardarAlineacion(proximoId, { ...once, titulares: ids.slice(0, 12) }),
    ).toMatchObject({ ok: false });
    expect(
      await acciones.guardarAlineacion(proximoId, { ...once, titulares: ["no-existe"] }),
    ).toMatchObject({ ok: false, error: "Algún jugador ya no existe." });
    expect(await acciones.guardarAlineacion("nada", once)).toMatchObject({ ok: false });
  });

  it("un partido jugado pedido a propósito se enseña, marcado como finalizado", async () => {
    const { acciones, jugadoId } = await entorno();
    const pantalla = await acciones.cargarPantallaAlineacion("Senior", jugadoId);
    if (!pantalla.ok) throw new Error(pantalla.error);
    expect(pantalla.datos.partidoId).toBe(jugadoId);
    expect(pantalla.datos.partidos.map((p) => p.finalizado)).toEqual([true, false]);
  });
});
