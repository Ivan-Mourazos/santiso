import { schema as s, type ConexionDb } from "@santiso/db";
import { crearDbPrueba } from "@santiso/db/testing";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { avanzarHistorico } from "./historico";
import { avanzarClasificacionesSinCandado } from "./historico-clasificaciones";
import type { DescargadorRfgf } from "./descargador";
vi.mock("@santiso/actas", async (original) => {
  const real = await original<typeof import("@santiso/actas")>();
  return {
    ...real,
    parsearClasificacionPdf: async (bytes: Uint8Array) =>
      real.parsearClasificacion(new TextDecoder().decode(bytes)),
  };
});
let c: ConexionDb;
const AHORA = new Date("2026-11-01T12:00:00Z");
const ronda = (titulo: string, local = "U.D. SANTISO") =>
  `<th colspan=3>${titulo} (01-10-2023)</th><td width="47%" align="right">${local}</td><td width="47%" align="left">RIVAL</td>`;
const calendario = `<h4>LIGA FICTICIA<br>Temporada 2023-2024</h4>${ronda("Jornada 1")}${ronda("Jornada 26")}`;
const clasificacion = (j = 26, vacia = false) =>
  `LIGA FICTICIA Temporada 2023-2024\nJornada ${j}\nEquipos Partidos Goles\n${vacia ? "" : "1 RIVAL 40 26 12 4 10 42 30 G 0\n6 U.D. SANTISO 34 26 10 4 12 31 35 E 0"}`;
function descargador(): DescargadorRfgf {
  return {
    html: vi.fn(async () => calendario),
    pdf: vi.fn(async (url) =>
      new TextEncoder().encode(
        clasificacion(Number(new URL(url).searchParams.get("CodJornada")) || 26),
      ),
    ),
  };
}
async function grupo(codGrupo = "300", categoria = "Senior") {
  await c.db
    .insert(s.rfgfGruposHistoricos)
    .values({
      codGrupo,
      categoria,
      temporada: "2023-2024",
      competicion: "Liga Ficticia",
      grupo: "1",
      codCompeticion: "30",
      codEquipo: "12",
      estado: "sin_acta",
    });
}
const registro = async (codigo = "300") =>
  (
    await c.db
      .select()
      .from(s.rfgfHistoricoClasificaciones)
      .where(eq(s.rfgfHistoricoClasificaciones.codGrupo, codigo))
  )[0]!;
beforeEach(async () => {
  c = await crearDbPrueba();
  globalThis.santisoConexionDb = Promise.resolve(c);
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
it("liga: una web y un PDF, límite global dos y no repite lo guardado", async () => {
  await grupo();
  const d = descargador();
  expect(await avanzarHistorico(d, AHORA)).toBe(2);
  expect(d.html).toHaveBeenCalledTimes(1);
  expect(d.pdf).toHaveBeenCalledTimes(1);
  expect(vi.mocked(d.html).mock.calls[0]![0]).toContain("NFG_VisCalendario_Vis");
  expect(await registro()).toMatchObject({ formato: "liga", jornada: 26, estado: "leido" });
  expect((await registro()).filas!.find((f) => f.equipo.includes("Santiso"))).toMatchObject({
    posicion: 6,
    puntos: 34,
  });
  expect(await avanzarHistorico(d, AHORA)).toBe(0);
  expect(d.pdf).toHaveBeenCalledTimes(1);
});
it("copa: última ronda con Santiso, solo HTML; si no aparece sin datos", async () => {
  await grupo();
  await grupo("301");
  const d = descargador();
  vi.mocked(d.html).mockImplementation(
    async (url) =>
      `<h4>COPA<br>Temporada 2023-2024</h4>${ronda("Dieciseisavos", url.includes("codgrupo=301") ? "Otro" : "U.D. Santiso")}${ronda("Octavos", url.includes("codgrupo=301") ? "Otro" : "U.D. Santiso")}${ronda("Final", "Otro")}`,
  );
  expect(await avanzarClasificacionesSinCandado(d, AHORA, 2)).toBe(2);
  expect(await registro()).toMatchObject({ formato: "copa", ronda: "Octavos", estado: "leido" });
  expect((await registro("301")).estado).toBe("sin_datos");
  expect(d.pdf).not.toHaveBeenCalled();
});
it("última jornada vacía baja a la anterior en otro tic; no repite calendario", async () => {
  await grupo();
  const d = descargador();
  vi.mocked(d.pdf).mockImplementation(async (url) => {
    const j = Number(new URL(url).searchParams.get("CodJornada"));
    return new TextEncoder().encode(clasificacion(j, j === 26));
  });
  expect(await avanzarHistorico(d, AHORA)).toBe(2);
  expect(await registro()).toMatchObject({ jornada: 25, vacias: 1, estado: "pendiente" });
  expect(await avanzarHistorico(d, AHORA)).toBe(1);
  expect(await registro()).toMatchObject({ jornada: 25, estado: "leido" });
  expect(d.html).toHaveBeenCalledTimes(1);
});
it("tres clasificaciones vacías terminan sin datos con aviso", async () => {
  await grupo();
  const d = descargador();
  vi.mocked(d.pdf).mockResolvedValue(new TextEncoder().encode(clasificacion(26, true)));
  for (let n = 0; n < 3; n++) await avanzarClasificacionesSinCandado(d, AHORA, 2);
  expect(await registro()).toMatchObject({ estado: "sin_datos", vacias: 3 });
  expect((await registro()).aviso).toContain("últimas jornadas");
  expect(await avanzarClasificacionesSinCandado(d, AHORA, 2)).toBe(0);
  expect(d.pdf).toHaveBeenCalledTimes(3);
});
it.each(["html", "pdf"] as const)(
  "red caída en %s cuenta página, espera otro tic y termina tras tres fallos",
  async (etapa) => {
    await grupo();
    const d = descargador();
    if (etapa === "pdf") await avanzarClasificacionesSinCandado(d, AHORA, 1);
    vi.mocked(d[etapa]).mockRejectedValue(Error("Red caída"));
    for (let i = 0; i < 3; i++) expect(await avanzarClasificacionesSinCandado(d, AHORA, 2)).toBe(1);
    expect(await registro()).toMatchObject({ estado: "error", intentos: 3, aviso: "Red caída" });
    expect(await avanzarClasificacionesSinCandado(d, AHORA, 2)).toBe(0);
  },
);
it.each(["html", "pdf"] as const)(
  "formato ilegible %s es terminal, sin reintentos",
  async (etapa) => {
    await grupo();
    const d = descargador();
    if (etapa === "html") vi.mocked(d.html).mockResolvedValue("Ilegible");
    else vi.mocked(d.pdf).mockResolvedValue(new TextEncoder().encode("Ilegible"));
    expect(await avanzarClasificacionesSinCandado(d, AHORA, 2)).toBe(etapa === "html" ? 1 : 2);
    expect((await registro()).estado).toBe("sin_datos");
    expect(await avanzarClasificacionesSinCandado(d, AHORA, 2)).toBe(0);
  },
);
it("tope global dos páginas también con varios grupos y presupuesto uno", async () => {
  await grupo();
  await grupo("301");
  const d = descargador();
  expect(await avanzarHistorico(d, AHORA, 1)).toBe(1);
  expect(d.pdf).not.toHaveBeenCalled();
  expect(await avanzarHistorico(d, AHORA)).toBe(2);
  expect(d.html).toHaveBeenCalledTimes(2);
  expect(d.pdf).toHaveBeenCalledTimes(1);
  expect(await avanzarHistorico(d, AHORA)).toBe(1);
});
it("Otros clubes conserva prioridad frente a clasificaciones", async () => {
  await grupo();
  const [t] = await c.db
    .insert(s.temporadas)
    .values({ nombre: "2026/27", activa: true })
    .returning();
  const [comp] = await c.db
    .insert(s.competiciones)
    .values({ temporadaId: t!.id, nombre: "Liga", categoria: "Senior" })
    .returning();
  const [j] = await c.db
    .insert(s.jugadores)
    .values({ nombre: "Xan", historial: ["23/24: Club Ficticio"] })
    .returning();
  await c.db
    .insert(s.rfgfJugadores)
    .values({
      jugadorId: j!.id,
      codigo: "101",
      competicionId: comp!.id,
      nombre: "Xan",
      codActa: "9",
    });
  await c.db
    .insert(s.rfgfClubes)
    .values({
      codigo: "1",
      nombre: "Club Ficticio",
      clave: "ficticio",
      leidoEn: AHORA.toISOString(),
    });
  const d = descargador();
  vi.mocked(d.html).mockRejectedValue(Error("Red caída"));
  expect(await avanzarHistorico(d, AHORA)).toBe(2);
  expect(vi.mocked(d.html).mock.calls[0]![0]).toContain("VisCompeticiones_Club");
  expect(vi.mocked(d.html).mock.calls[1]![0]).toContain("VisCalendario_Vis");
});
