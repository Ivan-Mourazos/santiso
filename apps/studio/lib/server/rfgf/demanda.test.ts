// Clasificaciones se ejercitan con su presupuesto real en historico-clasificaciones.test.ts.
vi.mock("./historico-clasificaciones", () => ({ avanzarClasificacionesSinCandado: async () => 0 }));
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, expect, it, vi } from "vitest";
import type { DescargadorRfgf } from "./descargador";

const FICHA = new Uint8Array(
  readFileSync(path.resolve(__dirname, "../../../../../packages/actas/src/fixtures/senior-1.pdf")),
);
const ENLACE =
  "https://www.futgal.es/pnfg/NPcd/NFG_VisCalendario_Vis?cod_primaria=1000120&codtemporada=22&codcompeticion=30&codgrupo=300";
const AHORA = new Date(2026, 9, 17, 12);
const cifras = {
  convocados: 1,
  titular: 1,
  suplente: 0,
  jugados: 1,
  amarillas: 0,
  doblesAmarillas: 0,
  rojas: 0,
  goles: 0,
};
const oficial = (equipo: string, puntos: number, golesFavor: number, golesContra: number) => ({
  posicion: 1,
  equipo,
  puntos,
  jugados: 1,
  ganados: 0,
  empatados: 0,
  perdidos: 0,
  golesFavor,
  golesContra,
  sancion: 0,
});
const simulacion = vi.hoisted(() => ({ oficial: [] as import("@santiso/actas").FilaOficial[] }));
vi.mock("@santiso/actas", async (original) => {
  const real = await original<typeof import("@santiso/actas")>();
  return {
    ...real,
    parsearJornadaPdf: async (bytes: Uint8Array) =>
      real.parsearJornada(new TextDecoder().decode(bytes)),
    parsearClasificacionPdf: async () => ({
      competicion: "Tercera",
      jornada: 1,
      filas: simulacion.oficial,
    }),
  };
});
const anterior = process.env.SANTISO_DATA_DIR;
afterEach(async () => {
  (await globalThis.santisoConexionDb)?.cerrar();
  globalThis.santisoConexionDb = undefined;
  if (anterior === undefined) delete process.env.SANTISO_DATA_DIR;
  else process.env.SANTISO_DATA_DIR = anterior;
  simulacion.oficial = [];
  vi.restoreAllMocks();
});

async function preparar() {
  process.env.SANTISO_DATA_DIR = mkdtempSync(path.join(tmpdir(), "santiso-demanda-"));
  vi.resetModules();
  const bd = await import("@santiso/db");
  const conexion = await bd.abrirDb(
    bd.urlArchivo(path.join(process.env.SANTISO_DATA_DIR, "santiso.db")),
  );
  await bd.migrarBd(conexion.db);
  globalThis.santisoConexionDb = Promise.resolve(conexion);
  const { db } = conexion,
    s = bd.schema;
  const [t] = await db.insert(s.temporadas).values({ nombre: "2026/27", activa: true }).returning();
  const [c] = await db
    .insert(s.competiciones)
    .values({ temporadaId: t!.id, nombre: "Tercera", categoria: "Senior" })
    .returning();
  const [local, visitante] = await db
    .insert(s.equipos)
    .values([
      { nombre: "Equipo Local", clave: "equipo local", categoria: "Senior" },
      { nombre: "Equipo Visitante", clave: "equipo visitante", categoria: "Senior" },
    ])
    .returning();
  await db
    .insert(s.competicionEquipos)
    .values([local!, visitante!].map((e) => ({ competicionId: c!.id, equipoId: e.id })));
  const jornadas = await db
    .insert(s.jornadas)
    .values([1, 2, 3, 4, 5].map((numero) => ({ competicionId: c!.id, numero })))
    .returning();
  const partidos = await db
    .insert(s.partidos)
    .values(
      jornadas.map((j, i) => ({
        jornadaId: j.id,
        equipoLocalId: local!.id,
        equipoVisitanteId: visitante!.id,
        fecha: i < 2 ? "2026-10-10T12:00" : "2026-11-10T12:00",
      })),
    )
    .returning();
  await db.insert(s.rfgfCompeticiones).values({ competicionId: c!.id, enlace: ENLACE });
  return { db, s, competicionId: c!.id, partidos, jornadas, temporadaId: t!.id };
}

const pagina = (codActa: string | null = "900") =>
  `<a href="NFG_VisEquipos?Codigo_Equipo=1">EQUIPO LOCAL</a>${codActa ? `<a href="NFG_CmpPartido?CodActa=${codActa}"></a>` : ""}<a href="NFG_VisEquipos?Codigo_Equipo=2">EQUIPO VISITANTE</a>`;
function descargadorDe(codActa: string | null = "900") {
  const urls: string[] = [];
  const descargador: DescargadorRfgf = {
    async html(url) {
      urls.push(url);
      return pagina(codActa);
    },
    async pdf(url) {
      urls.push(url);
      const n = Number(new URL(url).searchParams.get("CodJornada"));
      return url.includes("NFG_CmpJornada")
        ? new TextEncoder().encode(
            `TERCERA Temporada 2026-2027\nJornada ${n}\nResultados\nEQUIPO LOCAL\n8 - 2\n10-10-2026\n12:00\nEQUIPO VISITANTE\nCampo: Campo Pendiente de asignar\nREAL FEDERACIÓN`,
          )
        : FICHA;
    },
  };
  return { descargador, urls };
}

it("estado sin red: distingue jornadas completas, incompletas, por jugar y cuenta cifras de plantilla", async () => {
  const { db, s, competicionId, partidos, temporadaId } = await preparar();
  await db
    .update(s.partidos)
    .set({ golesLocal: 8, golesVisitante: 2, estado: "finalizado" })
    .where(eq(s.partidos.id, partidos[0]!.id));
  await db.insert(s.rfgfActas).values({
    codActa: "900",
    competicionId,
    partidoId: partidos[0]!.id,
    estado: "resultado",
    eventos: true,
  });
  const [j] = await db.insert(s.jugadores).values({ nombre: "Persona Prueba" }).returning();
  await db
    .insert(s.jugadoresTemporada)
    .values({ jugadorId: j!.id, temporadaId, categoria: "Senior" });
  await db.insert(s.rfgfJugadores).values([
    {
      codigo: "1",
      jugadorId: j!.id,
      nombre: "PERSONA",
      competicionId,
      codActa: "900",
      cifras,
      leidoEn: "2026-10-12T10:00:00.000Z",
    },
    {
      codigo: "2",
      nombre: "SIN ENLAZAR",
      competicionId,
      codActa: "900",
      cifras,
      leidoEn: "2026-10-16T10:00:00.000Z",
    },
  ]);
  const { estadoFederacion } = await import("./estado");
  const estado = await estadoFederacion(competicionId, AHORA);
  expect(estado!.jornadas.map((j) => j.estado)).toEqual([
    "completa",
    "incompleta",
    "por_jugar",
    "por_jugar",
    "por_jugar",
  ]);
  expect(estado!.jornadas[0]).toMatchObject({
    partidos: 1,
    conResultado: 1,
    conActaTratada: 1,
    pendientes: 0,
  });
  expect(estado!.jornadas[1]).toMatchObject({ pendientes: 1 });
  expect(estado!.jornadas[0]!.encuentros[0]).toMatchObject({
    acta: { estado: "resultado" },
    marcador: [8, 2],
  });
  expect(estado!.jugadores).toEqual({
    plantilla: 1,
    conCifras: 1,
    lecturaMasAntigua: "2026-10-12T10:00:00.000Z",
    lecturaMasReciente: "2026-10-12T10:00:00.000Z",
  });
});

it("traer jornada solo descarga su PDF y sus actas; las buenas no se repiten", async () => {
  const { competicionId } = await preparar();
  const { traerJornada } = await import("./demanda");
  const { descargador, urls } = descargadorDe();
  expect(await traerJornada(competicionId, 1, descargador, AHORA)).toMatchObject({
    resultados: 1,
    errores: [],
  });
  expect(urls).toHaveLength(3);
  expect(
    urls.filter((u) => u.includes("NFG_CmpJornada")).every((u) => u.includes("CodJornada=1")),
  ).toBe(true);
  await traerJornada(competicionId, 1, descargador, AHORA);
  expect(urls.filter((u) => u.includes("NFG_CmpPartido"))).toHaveLength(1);
});

it("acta concreta se vuelve a tratar y corrige marcador ya guardado", async () => {
  const { db, s, competicionId, partidos } = await preparar();
  await db
    .update(s.partidos)
    .set({ golesLocal: 1, golesVisitante: 0, estado: "finalizado" })
    .where(eq(s.partidos.id, partidos[0]!.id));
  await db.insert(s.rfgfActas).values({
    codActa: "900",
    competicionId,
    partidoId: partidos[0]!.id,
    estado: "resultado",
    eventos: true,
  });
  const { traerActa } = await import("./demanda");
  const { descargador, urls } = descargadorDe();
  expect(await traerActa(competicionId, partidos[0]!.id, descargador, AHORA)).toMatchObject({
    resultados: 1,
    errores: [],
  });
  expect(urls).toHaveLength(1);
  expect(
    (await db.select().from(s.partidos).where(eq(s.partidos.id, partidos[0]!.id)))[0],
  ).toMatchObject({ golesLocal: 8, golesVisitante: 2 });
  expect((await db.select().from(s.ligaEventos)).length).toBeGreaterThan(0);
});

it("sin acta publicada devuelve aviso sin error", async () => {
  const { competicionId, partidos } = await preparar();
  const { traerActa } = await import("./demanda");
  const { descargador, urls } = descargadorDe(null);
  expect(await traerActa(competicionId, partidos[0]!.id, descargador, AHORA)).toMatchObject({
    errores: [],
    avisos: [expect.stringContaining("todavía no tiene acta")],
  });
  expect(urls).toHaveLength(1);
});

it("candado compartido: una petición, diario e histórico no descargan durante otra operación", async () => {
  const { competicionId } = await preparar();
  const { traerJornada, traerHorarios } = await import("./demanda");
  const { sincronizarTodo, sincronizarCompeticion } = await import("./sincronizar");
  const { avanzarHistorico, traerTemporadaHistorica } = await import("./historico");
  const { descargador, urls } = descargadorDe();
  let soltar!: () => void, iniciada!: () => void;
  const inicio = new Promise<void>((r) => {
    iniciada = r;
  });
  const espera = new Promise<void>((r) => {
    soltar = r;
  });
  const lenta = {
    ...descargador,
    pdf: async (url: string) => {
      iniciada();
      await espera;
      return descargador.pdf(url);
    },
  };
  const primera = traerJornada(competicionId, 1, lenta, AHORA);
  await inicio;
  try {
    expect(await traerHorarios(competicionId, descargador, AHORA)).toMatchObject({
      avisos: [expect.stringContaining("en marcha")],
    });
    expect(await sincronizarTodo(descargador, AHORA)).toEqual([]);
    expect(await sincronizarCompeticion(competicionId, descargador, AHORA)).toBeNull();
    expect(await avanzarHistorico(descargador, AHORA)).toBe(0);
    expect(await traerTemporadaHistorica("200", descargador, AHORA)).toMatchObject({
      avisos: [expect.stringContaining("en marcha")],
    });
    expect(urls).toEqual([]);
  } finally {
    soltar();
    await primera;
  }
});

it("clasificación cuadrada solo compara: no pide jornadas ni actas", async () => {
  const { db, s, competicionId, partidos } = await preparar();
  await db
    .update(s.partidos)
    .set({ golesLocal: 8, golesVisitante: 2, estado: "finalizado" })
    .where(eq(s.partidos.id, partidos[0]!.id));
  simulacion.oficial = [oficial("EQUIPO LOCAL", 3, 8, 2), oficial("EQUIPO VISITANTE", 0, 2, 8)];
  const { actualizarClasificacion } = await import("./demanda");
  const { descargador, urls } = descargadorDe();
  expect(await actualizarClasificacion(competicionId, descargador, AHORA)).toMatchObject({
    cuadra: true,
    jornadaOficial: 1,
    diferencias: [],
    motivos: [],
  });
  expect(urls).toHaveLength(1);
  expect(urls[0]).toContain("NFG_VisClasificacion");
});

it("clasificación sin resultados locales trae jornada pendiente y vuelve a comparar", async () => {
  const { competicionId } = await preparar();
  simulacion.oficial = [oficial("EQUIPO LOCAL", 3, 8, 2), oficial("EQUIPO VISITANTE", 0, 2, 8)];
  const { actualizarClasificacion } = await import("./demanda");
  const { descargador, urls } = descargadorDe();
  expect(await actualizarClasificacion(competicionId, descargador, AHORA)).toMatchObject({
    cuadra: true,
    diferencias: [],
  });
  expect(urls.filter((u) => u.includes("NFG_VisClasificacion"))).toHaveLength(2);
  expect(urls.filter((u) => u.includes("NFG_CmpJornada"))).toHaveLength(1);
});

it("horarios trae todas las jornadas por jugar, sin páginas HTML ni cifras", async () => {
  const { competicionId } = await preparar();
  const { traerHorarios } = await import("./demanda");
  const { descargador, urls } = descargadorDe();
  await traerHorarios(competicionId, descargador, AHORA);
  expect(urls).toHaveLength(3);
  expect(urls.map((u) => new URL(u).searchParams.get("CodJornada"))).toEqual(["3", "4", "5"]);
  expect(urls.every((u) => u.includes("NPcd_Pdf=1"))).toBe(true);
});

it("histórico: una página de jugador rota no bloquea grupos anteriores ni repite fallo en tanda", async () => {
  const { db, s, competicionId } = await preparar();
  const [jugador] = await db.insert(s.jugadores).values({ nombre: "Persona Prueba" }).returning();
  await db.insert(s.rfgfJugadores).values({
    codigo: "1",
    jugadorId: jugador!.id,
    nombre: "PERSONA",
    competicionId,
    codActa: "900",
  });
  await db.insert(s.rfgfGruposHistoricos).values([
    {
      codGrupo: "200",
      categoria: "Senior",
      temporada: "2025-2026",
      competicion: "Eliminatorias",
      grupo: "Uno",
      codCompeticion: "20",
      codEquipo: "1",
      codActa: "800",
      estado: "listo",
    },
    {
      codGrupo: "100",
      categoria: "Senior",
      temporada: "2024-2025",
      competicion: "Liga",
      grupo: "Uno",
      codCompeticion: "10",
      codEquipo: "1",
    },
  ]);
  await db.insert(s.rfgfHistorico).values({ codGrupo: "200", jugadorId: jugador!.id, codigo: "1" });
  const urls: string[] = [];
  const descargador: DescargadorRfgf = {
    html: async (url) => {
      urls.push(url);
      return url.includes("Estadisticas") ? "Página sin cifras" : pagina("700");
    },
    pdf: async () => {
      throw new Error("No debe pedir PDF");
    },
  };
  const { avanzarHistorico } = await import("./historico");
  expect(await avanzarHistorico(descargador, AHORA)).toBe(2);
  expect(
    (
      await db
        .select()
        .from(s.rfgfGruposHistoricos)
        .where(eq(s.rfgfGruposHistoricos.codGrupo, "100"))
    )[0],
  ).toMatchObject({ estado: "listo", codActa: "700" });
  expect(urls).toHaveLength(2);
  expect(
    (await db.select().from(s.rfgfHistorico).where(eq(s.rfgfHistorico.codGrupo, "200")))[0]!
      .leidoEn,
  ).toBeNull();
});

it("histórico bajo demanda limita dos páginas al grupo elegido y muestra cifras guardadas", async () => {
  const { db, s, competicionId } = await preparar();
  const [jugador] = await db.insert(s.jugadores).values({ nombre: "Persona Prueba" }).returning();
  await db.insert(s.rfgfJugadores).values({
    codigo: "1",
    jugadorId: jugador!.id,
    nombre: "PERSONA",
    competicionId,
    codActa: "900",
  });
  await db.insert(s.rfgfGruposHistoricos).values(
    ["100", "200"].map((codGrupo) => ({
      codGrupo,
      categoria: "Senior",
      temporada: "2024-2025",
      competicion: "Liga",
      grupo: "Uno",
      codCompeticion: "10",
      codEquipo: "1",
    })),
  );
  const { traerTemporadaHistorica, estadoHistorico } = await import("./historico");
  const { descargador, urls } = descargadorDe();
  const resumen = await traerTemporadaHistorica("100", descargador, AHORA);
  expect(resumen.paginas).toBe(2);
  expect(urls[0]).toContain("CodGrupo=100");
  expect(urls).toHaveLength(2);
  expect((await estadoHistorico()).find((g) => g.codGrupo === "200")).toMatchObject({
    estado: "pendiente",
    conCifras: 0,
  });
});

it("jornada pedida a mano corrige resultado publicado y reintenta actas con aviso o error", async () => {
  const { db, s, competicionId, partidos } = await preparar();
  const id = partidos[0]!.id;
  await db
    .update(s.partidos)
    .set({ golesLocal: 1, golesVisitante: 0, estado: "finalizado" })
    .where(eq(s.partidos.id, id));
  await db.insert(s.rfgfActas).values({
    codActa: "900",
    competicionId,
    partidoId: id,
    estado: "resultado",
    eventos: true,
    aviso: "Faltaban eventos",
  });
  const { traerJornada } = await import("./demanda");
  const { descargador, urls } = descargadorDe();
  await traerJornada(competicionId, 1, descargador, AHORA);
  expect((await db.select().from(s.partidos).where(eq(s.partidos.id, id)))[0]).toMatchObject({
    golesLocal: 8,
    golesVisitante: 2,
  });
  expect((await db.select().from(s.rfgfActas))[0]).toMatchObject({
    aviso: "",
    estado: "resultado",
  });
  expect(urls.filter((u) => u.includes("NFG_CmpPartido"))).toHaveLength(1);
  await db.update(s.rfgfActas).set({ estado: "error", eventos: false });
  await traerJornada(competicionId, 1, descargador, AHORA);
  expect(urls.filter((u) => u.includes("NFG_CmpPartido"))).toHaveLength(2);
});

it("acta propia vuelve a guardar convocatoria y eventos sin duplicarlos", async () => {
  const { db, s, competicionId, partidos, temporadaId } = await preparar();
  await db
    .update(s.equipos)
    .set({ esPropio: true })
    .where(eq(s.equipos.id, partidos[0]!.equipoVisitanteId));
  const personas = await db
    .insert(s.jugadores)
    .values(Array.from({ length: 16 }, (_, i) => ({ nombre: `Persona Apellido ${20 + i}` })))
    .returning();
  await db.insert(s.jugadoresTemporada).values(
    personas.map((p, i) => ({
      jugadorId: p.id,
      temporadaId,
      categoria: "Senior" as const,
      dorsal: i + 1,
    })),
  );
  const { traerActa } = await import("./demanda");
  const { descargador, urls } = descargadorDe();
  expect(await traerActa(competicionId, partidos[0]!.id, descargador, AHORA)).toMatchObject({
    actas: 1,
    errores: [],
  });
  const eventosAntes = await db.select().from(s.partidoEventos);
  expect(await traerActa(competicionId, partidos[0]!.id, descargador, AHORA)).toMatchObject({
    actas: 1,
    errores: [],
  });
  expect(await db.select().from(s.partidoParticipaciones)).toHaveLength(16);
  expect(await db.select().from(s.partidoEventos)).toHaveLength(eventosAntes.length);
  expect(urls.filter((u) => u.includes("NFG_CmpPartido"))).toHaveLength(2);
});

it("cifras trae cuatro jugadores por petición y mantiene la fecha de comprobación diaria", async () => {
  const { db, s, competicionId, partidos } = await preparar();
  await db
    .update(s.equipos)
    .set({ esPropio: true })
    .where(eq(s.equipos.id, partidos[0]!.equipoVisitanteId));
  await db
    .update(s.partidos)
    .set({ golesLocal: 8, golesVisitante: 2, estado: "finalizado" })
    .where(eq(s.partidos.id, partidos[0]!.id));
  await db.insert(s.rfgfActas).values({
    codActa: "900",
    competicionId,
    partidoId: partidos[0]!.id,
    estado: "guardada",
    eventos: true,
  });
  await db.insert(s.rfgfJugadores).values(
    [1, 2, 3, 4, 5, 6].map((n) => ({
      codigo: String(n),
      nombre: "PERSONA PRUEBA",
      competicionId,
      codActa: "900",
    })),
  );
  const urls: string[] = [];
  const html = `<a>Generar PDF</a><h4>PERSONA PRUEBA</h4><span>Equipo:</span><b>EQUIPO VISITANTE</b><b>LIGA</b><strong>Temporada 2026-2027</strong><td>Convocados</td><td>1</td><td>Titular</td><td>1</td><td>Suplente</td><td>0</td><td>Jugados</td><td>1</td><td>Tarjeta amarilla</td><td>0</td><td>Doble tarjeta amarilla</td><td>0</td><td>Tarjeta roja</td><td>0</td><h5>Goles</h5><td>Total</td><td>0</td>`;
  const descargador: DescargadorRfgf = {
    html: async (url) => {
      urls.push(url);
      return html;
    },
    pdf: async () => {
      throw new Error("No debe pedir PDF");
    },
  };
  const { traerCifrasJugadores } = await import("./demanda");
  expect(await traerCifrasJugadores(competicionId, descargador, AHORA)).toMatchObject({
    jugadores: 4,
    errores: [],
  });
  expect(urls).toHaveLength(4);
  expect((await db.select().from(s.rfgfCompeticiones))[0]!.comprobadoEn).toBeNull();
});

it("candado se libera tras entrada inválida y fallo de descarga", async () => {
  const { competicionId, partidos } = await preparar();
  const { traerJornada, traerActa } = await import("./demanda");
  const roto: DescargadorRfgf = {
    html: async () => {
      throw new Error("Sin servicio");
    },
    pdf: async () => {
      throw new Error("Sin servicio");
    },
  };
  expect(await traerJornada(competicionId, 99, roto, AHORA)).toMatchObject({
    errores: [expect.stringContaining("no pertenece")],
    avisos: [],
  });
  expect(await traerActa(competicionId, partidos[0]!.id, roto, AHORA)).toMatchObject({
    errores: ["Sin servicio"],
    avisos: [],
  });
  expect(await traerJornada(competicionId, 1, descargadorDe().descargador, AHORA)).toMatchObject({
    errores: [],
    avisos: [],
  });
});

it("histórico cruza categorías y respeta presupuesto al descubrir", async () => {
  const { db, s, competicionId } = await preparar();
  const [jugador] = await db.insert(s.jugadores).values({ nombre: "Persona Prueba" }).returning();
  await db.insert(s.rfgfJugadores).values({
    codigo: "1",
    jugadorId: jugador!.id,
    nombre: "PERSONA",
    competicionId,
    codActa: "900",
  });
  await db.insert(s.rfgfGruposHistoricos).values([
    {
      codGrupo: "100",
      categoria: "Veteranos",
      temporada: "2025-2026",
      competicion: "Liga",
      grupo: "Uno",
      codCompeticion: "10",
      codEquipo: "1",
    },
    {
      codGrupo: "200",
      categoria: "Senior",
      temporada: "2024-2025",
      competicion: "Liga",
      grupo: "Uno",
      codCompeticion: "10",
      codEquipo: "1",
    },
  ]);
  const { avanzarHistorico } = await import("./historico");
  const { descargador, urls } = descargadorDe();
  expect(await avanzarHistorico(descargador, AHORA, 1)).toBe(1);
  expect(urls).toHaveLength(1);
  expect(urls[0]).toContain("CodGrupo=100");
});

it("clasificación explica sanción conocida y reconoce causas desconocidas", async () => {
  const { db, s, competicionId, partidos } = await preparar();
  await db
    .update(s.partidos)
    .set({ golesLocal: 8, golesVisitante: 2, estado: "finalizado" })
    .where(eq(s.partidos.id, partidos[0]!.id));
  await db.insert(s.rfgfActas).values({
    codActa: "900",
    competicionId,
    partidoId: partidos[0]!.id,
    estado: "resultado",
    eventos: true,
  });
  simulacion.oficial = [
    { ...oficial("EQUIPO LOCAL", 1, 8, 2), sancion: 2 },
    oficial("EQUIPO VISITANTE", 1, 2, 8),
  ];
  const { actualizarClasificacion } = await import("./demanda");
  const { descargador } = descargadorDe();
  const resumen = await actualizarClasificacion(competicionId, descargador, AHORA);
  expect(resumen.cuadra).toBe(false);
  expect(resumen.motivos[0]).toContain("Sanción de puntos publicada");
  expect(resumen.motivos[1]).toContain("No hay un motivo conocido");
});

it("histórico sigue descubriendo categorías aunque haya jugadores de otro grupo que siempre fallen", async () => {
  const { db, s, competicionId, temporadaId } = await preparar();
  const [jugador] = await db.insert(s.jugadores).values({ nombre: "Persona Prueba" }).returning();
  await db.insert(s.rfgfJugadores).values({
    codigo: "1",
    jugadorId: jugador!.id,
    nombre: "PERSONA",
    competicionId,
    codActa: "900",
  });
  await db.insert(s.rfgfGruposHistoricos).values({
    codGrupo: "100",
    categoria: "Senior",
    temporada: "2025-2026",
    competicion: "Eliminatorias",
    grupo: "Uno",
    codCompeticion: "10",
    codEquipo: "1",
    codActa: "800",
    estado: "listo",
  });
  await db.insert(s.rfgfHistorico).values({ codGrupo: "100", jugadorId: jugador!.id, codigo: "1" });
  const [veteranos] = await db
    .insert(s.competiciones)
    .values({ temporadaId, nombre: "Liga veteranos", categoria: "Veteranos" })
    .returning();
  await db.insert(s.rfgfCompeticiones).values({ competicionId: veteranos!.id, enlace: ENLACE });
  await db.insert(s.equipos).values({
    nombre: "Equipo Local",
    clave: "local veteranos",
    categoria: "Veteranos",
    esPropio: true,
  });
  const urls: string[] = [];
  const descargador: DescargadorRfgf = {
    html: async (url) => {
      urls.push(url);
      return url.includes("Estadisticas") ? "Sin cifras" : pagina("700");
    },
    pdf: async () => {
      throw new Error("No debe pedir PDF");
    },
  };
  const { avanzarHistorico } = await import("./historico");
  await avanzarHistorico(descargador, AHORA, 2);
  expect(urls.some((url) => url.includes("NFG_VisCompeticiones_Equipo"))).toBe(true);
  expect(urls.length).toBeLessThanOrEqual(2);
});
