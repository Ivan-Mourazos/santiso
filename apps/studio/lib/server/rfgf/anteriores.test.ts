import { schema as s, type ConexionDb } from "@santiso/db";
import { crearDbPrueba } from "@santiso/db/testing";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  avanzarAnterioresSinCandado,
  reconciliarAnteriores,
  elegirClubAnterior,
  otrosClubesDeJugador,
} from "./anteriores";
import { avanzarHistorico } from "./historico";
import type { DescargadorRfgf } from "./descargador";
let c: ConexionDb;
let competicionId: string;
const ahora = new Date("2026-11-01T12:00:00Z");
const tabla = `<table><tr><th>Equipo</th><th>Categoría</th><th>Competición</th><th>Grupo</th></tr><tr><td><a href="?codequipo=1">Club</a></td><td>Senior</td><td><a href="?codcompeticion=20">LIGA FICTICIA</a></td><td><a href="?codgrupo=30">GRUPO 2</a></td></tr></table>`;
const jornada = `<a href="NFG_VisEquipos?Codigo_Equipo=1">Local</a><a href="NFG_CmpPartido?CodActa=99">2-0</a><a href="NFG_VisEquipos?Codigo_Equipo=2">Visitante</a>`;
const estadisticas = (n = 2) =>
  `Generar PDF | NOMBRE | Equipo: | | LIGA FICTICIA | GRUPO 2 | Temporada 2023-2024 | Convocados | ${n} | Titular | 1 | Suplente | 1 | Jugados | ${n} | Tarjeta amarilla | 1 | Doble tarjeta amarilla | 0 | Tarjeta roja | 0`;
function descargador(): DescargadorRfgf {
  return {
    html: vi.fn(async (url) =>
      url.includes("VisCompeticiones_Club")
        ? tabla
        : url.includes("CmpJornada")
          ? jornada
          : estadisticas(),
    ),
    pdf: vi.fn(async () => {
      throw Error("PDF inesperado");
    }),
  };
}
async function persona(historial: string[], codigo = "101") {
  const [p] = await c.db
    .insert(s.jugadores)
    .values({ nombre: `Jugador ${codigo}`, historial })
    .returning();
  await c.db
    .insert(s.rfgfJugadores)
    .values({ codigo, competicionId, jugadorId: p!.id, nombre: p!.nombre, codActa: "9" });
  return p!;
}
beforeEach(async () => {
  c = await crearDbPrueba();
  globalThis.santisoConexionDb = Promise.resolve(c);
  const [t] = await c.db
    .insert(s.temporadas)
    .values({ nombre: "2026/27", activa: true })
    .returning();
  const [comp] = await c.db
    .insert(s.competiciones)
    .values({ temporadaId: t!.id, categoria: "Senior", nombre: "Liga" })
    .returning();
  competicionId = comp!.id;
  await c.db.insert(s.rfgfClubes).values([
    { codigo: "1", nombre: "Bastavales U.D.", clave: "bastavales", leidoEn: ahora.toISOString() },
    { codigo: "2", nombre: "C.D. Rival", clave: "rival", leidoEn: ahora.toISOString() },
    { codigo: "3", nombre: "S.D. Rival", clave: "rival sd", leidoEn: ahora.toISOString() },
  ]);
  vi.stubGlobal("fetch", () => {
    throw Error("Red prohibida");
  });
});
afterEach(() => {
  c.cerrar();
  globalThis.santisoConexionDb = undefined;
  globalThis.santisoRedRfgfEnMarcha = false;
  vi.unstubAllGlobals();
});
it("empareja inequívoco, ambiguo, ausente; omite propio y líneas sin temporada; conserva elección e historial", async () => {
  const historial = [
    "23/24: Bastavales U.D. (Juvenil)",
    "22/23: Rival",
    "21/22: Desconocido",
    "20/21: Bastavales U.D.",
    "12/13: Rival",
    "24/25: U.D. Santiso",
    "sin temporada",
  ];
  const p = await persona(historial);
  await reconciliarAnteriores();
  let filas = await otrosClubesDeJugador(p.id);
  expect(filas).toHaveLength(5);
  expect(filas.find((f) => f.temporada === "2023-2024")).toMatchObject({
    clubCodigo: "1",
    estado: "pendiente",
  });
  const rival = filas.find((f) => f.temporada === "2022-2023")!;
  expect(rival.estado).toBe("sin_club");
  expect(rival.candidatos).toHaveLength(2);
  expect(filas.find((f) => f.temporada === "2021-2022")!.estado).toBe("sin_club");
  expect(filas.filter((f) => f.estado === "sin_datos")).toHaveLength(2);
  await elegirClubAnterior(rival.id, "3");
  await reconciliarAnteriores();
  filas = await otrosClubesDeJugador(p.id);
  expect(filas.find((f) => f.id === rival.id)).toMatchObject({ clubCodigo: "3", manual: true });
  expect((await c.db.select().from(s.jugadores))[0]!.historial).toEqual(historial);
});
it("reutiliza club y grupo entre jugadores, dos páginas por tic total; borra petición y cifras al quitar línea", async () => {
  const a = await persona(["23/24: Bastavales U.D."]);
  await persona(["23/24: Bastavales U.D."], "102");
  const d = descargador();
  expect(await avanzarHistorico(d, ahora)).toBe(2);
  expect(d.html).toHaveBeenCalledTimes(2);
  expect(await avanzarHistorico(d, ahora)).toBe(2);
  expect(d.html).toHaveBeenCalledTimes(4);
  expect(
    vi.mocked(d.html).mock.calls.filter(([u]) => u.includes("VisCompeticiones_Club")),
  ).toHaveLength(1);
  expect(vi.mocked(d.html).mock.calls.filter(([u]) => u.includes("CmpJornada"))).toHaveLength(1);
  expect((await otrosClubesDeJugador(a.id))[0]!.resultados[0]!.cifras!.goles).toBeNull();
  await c.db.update(s.jugadores).set({ historial: [] }).where(eq(s.jugadores.id, a.id));
  await reconciliarAnteriores();
  expect(await otrosClubesDeJugador(a.id)).toEqual([]);
  expect(await c.db.select().from(s.rfgfAnterioresCifras)).toHaveLength(1);
});
it("sin tabla acaba con aviso sin reintentar; temporadas no publicadas no piden páginas", async () => {
  await persona(["23/24: Bastavales U.D.", "20/21: Bastavales U.D.", "12/13: Bastavales U.D."]);
  const d = descargador();
  vi.mocked(d.html).mockResolvedValue("Sin tabla");
  expect(await avanzarAnterioresSinCandado(d, ahora, 2)).toBe(1);
  expect(await avanzarAnterioresSinCandado(d, ahora, 2)).toBe(0);
  expect(
    (await c.db.select().from(s.rfgfAnterioresPeticiones)).every((p) => p.estado === "sin_datos"),
  ).toBe(true);
  expect((await c.db.select().from(s.rfgfAnterioresClub))[0]!.aviso).toContain("tabla");
});
it.each(["club", "grupo", "jugador"])(
  "fallo de red en %s consume página, espera otro tic y termina tras tres intentos",
  async (etapa) => {
    const p = await persona(["23/24: Bastavales U.D."]);
    const d = descargador();
    if (etapa !== "club") await avanzarAnterioresSinCandado(d, ahora, etapa === "grupo" ? 1 : 2);
    vi.mocked(d.html).mockRejectedValue(Error("Sin red"));
    const antes = vi.mocked(d.html).mock.calls.length;
    for (let i = 0; i < 3; i++) expect(await avanzarAnterioresSinCandado(d, ahora, 2)).toBe(1);
    expect(await avanzarAnterioresSinCandado(d, ahora, 2)).toBe(0);
    expect(d.html).toHaveBeenCalledTimes(antes + 3);
    expect((await otrosClubesDeJugador(p.id))[0]).toMatchObject({
      estado: "error",
      aviso: "Sin red",
    });
  },
);
it("convocados cero queda leído sin mostrar cifras; busca referencia hasta jornada tres", async () => {
  const p = await persona(["23/24: Bastavales U.D."]);
  const d = descargador();
  vi.mocked(d.html).mockImplementation(async (url) =>
    url.includes("VisCompeticiones_Club")
      ? tabla
      : url.includes("CmpJornada")
        ? url.includes("CodJornada=3")
          ? jornada
          : ""
        : estadisticas(0),
  );
  for (let i = 0; i < 4; i++) await avanzarAnterioresSinCandado(d, ahora, 2);
  expect((await otrosClubesDeJugador(p.id))[0]).toMatchObject({
    estado: "sin_datos",
    resultados: [],
  });
  expect((await c.db.select().from(s.rfgfAnterioresCifras))[0]!.estado).toBe("leido");
});

it("años del siglo pasado y temporadas ausentes del selector no gastan más páginas", async () => {
  const p = await persona(["99/00: Bastavales U.D.", "23/24: Bastavales U.D."]);
  const d = descargador();
  vi.mocked(d.html).mockResolvedValue(
    `<select name=codtemporada><option value=18>2022-2023</option></select>${tabla}`,
  );
  expect(await avanzarAnterioresSinCandado(d, ahora, 2)).toBe(1);
  const filas = await otrosClubesDeJugador(p.id);
  expect(filas.find((f) => f.temporada === "1999-2000")!.estado).toBe("sin_datos");
  expect(filas.every((f) => f.estado === "sin_datos")).toBe(true);
  expect(await avanzarAnterioresSinCandado(d, ahora, 2)).toBe(0);
});
