import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";

const anterior = process.env.SANTISO_DATA_DIR;
afterEach(async () => {
  (await globalThis.santisoConexionDb)?.cerrar();
  globalThis.santisoConexionDb = undefined;
  if (anterior === undefined) delete process.env.SANTISO_DATA_DIR;
  else process.env.SANTISO_DATA_DIR = anterior;
  vi.restoreAllMocks();
});

it("consulta puesto y últimas cinco antes del partido; separa competición y no inventa copa", async () => {
  process.env.SANTISO_DATA_DIR = mkdtempSync(path.join(tmpdir(), "santiso-previa-"));
  vi.resetModules();
  globalThis.santisoConexionDb = undefined;
  const bd = await import("@santiso/db");
  const { db, cerrar } = await bd.abrirDb(
    bd.urlArchivo(path.join(process.env.SANTISO_DATA_DIR, "santiso.db")),
  );
  await bd.migrarBd(db);
  const s = bd.schema;
  const [t] = await db.insert(s.temporadas).values({ nombre: "2026/27", activa: true }).returning();
  const [liga, copa] = await db
    .insert(s.competiciones)
    .values([
      { temporadaId: t!.id, nombre: "Liga", categoria: "Senior", formato: "liga" },
      { temporadaId: t!.id, nombre: "Copa", categoria: "Senior", formato: "eliminatoria" },
    ])
    .returning();
  const [club, rival] = await db
    .insert(s.equipos)
    .values([
      { nombre: "Santiso", clave: "santiso", categoria: "Senior", esPropio: true },
      { nombre: "Compañía de María", clave: "compania", categoria: "Senior" },
    ])
    .returning();
  await db
    .insert(s.competicionEquipos)
    .values([club!, rival!].map((e) => ({ competicionId: liga!.id, equipoId: e.id })));
  const js = await db
    .insert(s.jornadas)
    .values(Array.from({ length: 9 }, (_, i) => ({ competicionId: liga!.id, numero: i + 1 })))
    .returning();
  for (let i = 0; i < 6; i++)
    await db.insert(s.partidos).values({
      jornadaId: js[i]!.id,
      equipoLocalId: club!.id,
      equipoVisitanteId: rival!.id,
      estado: "finalizado",
      golesLocal: [1, 0, 0, 2, 1, 3][i],
      golesVisitante: 1,
      fecha: `2026-10-0${i + 1}T17:00`,
    });
  const [campo] = await db
    .insert(s.campos)
    .values({ nombre: "A Merced", clave: "merced", poblacion: "Santiso" })
    .returning();
  const [proximo] = await db
    .insert(s.partidos)
    .values({
      jornadaId: js[6]!.id,
      equipoLocalId: rival!.id,
      equipoVisitanteId: club!.id,
      campoId: campo!.id,
      fecha: "2026-10-18T17:00",
    })
    .returning();
  await db
    .insert(s.partidos)
    .values({
      jornadaId: js[7]!.id,
      equipoLocalId: club!.id,
      equipoVisitanteId: rival!.id,
      estado: "finalizado",
      golesLocal: 99,
      golesVisitante: 0,
      fecha: "2026-11-01T17:00",
    });
  const [jc] = await db
    .insert(s.jornadas)
    .values({ competicionId: copa!.id, numero: 1 })
    .returning();
  const [pc] = await db
    .insert(s.partidos)
    .values({ jornadaId: jc!.id, equipoLocalId: club!.id, equipoVisitanteId: rival!.id })
    .returning();
  cerrar();
  const { cargarPreviasCartel } = await import("./previa-cartel");
  const r = await cargarPreviasCartel([proximo!.id, pc!.id, "desconocido"]);
  expect(r.ok).toBe(true);
  if (!r.ok) throw new Error(r.error);
  expect(r.datos[proximo!.id]).toMatchObject({
    localidad: "Santiso",
    club: { posicion: 1, racha: ["D", "D", "V", "E", "V"] },
    rival: { posicion: 2, racha: ["V", "V", "D", "E", "D"] },
  });
  expect(r.datos[pc!.id]).toMatchObject({
    club: { posicion: null, racha: [] },
    rival: { posicion: null, racha: [] },
  });
  expect(r.datos.desconocido).toBeUndefined();
  expect((await cargarPreviasCartel(Array(5).fill(proximo!.id))).ok).toBe(false);
});
