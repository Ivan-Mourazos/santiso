import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Calendario } from "@santiso/actas";

/** BD con una competición y cuatro equipos, sin jornadas ni partidos. */
async function entorno() {
  const dir = mkdtempSync(path.join(tmpdir(), "santiso-calendario-"));
  process.env.SANTISO_DATA_DIR = dir;
  vi.resetModules();
  globalThis.santisoConexionDb = undefined;
  const bd = await import("@santiso/db");
  const { db, cerrar } = await bd.abrirDb(bd.urlArchivo(path.join(dir, "santiso.db")));
  await bd.migrarBd(db);

  const [temporada] = await db
    .insert(bd.schema.temporadas)
    .values({ nombre: "2026/27", activa: true })
    .returning({ id: bd.schema.temporadas.id });
  if (!temporada) throw new Error("sin temporada");

  const [competicion] = await db
    .insert(bd.schema.competiciones)
    .values({ temporadaId: temporada.id, categoria: "Senior", nombre: "Liga" })
    .returning({ id: bd.schema.competiciones.id });
  if (!competicion) throw new Error("sin competición");

  const equipos = await db
    .insert(bd.schema.equipos)
    .values([
      { nombre: "UD Santiso FC", clave: "ud santiso fc", categoria: "Senior", esPropio: true },
      { nombre: "CD Berres", clave: "cd berres", categoria: "Senior", esPropio: false },
      { nombre: "Club Arenal", clave: "club arenal", categoria: "Senior", esPropio: false },
      { nombre: "SD Touro", clave: "sd touro", categoria: "Senior", esPropio: false },
    ])
    .returning({ id: bd.schema.equipos.id, nombre: bd.schema.equipos.nombre });

  return { bd, db, cerrar, competicionId: competicion.id, equipos };
}

/** Dos jornadas de ida y vuelta entre cuatro equipos, con los nombres como los da la RFGF. */
const CALENDARIO: Calendario = {
  competicion: "TERCERA FUTGAL | GRUPO 4",
  temporada: "2026-2027",
  equipos: [
    { nombre: "U.D. SANTISO F.C.", codigoFederativo: "090006" },
    { nombre: "C.D. BERRES", codigoFederativo: "090008" },
    { nombre: "CLUB ARENAL", codigoFederativo: "090010" },
    { nombre: "S.D. TOURO", codigoFederativo: "090012" },
  ],
  jornadas: [
    {
      numero: 1,
      fechaNominal: "2026-09-27",
      partidos: [
        {
          local: { nombre: "U.D. SANTISO F.C.", codigoFederativo: "090006" },
          visitante: { nombre: "C.D. BERRES", codigoFederativo: "090008" },
        },
        {
          local: { nombre: "CLUB ARENAL", codigoFederativo: "090010" },
          visitante: { nombre: "S.D. TOURO", codigoFederativo: "090012" },
        },
      ],
    },
    {
      numero: 2,
      fechaNominal: "2026-10-04",
      partidos: [
        {
          local: { nombre: "C.D. BERRES", codigoFederativo: "090008" },
          visitante: { nombre: "U.D. SANTISO F.C.", codigoFederativo: "090006" },
        },
      ],
    },
  ],
};

let cerrarActual: (() => void | Promise<void>) | null = null;

afterEach(async () => {
  await cerrarActual?.();
  cerrarActual = null;
  delete process.env.SANTISO_DATA_DIR;
  globalThis.santisoConexionDb = undefined;
});

beforeEach(() => {
  vi.resetModules();
});

describe("guardarCalendario", () => {
  it("crea las jornadas y los cruces, y la segunda vez no hace nada", async () => {
    const { bd, db, cerrar, competicionId, equipos } = await entorno();
    cerrarActual = cerrar;
    const { planDeImportacion } = await import("@/lib/calendario/plan-importacion");
    const { guardarCalendario } = await import("./calendario-pdf");

    const estado = { equipos, jornadas: [], cruces: [] };
    const plan = planDeImportacion(CALENDARIO, estado);
    expect(plan.resumen).toMatchObject({ jornadasNuevas: 2, crucesNuevos: 3, crucesSinEquipo: 0 });

    const primero = await guardarCalendario({ competicionId, plan });
    if (!primero.ok) throw new Error(primero.error);
    expect(primero.datos).toEqual({ jornadas: 2, partidos: 3 });

    const jornadas = await db
      .select({ id: bd.schema.jornadas.id, numero: bd.schema.jornadas.numero, fechaInicio: bd.schema.jornadas.fechaInicio })
      .from(bd.schema.jornadas);
    expect(jornadas).toHaveLength(2);
    // La fecha nominal es de la jornada, no de cada partido.
    expect(jornadas.find((j) => j.numero === 1)?.fechaInicio).toBe("2026-09-27");

    const partidos = await db.select().from(bd.schema.partidos);
    expect(partidos).toHaveLength(3);
    expect(partidos.every((p) => p.golesLocal === null && p.fecha === null && p.campoId === null)).toBe(true);

    // Segunda pasada sobre el estado ya escrito: el plan no propone nada y no se escribe nada.
    const segundoPlan = planDeImportacion(CALENDARIO, {
      equipos,
      jornadas,
      cruces: partidos.map((p) => ({
        jornadaNumero: jornadas.find((j) => j.id === p.jornadaId)?.numero ?? 0,
        equipoLocalId: p.equipoLocalId,
        equipoVisitanteId: p.equipoVisitanteId,
      })),
    });
    expect(segundoPlan.resumen).toMatchObject({ jornadasNuevas: 0, crucesNuevos: 0, crucesExistentes: 3 });

    const segundo = await guardarCalendario({ competicionId, plan: segundoPlan });
    if (!segundo.ok) throw new Error(segundo.error);
    expect(segundo.datos).toEqual({ jornadas: 0, partidos: 0 });
    expect(await db.select().from(bd.schema.partidos)).toHaveLength(3);
  });

  it("no pisa un partido que ya tiene marcador", async () => {
    const { bd, db, cerrar, competicionId, equipos } = await entorno();
    cerrarActual = cerrar;
    const { planDeImportacion } = await import("@/lib/calendario/plan-importacion");
    const { guardarCalendario } = await import("./calendario-pdf");

    const primerPlan = planDeImportacion(CALENDARIO, { equipos, jornadas: [], cruces: [] });
    const primero = await guardarCalendario({ competicionId, plan: primerPlan });
    if (!primero.ok) throw new Error(primero.error);

    // Se mete un resultado, como haría un acta.
    const [conMarcador] = await db.select().from(bd.schema.partidos);
    if (!conMarcador) throw new Error("sin partido");
    await db
      .update(bd.schema.partidos)
      .set({ golesLocal: 3, golesVisitante: 1, estado: "finalizado" })
      .where(eq(bd.schema.partidos.id, conMarcador.id));

    // Se vuelve a importar el mismo calendario desde cero, como si el usuario repitiera.
    const otraVez = planDeImportacion(CALENDARIO, { equipos, jornadas: [], cruces: [] });
    expect(otraVez.resumen.crucesNuevos).toBe(3);
    const segundo = await guardarCalendario({ competicionId, plan: otraVez });
    if (!segundo.ok) throw new Error(segundo.error);

    const despues = await db.select().from(bd.schema.partidos);
    expect(despues).toHaveLength(3);
    const mismo = despues.find((p) => p.id === conMarcador.id);
    expect(mismo).toMatchObject({ golesLocal: 3, golesVisitante: 1, estado: "finalizado" });
  });
});
