import { readFileSync } from "node:fs";
import path from "node:path";
import { schema as s, type ConexionDb } from "@santiso/db";
import { crearDbPrueba } from "@santiso/db/testing";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { personaDeActa } from "@/lib/liga/eventos";
import type { DescargadorRfgf } from "./descargador";

vi.mock("@/lib/server/acceso/permisos", () => ({ soloAdmin: async () => null }));

const ENLACE =
  "https://www.futgal.es/pnfg/NPcd/NFG_VisCalendario_Vis?cod_primaria=1000120&codtemporada=22&codcompeticion=30&codgrupo=300";
const AHORA = new Date("2026-10-19T12:00:00Z");
const PDF = new Uint8Array(
  readFileSync(path.resolve(__dirname, "../../../../../packages/actas/src/fixtures/senior-1.pdf")),
);
const fila = (codigo: string, nombre: string) =>
  `<tr onclick="location.href='NFG_EstadisticasJugador?cod_primaria=5000274&jugador=${codigo}&codacta=901&nueva_ventana=';"> <td>1</td> <td> ${nombre}</td> </tr>`;
/** La página web del acta 901: el Santiso juega de local, su bloque va primero. */
const PAGINA_901 = `<html><body><strong>Titulares</strong><table>${fila("21", "PEREZ, XAN")}${fila("22", "GARCIA LOPEZ, ANTON")}</table>
<strong>Titulares</strong><table>${fila("31", "RIVAL UNO, PEPE")}</table></body></html>`;

let conexion: ConexionDb;

function descargador(): DescargadorRfgf & { pedidas: string[] } {
  const pedidas: string[] = [];
  return {
    pedidas,
    html: vi.fn(async (url: string) => {
      pedidas.push(url);
      if (url.includes("CodActa=901")) return PAGINA_901;
      throw new Error(`No se esperaba ${url}`);
    }),
    pdf: vi.fn(async (url: string) => {
      pedidas.push(url);
      return PDF;
    }),
  };
}

async function sembrar() {
  const { db } = conexion;
  const [temporada] = await db
    .insert(s.temporadas)
    .values({ nombre: "2026/27", activa: true })
    .returning();
  const [competicion] = await db
    .insert(s.competiciones)
    .values({ temporadaId: temporada!.id, categoria: "Senior", nombre: "Tercera" })
    .returning();
  await db.insert(s.rfgfCompeticiones).values({ competicionId: competicion!.id, enlace: ENLACE });
  const equipo = async (nombre: string, esPropio = false) =>
    (
      await db
        .insert(s.equipos)
        .values({ nombre, clave: nombre.toLowerCase(), categoria: "Senior", esPropio })
        .returning()
    )[0]!;
  const santiso = await equipo("U.D. Santiso F.C.", true);
  const rival = await equipo("Atlético Eter");
  const otroA = await equipo("S.D. Touro");
  const otroB = await equipo("C.D. Berres");
  const partido = async (numero: number, local: string, visitante: string, fecha: string) => {
    const [jornada] = await db
      .insert(s.jornadas)
      .values({ competicionId: competicion!.id, numero })
      .onConflictDoUpdate({
        target: [s.jornadas.competicionId, s.jornadas.numero],
        set: { numero },
      })
      .returning();
    const [p] = await db
      .insert(s.partidos)
      .values({
        jornadaId: jornada!.id,
        equipoLocalId: local,
        equipoVisitanteId: visitante,
        fecha,
        golesLocal: 1,
        golesVisitante: 0,
        estado: "finalizado",
      })
      .returning();
    return p!;
  };
  const p1 = await partido(1, santiso.id, rival.id, "2026-09-14T17:00");
  const p2 = await partido(1, otroA.id, otroB.id, "2026-09-14T17:00");
  const p3 = await partido(2, rival.id, santiso.id, "2026-09-21T17:00");
  await db.insert(s.rfgfActas).values([
    { codActa: "901", competicionId: competicion!.id, partidoId: p1.id, estado: "guardada" },
    { codActa: "902", competicionId: competicion!.id, partidoId: p2.id, estado: "resultado" },
    {
      codActa: "903",
      competicionId: competicion!.id,
      partidoId: p3.id,
      estado: "guardada",
      jugadoresEn: "2026-09-22T10:00:00.000Z",
    },
  ]);
  // El 903 ya tiene sus alineaciones: no se relee.
  await db.insert(s.ligaAlineaciones).values([
    {
      partidoId: p3.id,
      equipoId: santiso.id,
      persona: "Anton Garcia Lopez",
      personaClave: "anton garcia lopez",
      dorsal: 14,
      titular: true,
    },
    {
      partidoId: p3.id,
      equipoId: rival.id,
      persona: "Pepe Rival Uno",
      personaClave: "pepe rival uno",
      dorsal: 7,
      titular: true,
    },
  ]);
  await db.insert(s.ligaEventos).values({
    partidoId: p3.id,
    equipoId: rival.id,
    persona: "Pepe Rival Uno",
    personaClave: "pepe rival uno",
    tipo: "gol",
  });
  const [xan, nadie] = await db
    .insert(s.jugadores)
    .values([{ nombre: "Xan Pérez" }, { nombre: "Nadie Inscrito" }])
    .returning();
  await db.insert(s.jugadoresTemporada).values([
    { temporadaId: temporada!.id, jugadorId: xan!.id, categoria: "Senior", dorsal: 9 },
    { temporadaId: temporada!.id, jugadorId: nadie!.id, categoria: "Senior", dorsal: 5 },
  ]);
  return { competicion: competicion!, santiso, rival, p1, p2, p3, xan: xan!, nadie: nadie! };
}

beforeEach(async () => {
  conexion = await crearDbPrueba();
  globalThis.santisoConexionDb = Promise.resolve(conexion);
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Red prohibida en pruebas");
    }),
  );
});
afterEach(() => {
  conexion?.cerrar();
  globalThis.santisoConexionDb = undefined;
  globalThis.santisoRedRfgfEnMarcha = false;
  vi.unstubAllGlobals();
});

describe("repaso de las actas de la temporada", () => {
  it("dos páginas por pasada: jugadores del club, alineaciones propias y luego el resto", async () => {
    const { p1, p2, santiso, rival, xan } = await sembrar();
    const { avanzarRepasoActas, pendientesRepasoActas } = await import("./repaso-actas");
    expect(await pendientesRepasoActas()).toEqual({
      jugadores: 1,
      alineacionesPropias: 1,
      alineacionesResto: 1,
    });

    const red = descargador();
    const primera = await avanzarRepasoActas(red, AHORA);
    expect(primera).toMatchObject({ paginas: 2, jugadores: 1, alineaciones: 1, errores: [] });
    expect(red.pedidas).toEqual([
      expect.stringMatching(/CodActa=901(?!.*NPcd_Pdf)/u),
      expect.stringMatching(/CodActa=901.*NPcd_Pdf=1/u),
    ]);
    const { db } = conexion;
    const jugadores = await db.select().from(s.rfgfJugadores);
    // Solo los del lado del club, y reconocidos sin duda o sin enlazar.
    expect(jugadores.map((j) => [j.codigo, j.jugadorId])).toEqual([
      ["21", xan.id],
      ["22", null],
    ]);
    const deP1 = await db
      .select()
      .from(s.ligaAlineaciones)
      .where(eq(s.ligaAlineaciones.partidoId, p1.id));
    expect(new Set(deP1.map((a) => a.equipoId))).toEqual(new Set([santiso.id, rival.id]));

    const segunda = await avanzarRepasoActas(red, AHORA);
    expect(segunda).toMatchObject({ paginas: 1, jugadores: 0, alineaciones: 1 });
    expect(
      (await db.select().from(s.ligaAlineaciones).where(eq(s.ligaAlineaciones.partidoId, p2.id)))
        .length,
    ).toBeGreaterThan(0);

    // Al día: no se vuelve a pedir nada, tampoco lo que ya tenía alineaciones (903).
    expect(await avanzarRepasoActas(red, AHORA)).toMatchObject({ paginas: 0 });
    expect(red.pedidas).toHaveLength(3);
    expect(await pendientesRepasoActas()).toEqual({
      jugadores: 0,
      alineacionesPropias: 0,
      alineacionesResto: 0,
    });
  });

  it("un fallo de red no marca nada y deja pasar a las demás", async () => {
    await sembrar();
    const { avanzarRepasoActas } = await import("./repaso-actas");
    const red = descargador();
    vi.mocked(red.html).mockRejectedValue(new Error("caída"));
    const resumen = await avanzarRepasoActas(red, AHORA);
    expect(resumen.errores).toEqual(["Acta 901: caída"]);
    // La segunda página fue a otra tarea: las alineaciones del mismo partido.
    expect(resumen).toMatchObject({ paginas: 2, alineaciones: 1 });
    const [acta] = await conexion.db
      .select()
      .from(s.rfgfActas)
      .where(eq(s.rfgfActas.codActa, "901"));
    expect(acta).toMatchObject({ jugadoresEn: null });
  });

  it("no pide nada con otra operación con la federación en marcha", async () => {
    await sembrar();
    const { avanzarRepasoActas } = await import("./repaso-actas");
    globalThis.santisoRedRfgfEnMarcha = true;
    const red = descargador();
    expect(await avanzarRepasoActas(red, AHORA)).toMatchObject({ paginas: 0 });
    expect(red.pedidas).toEqual([]);
  });
});

describe("plantilla frente a las actas", () => {
  it("dice quién juega sin estar en la plantilla y quién está sin jugar, y lo da de alta", async () => {
    const { competicion, nadie, xan } = await sembrar();
    const { db } = conexion;
    await db.insert(s.rfgfJugadores).values([
      {
        codigo: "21",
        competicionId: competicion.id,
        jugadorId: null,
        nombre: "PEREZ, XAN",
        codActa: "901",
      },
      {
        codigo: "22",
        competicionId: competicion.id,
        jugadorId: null,
        nombre: "GARCIA LOPEZ, ANTON",
        codActa: "903",
      },
    ]);
    const { plantillaFrenteActas } = await import("@/lib/server/consultas/plantilla-actas");
    expect(await plantillaFrenteActas("Senior")).toEqual({
      enActasSinPlantilla: [
        {
          nombre: "GARCIA LOPEZ, ANTON",
          codigo: "22",
          dorsales: [14],
          partidos: 1,
          titular: 1,
          ultimaFecha: "2026-09-21T17:00",
        },
      ],
      // Xan sale por su nombre aunque su código aún no esté enlazado.
      enPlantillaSinActas: [{ jugadorId: nadie.id, nombre: "Nadie Inscrito", dorsal: 5 }],
    });

    const { anadirJugadorDesdeActa, cargarPlantillaFrenteActas } =
      await import("@/lib/server/acciones/plantilla-actas");
    const alta = await anadirJugadorDesdeActa("Senior", "22");
    expect(alta).toMatchObject({
      ok: true,
      datos: { nombre: personaDeActa("GARCIA LOPEZ, ANTON"), dorsal: 14, existia: false },
    });
    if (!alta.ok) return;
    const [inscripcion] = await db
      .select()
      .from(s.jugadoresTemporada)
      .where(eq(s.jugadoresTemporada.jugadorId, alta.datos.jugadorId));
    expect(inscripcion).toMatchObject({ categoria: "Senior", dorsal: 14 });
    const [enlazado] = await db
      .select()
      .from(s.rfgfJugadores)
      .where(eq(s.rfgfJugadores.codigo, "22"));
    expect(enlazado!.jugadorId).toBe(alta.datos.jugadorId);
    expect(await cargarPlantillaFrenteActas("Senior")).toMatchObject({
      ok: true,
      datos: { enActasSinPlantilla: [] },
    });
    expect(await anadirJugadorDesdeActa("Senior", "22")).toMatchObject({ ok: false });
    expect(await anadirJugadorDesdeActa("Senior", "99")).toMatchObject({ ok: false });
    expect(await anadirJugadorDesdeActa("Juvenil", "22")).toMatchObject({ ok: false });
    expect(xan.id).toBeTruthy();
  });

  it("reutiliza a la persona si ya existía de otra temporada", async () => {
    const { competicion } = await sembrar();
    const { db } = conexion;
    const [antiguo] = await db
      .insert(s.jugadores)
      .values({ nombre: personaDeActa("GARCIA LOPEZ, ANTON") })
      .returning();
    await db.insert(s.rfgfJugadores).values({
      codigo: "22",
      competicionId: competicion.id,
      nombre: "GARCIA LOPEZ, ANTON",
      codActa: "903",
    });
    const { anadirJugadorDesdeActa } = await import("@/lib/server/acciones/plantilla-actas");
    expect(await anadirJugadorDesdeActa("Senior", "22")).toMatchObject({
      ok: true,
      datos: { jugadorId: antiguo!.id, existia: true },
    });
    expect(await db.select().from(s.jugadores)).toHaveLength(3);
  });
});

describe("jugadores vistos de un rival", () => {
  it("dorsal, partidos, titularidades y goles de la temporada activa", async () => {
    const { rival } = await sembrar();
    const { jugadoresVistosDeEquipo, fichaDeEquipo } =
      await import("@/lib/server/consultas/fichas-rfgf");
    const vistos = await jugadoresVistosDeEquipo(rival.id);
    expect(vistos).toEqual([
      {
        persona: "Pepe Rival Uno",
        dorsal: 7,
        partidos: 1,
        titular: 1,
        goles: 1,
        amarillas: 0,
        rojas: 0,
      },
    ]);
    expect((await fichaDeEquipo(rival.id))?.jugadoresVistos).toEqual(vistos);
  });
});
