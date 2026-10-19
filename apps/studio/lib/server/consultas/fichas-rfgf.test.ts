import { schema as s, type ConexionDb } from "@santiso/db";
import { crearDbPrueba } from "@santiso/db/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let conexion: ConexionDb;
let consultas: typeof import("./fichas-rfgf");

const cifras = (convocados: number, goles: number) => ({
  convocados,
  titular: convocados,
  suplente: 0,
  jugados: convocados,
  amarillas: 1,
  doblesAmarillas: 0,
  rojas: 0,
  goles,
});

/** Una temporada con el Santiso, la S.D. Bandeira (con club) y el C.D. Berres, y un archivo. */
async function sembrar() {
  const { db } = conexion;
  const [temporada] = await db
    .insert(s.temporadas)
    .values({ nombre: "2026/27", activa: true })
    .returning();
  const [competicion] = await db
    .insert(s.competiciones)
    .values({ temporadaId: temporada!.id, categoria: "Senior", nombre: "Tercera Futgal" })
    .returning();
  await db.insert(s.rfgfClubes).values({
    codigo: "5258",
    nombre: "Sociedad Deportiva Bandeira",
    clave: "sociedad deportiva bandeira",
    localidad: "Bandeira",
    direccion: "Rúa do Campo s/n",
    fechaFundacion: "1972-05-01",
    camiseta: "Rayas rojas y blancas",
    pantalon: "Azul",
    medias: "Rojas",
    numeroEquipos: 3,
    leidoEn: "2026-10-18T10:00:00.000Z",
  });
  const equipo = async (nombre: string, extra = {}) =>
    (
      await db
        .insert(s.equipos)
        .values({ nombre, clave: nombre.toLowerCase(), categoria: "Senior", ...extra })
        .returning()
    )[0]!;
  const santiso = await equipo("U.D. Santiso F.C.", { esPropio: true });
  const bandeira = await equipo("S.D. Bandeira", { clubCodigo: "5258" });
  const berres = await equipo("C.D. Berres");
  await db
    .insert(s.competicionEquipos)
    .values(
      [santiso, bandeira, berres].map((e) => ({ competicionId: competicion!.id, equipoId: e.id })),
    );
  const [estadio] = await db
    .insert(s.campos)
    .values({
      nombre: "Municipal de Bandeira",
      clave: "municipal de bandeira",
      poblacion: "Silleda",
    })
    .returning();
  const [anexo] = await db
    .insert(s.campos)
    .values({ nombre: "Anexo", clave: "anexo", poblacion: null })
    .returning();
  const partidos: Record<number, string> = {};
  const jugar = async (
    numero: number,
    local: string,
    visitante: string,
    goles: [number, number] | null,
    campoId: string | null,
  ) => {
    const [jornada] = await db
      .insert(s.jornadas)
      .values({ competicionId: competicion!.id, numero })
      .onConflictDoNothing()
      .returning();
    const [p] = await db
      .insert(s.partidos)
      .values({
        jornadaId: jornada!.id,
        equipoLocalId: local,
        equipoVisitanteId: visitante,
        fecha: `2026-09-${String(numero * 7).padStart(2, "0")}T17:00`,
        golesLocal: goles?.[0] ?? null,
        golesVisitante: goles?.[1] ?? null,
        estado: goles ? "finalizado" : "programado",
        campoId,
      })
      .returning();
    partidos[numero] = p!.id;
  };
  await jugar(1, bandeira.id, santiso.id, [2, 1], estadio!.id);
  await jugar(2, santiso.id, bandeira.id, [0, 0], null);
  await jugar(3, bandeira.id, berres.id, [1, 0], estadio!.id);
  await jugar(4, berres.id, santiso.id, null, null);
  await db
    .insert(s.jornadas)
    .values({ competicionId: competicion!.id, numero: 5 })
    .returning()
    .then(async ([j]) => {
      const [p] = await db
        .insert(s.partidos)
        .values({
          jornadaId: j!.id,
          equipoLocalId: bandeira.id,
          equipoVisitanteId: berres.id,
          campoId: anexo!.id,
        })
        .returning();
      partidos[5] = p!.id;
    });

  // El archivo: un grupo de 2024-2025 con dos partidos del Santiso, y una fila de control.
  await db.insert(s.rfgfGruposHistoricos).values([
    {
      codGrupo: "300",
      categoria: "Senior",
      temporada: "2024-2025",
      competicion: "Tercera Futgal",
      grupo: "Grupo 4",
      codCompeticion: "30",
      codEquipo: "2860",
      estado: "listo",
      codActa: "700",
    },
    {
      codGrupo: "200",
      categoria: "Senior",
      temporada: "2023-2024",
      competicion: "Tercera Galicia",
      grupo: "Grupo 3",
      codCompeticion: "20",
      codEquipo: "2860",
    },
    {
      codGrupo: "sin-pasado-Senior",
      categoria: "Senior",
      temporada: "",
      competicion: "",
      grupo: "",
      codCompeticion: "",
      codEquipo: "2860",
      estado: "sin_acta",
    },
  ]);
  const [contraBandeira] = await db
    .insert(s.rfgfHistoricoPartidos)
    .values({
      codGrupo: "300",
      jornada: 3,
      fechaNominal: "2024-09-22",
      fecha: "2024-09-22T17:00",
      local: "U.D. Santiso F.C.",
      visitante: "S.D. Bandeira",
      santisoLocal: true,
      golesLocal: 3,
      golesVisitante: 1,
      codActa: "701",
      estado: "listo",
    })
    .returning();
  await db.insert(s.rfgfHistoricoPartidos).values({
    codGrupo: "300",
    jornada: 4,
    fechaNominal: "2024-09-29",
    local: "C.D. Berres",
    visitante: "U.D. Santiso F.C.",
    santisoLocal: false,
  });
  return {
    temporada: temporada!,
    competicion: competicion!,
    santiso,
    bandeira,
    berres,
    estadio: estadio!,
    partidos,
    contraBandeira: contraBandeira!,
  };
}

beforeEach(async () => {
  conexion = await crearDbPrueba();
  globalThis.santisoConexionDb = Promise.resolve(conexion);
  consultas = await import("./fichas-rfgf");
});
afterEach(() => {
  conexion?.cerrar();
  globalThis.santisoConexionDb = undefined;
});

describe("ficha de equipo", () => {
  it("junta club, campo habitual, temporada y cara a cara con el Santiso", async () => {
    const { bandeira, estadio, competicion } = await sembrar();
    const ficha = await consultas.fichaDeEquipo(bandeira.id);
    expect(ficha?.equipo).toMatchObject({ nombre: "S.D. Bandeira", categoria: "Senior" });
    expect(ficha?.club).toMatchObject({
      codigo: "5258",
      localidad: "Bandeira",
      fechaFundacion: "1972-05-01",
      numeroEquipos: 3,
      manual: false,
      equipacion: {
        camiseta: "Rayas rojas y blancas",
        pantalon: "Azul",
        medias: "Rojas",
        color: "#c8102e",
        color2: "#ffffff",
      },
    });
    expect(ficha?.campoHabitual).toEqual({
      id: estadio.id,
      nombre: "Municipal de Bandeira",
      poblacion: "Silleda",
      partidos: 2,
    });
    expect(ficha?.temporada).toHaveLength(1);
    expect(ficha?.temporada[0]).toMatchObject({ competicionId: competicion.id });
    expect(ficha?.temporada[0]!.ficha.jugados).toHaveLength(3);

    const cara = ficha!.contraSantiso;
    expect(cara.partidos.map((p) => [p.origen, p.temporada, p.jornada, p.resultado])).toEqual([
      ["temporada", "2026-2027", 2, "E"],
      ["temporada", "2026-2027", 1, "P"],
      ["archivo", "2024-2025", 3, "G"],
    ]);
    expect(cara.totales).toEqual({
      jugados: 3,
      ganados: 1,
      empatados: 1,
      perdidos: 1,
      golesFavor: 4,
      golesContra: 3,
    });
  });

  it("sin club ni partidos de local, y null si no existe", async () => {
    const { berres } = await sembrar();
    const ficha = await consultas.fichaDeEquipo(berres.id);
    expect(ficha?.club).toBeNull();
    expect(ficha?.contraSantiso.partidos.map((p) => [p.origen, p.resultado])).toEqual([
      ["temporada", null],
      ["archivo", null],
    ]);
    expect(ficha?.contraSantiso.totales.jugados).toBe(0);
    expect(await consultas.fichaDeEquipo("nadie")).toBeNull();
  });
});

describe("ficha completa de jugador", () => {
  it("todas sus temporadas con totales y los otros equipos en que se le vio", async () => {
    const { temporada, competicion, berres, partidos, contraBandeira } = await sembrar();
    const { db } = conexion;
    const [jugador] = await db
      .insert(s.jugadores)
      .values({ nombre: "Iván Sánchez Vázquez", historial: ["24/25: U.D. Santiso F.C."] })
      .returning();
    await db
      .insert(s.jugadoresTemporada)
      .values({
        temporadaId: temporada.id,
        jugadorId: jugador!.id,
        categoria: "Senior",
        dorsal: 1,
      });
    await db.insert(s.rfgfJugadores).values({
      codigo: "21",
      competicionId: competicion.id,
      jugadorId: jugador!.id,
      nombre: "SANCHEZ VAZQUEZ, IVAN",
      codActa: "900",
      cifras: cifras(4, 0),
      leidoEn: "2026-10-18T10:00:00.000Z",
    });
    await db.insert(s.rfgfHistorico).values([
      {
        jugadorId: jugador!.id,
        codGrupo: "300",
        codigo: "21",
        cifras: cifras(10, 2),
        leidoEn: "x",
      },
      { jugadorId: jugador!.id, codGrupo: "200", codigo: "21" },
    ]);
    // Visto con el Berres esta temporada (alineación y un gol en la misma acta) …
    await db.insert(s.ligaAlineaciones).values({
      partidoId: partidos[3]!,
      equipoId: berres.id,
      persona: "Iván Sánchez Vázquez",
      personaClave: "ivan sanchez vazquez",
      titular: true,
    });
    await db.insert(s.ligaEventos).values({
      partidoId: partidos[3]!,
      equipoId: berres.id,
      persona: "Iván Sánchez Vázquez",
      personaClave: "ivan sanchez vazquez",
      tipo: "gol",
    });
    // … y con la Bandeira en el archivo; en el lado del Santiso no cuenta.
    await db.insert(s.rfgfHistoricoAlineaciones).values([
      {
        partidoId: contraBandeira.id,
        lado: "visitante",
        persona: "Iván Sánchez Vázquez",
        personaClave: "ivan sanchez vazquez",
        titular: false,
      },
      {
        partidoId: contraBandeira.id,
        lado: "local",
        persona: "Iván Sánchez Vázquez",
        personaClave: "ivan sanchez vazquez",
        titular: true,
      },
    ]);

    const ficha = await consultas.fichaCompletaDeJugador(jugador!.id);
    expect(ficha?.jugador).toMatchObject({
      nombre: "Iván Sánchez Vázquez",
      codigosRfgf: ["21"],
      inscripciones: [{ temporada: "2026/27", categoria: "Senior", dorsal: 1 }],
    });
    expect(ficha?.actual).toHaveLength(1);
    expect(ficha?.temporadas.map((t) => [t.temporada, t.grupos.length, t.total.goles])).toEqual([
      ["2026-2027", 1, 0],
      ["2024-2025", 1, 2],
      ["2023-2024", 1, 0],
    ]);
    expect(ficha?.temporadas[0]!.grupos[0]).toMatchObject({
      origen: "actual",
      cifras: cifras(4, 0),
    });
    expect(ficha?.total).toMatchObject({ convocados: 14, goles: 2, amarillas: 2 });
    expect(ficha?.porLeer).toBe(1);
    expect(ficha?.clubesVistos).toEqual([
      {
        temporada: "2026-2027",
        competicion: "Tercera Futgal",
        equipo: "C.D. Berres",
        equipoId: berres.id,
        alineaciones: 1,
        eventos: 1,
      },
      {
        temporada: "2024-2025",
        competicion: "Tercera Futgal",
        equipo: "S.D. Bandeira",
        equipoId: null,
        alineaciones: 1,
        eventos: 0,
      },
    ]);
    expect(await consultas.fichaCompletaDeJugador("nadie")).toBeNull();
  });

  it("un nombre de una sola palabra no sirve para buscarle en actas", () => {
    expect(consultas.clavesDeJugador("Rubén", [])).toEqual([]);
    expect(consultas.clavesDeJugador("Rubén", ["PEREZ LOPEZ, RUBEN"])).toEqual([
      "ruben perez lopez",
    ]);
  });
});

describe("archivo de temporadas pasadas", () => {
  it("temporada → grupos → partidos, sin filas de control", async () => {
    await sembrar();
    const archivo = await consultas.archivoHistorico();
    expect(archivo.map((t) => t.temporada)).toEqual(["2024-2025", "2023-2024"]);
    const [grupo] = archivo[0]!.grupos;
    expect(grupo).toMatchObject({ codGrupo: "300", estado: "listo", jugadores: 0 });
    expect(grupo!.partidos.map((p) => [p.jornada, p.resultado, p.estado])).toEqual([
      [3, "G", "listo"],
      [4, null, "pendiente"],
    ]);
    expect(grupo!.partidos[0]!.enlaceActa).toContain("CodActa=701");
    expect(grupo!.partidos[1]!.enlaceActa).toBeNull();
    expect(archivo[1]!.grupos[0]!.archivo.texto).toBe("Sin pedir");
  });
});
