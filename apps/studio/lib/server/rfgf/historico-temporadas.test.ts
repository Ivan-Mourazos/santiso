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
