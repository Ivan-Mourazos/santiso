import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, expect, it, vi } from "vitest";
import type { DescargadorRfgf } from "./descargador";

/**
 * Sincronización con la federación sobre una base de juguete. La web nunca se toca: el
 * descargador es de mentira y el PDF es la ficha anónima que ya usa el lector en sus pruebas.
 */

const FICHA = new Uint8Array(
  readFileSync(path.resolve(__dirname, "../../../../../packages/actas/src/fixtures/senior-1.pdf")),
);
const ENLACE =
  "https://www.futgal.es/pnfg/NPcd/NFG_VisCalendario_Vis?cod_primaria=1000120&codtemporada=22&codcompeticion=26990830&codgrupo=27576591";

const anterior = process.env.SANTISO_DATA_DIR;
afterEach(async () => {
  const conexion = await globalThis.santisoConexionDb;
  conexion?.cerrar();
  globalThis.santisoConexionDb = undefined;
  if (anterior === undefined) delete process.env.SANTISO_DATA_DIR;
  else process.env.SANTISO_DATA_DIR = anterior;
  vi.restoreAllMocks();
});

/** La página de una jornada con un único partido y su acta cerrada. */
function paginaJornada(local: string, visitante: string, codActa: string | null) {
  const acta = codActa
    ? `<a href="/pnfg/NPcd/NFG_CmpPartido?cod_primaria=1000120&CodActa=${codActa}&cod_acta=${codActa}" title="Acta del partido"></a>`
    : "";
  return `<html><body>${"<!-- relleno -->".repeat(200)}
    <a href="NFG_VisEquipos?cod_primaria=1000119&Codigo_Equipo=1">${local}</a>${acta}
    <a href="NFG_VisEquipos?cod_primaria=1000119&Codigo_Equipo=2">${visitante}</a></body></html>`;
}

function descargadorDe(html: string) {
  const pedidas = { html: [] as string[], pdf: [] as string[] };
  const descargador: DescargadorRfgf = {
    async html(url) {
      pedidas.html.push(url);
      return html;
    },
    async pdf(url) {
      pedidas.pdf.push(url);
      return FICHA;
    },
  };
  return { descargador, pedidas };
}

/** En la ficha de prueba el Santiso es el visitante y lleva a «APELLIDO 20…35, PERSONA». */
async function preparar({ santiso = true, sinJugador = false } = {}) {
  process.env.SANTISO_DATA_DIR = mkdtempSync(path.join(tmpdir(), "santiso-rfgf-"));
  vi.resetModules();
  globalThis.santisoConexionDb = undefined;
  const bd = await import("@santiso/db");
  const { db, cerrar } = await bd.abrirDb(
    bd.urlArchivo(path.join(process.env.SANTISO_DATA_DIR, "santiso.db")),
  );
  await bd.migrarBd(db);
  const s = bd.schema;
  const [t] = await db.insert(s.temporadas).values({ nombre: "2025/26", activa: true }).returning();
  const [c] = await db
    .insert(s.competiciones)
    .values({ temporadaId: t!.id, nombre: "Tercera", categoria: "Senior" })
    .returning();
  const [local, visitante] = await db
    .insert(s.equipos)
    .values([
      { nombre: "Equipo Local", clave: "equipo local", categoria: "Senior" },
      { nombre: "Equipo Visitante", clave: "equipo visitante", categoria: "Senior", esPropio: santiso },
    ])
    .returning();
  const [jornada] = await db
    .insert(s.jornadas)
    .values({ competicionId: c!.id, numero: 1 })
    .returning();
  const [p] = await db
    .insert(s.partidos)
    .values({
      jornadaId: jornada!.id,
      equipoLocalId: local!.id,
      equipoVisitanteId: visitante!.id,
      fecha: "2025-09-14T12:00",
    })
    .returning();
  const numeros = Array.from({ length: 16 }, (_, i) => 20 + i).filter((n) => !(sinJugador && n === 27));
  const personas = await db
    .insert(s.jugadores)
    .values(numeros.map((n) => ({ nombre: `Persona Apellido ${n}` })))
    .returning();
  await db.insert(s.jugadoresTemporada).values(
    personas.map((j, i) => ({
      temporadaId: t!.id,
      categoria: "Senior" as const,
      jugadorId: j.id,
      dorsal: i + 1,
    })),
  );
  await db.insert(s.rfgfCompeticiones).values({ competicionId: c!.id, enlace: ENLACE });
  cerrar();
  const { sincronizarCompeticion } = await import("./sincronizar");
  const leer = async () => (await (await import("@/lib/server/db")).obtenerDb()).db;
  return { s, competicionId: c!.id, partidoId: p!.id, sincronizarCompeticion, leer };
}

const AHORA = new Date(2025, 8, 15, 10);

it("guarda sola el acta del Santiso cuando reconoce a todos, y no la vuelve a pedir", async () => {
  const { s, competicionId, partidoId, sincronizarCompeticion, leer } = await preparar();
  const { descargador, pedidas } = descargadorDe(
    paginaJornada("EQUIPO LOCAL", "EQUIPO VISITANTE", "900"),
  );

  const resumen = await sincronizarCompeticion(competicionId, descargador, AHORA);
  expect(resumen).toMatchObject({ actas: 1, revisar: [], errores: [] });
  expect(pedidas.html).toHaveLength(1);
  expect(pedidas.html[0]).toContain("NFG_CmpJornada");
  expect(pedidas.html[0]).toContain("CodJornada=1");
  expect(pedidas.pdf).toEqual([
    "https://www.futgal.es/pnfg/NPcd/NFG_CmpPartido?cod_primaria=1000120&CodActa=900&cod_acta=900&NPcd_Pdf=1",
  ]);

  const db = await leer();
  const [partido] = await db.select().from(s.partidos).where(eq(s.partidos.id, partidoId));
  expect(partido).toMatchObject({ golesLocal: 8, golesVisitante: 2, estado: "finalizado" });
  const convocados = await db
    .select()
    .from(s.partidoParticipaciones)
    .where(eq(s.partidoParticipaciones.partidoId, partidoId));
  expect(convocados).toHaveLength(16);
  expect(convocados.filter((p) => p.titular)).toHaveLength(11);
  const eventos = await db
    .select()
    .from(s.partidoEventos)
    .where(eq(s.partidoEventos.partidoId, partidoId));
  expect(eventos.length).toBeGreaterThan(0);
  expect(await db.select().from(s.rfgfActas)).toMatchObject([
    { codActa: "900", partidoId, estado: "guardada" },
  ]);
  const [enlace] = await db.select().from(s.rfgfCompeticiones);
  expect(enlace?.comprobadoEn).toBe(AHORA.toISOString());
  expect(enlace?.resumen).toBe("1 acta guardada");

  // Segunda pasada: ya no falta nada, no se toca la web.
  const otra = await sincronizarCompeticion(competicionId, descargador, AHORA);
  expect(otra).toMatchObject({ actas: 0, resultados: 0 });
  expect(pedidas.html).toHaveLength(1);
  expect(pedidas.pdf).toHaveLength(1);
});

it("si no reconoce a un jugador guarda el marcador, no el acta, y deja el PDF para revisar", async () => {
  const { s, competicionId, partidoId, sincronizarCompeticion, leer } = await preparar({
    sinJugador: true,
  });
  const { descargador, pedidas } = descargadorDe(
    paginaJornada("EQUIPO LOCAL", "EQUIPO VISITANTE", "901"),
  );

  const resumen = await sincronizarCompeticion(competicionId, descargador, AHORA);
  expect(resumen).toMatchObject({ actas: 0, resultados: 1, errores: [] });
  expect(resumen?.revisar).toHaveLength(1);
  expect(resumen?.revisar[0]).toContain("APELLIDO 27, PERSONA");

  const db = await leer();
  const [partido] = await db.select().from(s.partidos).where(eq(s.partidos.id, partidoId));
  expect(partido).toMatchObject({ golesLocal: 8, golesVisitante: 2 });
  expect(await db.select().from(s.partidoParticipaciones)).toHaveLength(0);
  expect(await db.select().from(s.partidoEventos)).toHaveLength(0);
  expect(await db.select().from(s.rfgfActas)).toMatchObject([{ codActa: "901", estado: "revisar" }]);
  expect(existsSync(path.join(process.env.SANTISO_DATA_DIR!, "rfgf", "901.pdf"))).toBe(true);

  // Un acta por revisar no se descarga otra vez en cada pasada.
  await sincronizarCompeticion(competicionId, descargador, AHORA);
  expect(pedidas.pdf).toHaveLength(1);
});

it("de un partido ajeno solo guarda el resultado", async () => {
  const { s, competicionId, partidoId, sincronizarCompeticion, leer } = await preparar({
    santiso: false,
  });
  const { descargador } = descargadorDe(paginaJornada("EQUIPO LOCAL", "EQUIPO VISITANTE", "902"));

  const resumen = await sincronizarCompeticion(competicionId, descargador, AHORA);
  expect(resumen).toMatchObject({ actas: 0, resultados: 1, revisar: [], errores: [] });
  const db = await leer();
  const [partido] = await db.select().from(s.partidos).where(eq(s.partidos.id, partidoId));
  expect(partido).toMatchObject({ golesLocal: 8, golesVisitante: 2, estado: "finalizado" });
  expect(await db.select().from(s.partidoParticipaciones)).toHaveLength(0);
  expect(await db.select().from(s.rfgfActas)).toMatchObject([{ codActa: "902", estado: "resultado" }]);
});

it("sin acta cerrada o antes de la hora del partido no descarga nada", async () => {
  const { competicionId, sincronizarCompeticion } = await preparar();
  const sinActa = descargadorDe(paginaJornada("EQUIPO LOCAL", "EQUIPO VISITANTE", null));
  expect(await sincronizarCompeticion(competicionId, sinActa.descargador, AHORA)).toMatchObject({
    actas: 0,
    resultados: 0,
  });
  expect(sinActa.pedidas.pdf).toEqual([]);

  const antes = descargadorDe(paginaJornada("EQUIPO LOCAL", "EQUIPO VISITANTE", "903"));
  await sincronizarCompeticion(competicionId, antes.descargador, new Date(2025, 8, 14, 9));
  expect(antes.pedidas.html).toEqual([]);
});

it("un fallo de la federación queda anotado y se reintenta en la siguiente pasada", async () => {
  const { s, competicionId, sincronizarCompeticion, leer } = await preparar();
  const { descargador, pedidas } = descargadorDe(
    paginaJornada("EQUIPO LOCAL", "EQUIPO VISITANTE", "904"),
  );
  let fallar = true;
  const conFallo: DescargadorRfgf = {
    html: descargador.html,
    async pdf(url) {
      if (fallar) throw new Error("La federación respondió 503.");
      return descargador.pdf(url);
    },
  };

  const primera = await sincronizarCompeticion(competicionId, conFallo, AHORA);
  expect(primera?.errores).toHaveLength(1);
  const db = await leer();
  expect(await db.select().from(s.rfgfActas)).toMatchObject([{ codActa: "904", estado: "error" }]);

  fallar = false;
  const segunda = await sincronizarCompeticion(competicionId, conFallo, AHORA);
  expect(segunda).toMatchObject({ actas: 1, errores: [] });
  expect(pedidas.pdf).toHaveLength(1);
  expect(await db.select().from(s.rfgfActas)).toMatchObject([{ codActa: "904", estado: "guardada" }]);
});
