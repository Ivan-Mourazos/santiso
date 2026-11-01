// Clasificaciones se ejercitan con su presupuesto real en historico-clasificaciones.test.ts.
vi.mock("./historico-clasificaciones", () => ({ avanzarClasificacionesSinCandado: async () => 0 }));
import { readFileSync } from "node:fs";
import path from "node:path";
import { schema as s, type ConexionDb } from "@santiso/db";
import { crearDbPrueba } from "@santiso/db/testing";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { DescargadorRfgf } from "./descargador";

/** La página real de competiciones del Senior (codequipo 2860), bajada el 19/10/2026. */
const competiciones = new TextDecoder("iso-8859-15").decode(
  readFileSync(path.resolve(__dirname, "../../rfgf/__muestras__/competiciones-equipo-senior.html")),
);
const AHORA = new Date("2026-10-19T12:00:00Z");
let conexion: ConexionDb;

beforeEach(async () => {
  conexion = await crearDbPrueba();
  globalThis.santisoConexionDb = Promise.resolve(conexion);
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Red prohibida en pruebas");
    }),
  );
  const { db } = conexion;
  const [temporada] = await db
    .insert(s.temporadas)
    .values({ nombre: "2026/27", activa: true })
    .returning();
  const [competicion] = await db
    .insert(s.competiciones)
    .values({ temporadaId: temporada!.id, categoria: "Senior", nombre: "Tercera Futgal" })
    .returning();
  await db.insert(s.rfgfCompeticiones).values({
    competicionId: competicion!.id,
    enlace:
      "https://www.futgal.es/pnfg/NPcd/NFG_VisCalendario_Vis?cod_primaria=1000120&codtemporada=22&codcompeticion=26990830&codgrupo=27576591",
  });
  // Lo que dejó el repaso anterior, de cinco temporadas: ya sabe el código del equipo.
  await db.insert(s.rfgfGruposHistoricos).values({
    codGrupo: "24123236",
    categoria: "Senior",
    temporada: "2025-2026",
    competicion: "Tercera Futgal",
    grupo: "Santiago | Grupo 4 > Fase Previa",
    codCompeticion: "1",
    codEquipo: "2860",
    estado: "listo",
    codActa: "77",
  });
});
afterEach(() => {
  conexion?.cerrar();
  globalThis.santisoConexionDb = undefined;
  globalThis.santisoRedRfgfEnMarcha = false;
  vi.unstubAllGlobals();
});

it("con el código del equipo ya conocido, una página trae todas las temporadas pasadas", async () => {
  const urls: string[] = [];
  const descargador: DescargadorRfgf = {
    async html(url) {
      urls.push(url);
      if (url.includes("NFG_VisCompeticiones_Equipo")) return competiciones;
      throw new Error(`No se esperaba ${url}`);
    },
    async pdf() {
      throw new Error("No se piden PDF");
    },
  };
  const { avanzarHistorico } = await import("./historico");
  expect(await avanzarHistorico(descargador, AHORA, 2)).toBe(1);
  expect(urls).toEqual([expect.stringContaining("codequipo=2860")]);

  const grupos = await conexion.db.select().from(s.rfgfGruposHistoricos);
  const temporadas = [...new Set(grupos.map((g) => g.temporada))].sort().reverse();
  // De 2025-2026 a 2014-2015; 2020-2021 no se jugó y la actual no entra.
  expect(temporadas).toEqual([
    "2025-2026",
    "2024-2025",
    "2023-2024",
    "2022-2023",
    "2021-2022",
    "2019-2020",
    "2018-2019",
    "2017-2018",
    "2016-2017",
    "2015-2016",
    "2014-2015",
  ]);
  expect(grupos).toHaveLength(26);
  // Lo ya hecho no se toca.
  expect(grupos.find((g) => g.codGrupo === "24123236")).toMatchObject({
    estado: "listo",
    codActa: "77",
  });
  expect(await conexion.db.select().from(s.rfgfEquiposClub)).toMatchObject([
    { categoria: "Senior", codEquipo: "2860", temporadasEn: AHORA.toISOString() },
  ]);

  // Anotado: no se vuelve a pedir.
  expect(await avanzarHistorico(descargador, AHORA, 2)).toBe(0);
  expect(urls).toHaveLength(1);
});

const PAGINA_JUGADOR = `<html><body><a>Generar PDF</a><h4>SANCHEZ VAZQUEZ, IVAN</h4><span>Equipo:</span><b>U.D. SANTISO F.C.</b>
<b>TERCERA FUTGAL | GRUPO 4</b><strong>Temporada 2025-2026</strong>
<td>Convocados</td><td>9</td><td>Titular</td><td>7</td><td>Suplente</td><td>2</td><td>Jugados</td><td>8</td>
<td>Total</td><td>1</td><td>Tarjeta amarilla</td><td>3</td><td>Doble tarjeta amarilla</td><td>0</td><td>Tarjeta roja</td><td>1</td>
<h5>Goles</h5><td>Total</td><td>5</td></body></html>`;

it("a demanda, un jugador identificado tarde entra en los grupos ya preparados y se lee", async () => {
  const { db } = conexion;
  const [competicion] = await db.select().from(s.competiciones);
  const [jugador] = await db
    .insert(s.jugadores)
    .values({ nombre: "Iván Sánchez Vázquez" })
    .returning();
  const [otro] = await db.insert(s.jugadores).values({ nombre: "Otro" }).returning();
  const { traerTemporadasDeJugador } = await import("./historico");
  const urls: string[] = [];
  const descargador: DescargadorRfgf = {
    async html(url) {
      urls.push(url);
      if (url.includes("NFG_EstadisticasJugador")) return PAGINA_JUGADOR;
      throw new Error(`No se esperaba ${url}`);
    },
    async pdf() {
      throw new Error("No se piden PDF");
    },
  };

  // Sin código en la federación no hay nada que pedir.
  expect(await traerTemporadasDeJugador(jugador!.id, descargador, AHORA)).toMatchObject({
    paginas: 0,
    avisos: [expect.stringContaining("no tiene identificado")],
  });

  for (const [codigo, j] of [
    ["21", jugador!],
    ["22", otro!],
  ] as const) {
    await db.insert(s.rfgfJugadores).values({
      codigo,
      competicionId: competicion!.id,
      jugadorId: j.id,
      nombre: "SANCHEZ VAZQUEZ, IVAN",
      codActa: "900",
    });
  }
  const resumen = await traerTemporadasDeJugador(jugador!.id, descargador, AHORA);
  expect(resumen).toMatchObject({ paginas: 1, leidas: 1, pendientes: 0, errores: [] });
  expect(urls).toEqual([expect.stringMatching(/jugador=21&codacta=77/u)]);
  const filas = await db.select().from(s.rfgfHistorico);
  // Solo él: al otro lo apunta el repaso de fondo.
  expect(filas.find((f) => f.jugadorId === jugador!.id)?.cifras).toMatchObject({
    convocados: 9,
    goles: 5,
    rojas: 1,
  });
  expect(filas.find((f) => f.jugadorId === otro!.id)).toBeUndefined();

  expect(await traerTemporadasDeJugador(jugador!.id, descargador, AHORA)).toMatchObject({
    paginas: 0,
    avisos: [expect.stringContaining("Ya están leídas")],
  });
  expect(urls).toHaveLength(1);
});
