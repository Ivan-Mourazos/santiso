import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, expect, it, vi } from "vitest";
import type { EventoDirecto } from "@/lib/directo/tipos";

const anterior = process.env.SANTISO_DATA_DIR;
afterEach(async () => {
  const conexion = await globalThis.santisoConexionDb;
  conexion?.cerrar();
  globalThis.santisoConexionDb = undefined;
  if (anterior === undefined) delete process.env.SANTISO_DATA_DIR;
  else process.env.SANTISO_DATA_DIR = anterior;
  vi.restoreAllMocks();
});

async function preparar() {
  process.env.SANTISO_DATA_DIR = mkdtempSync(path.join(tmpdir(), "santiso-directo-"));
  vi.resetModules();
  globalThis.santisoConexionDb = undefined;
  const bd = await import("@santiso/db");
  const { db, cerrar } = await bd.abrirDb(
    bd.urlArchivo(path.join(process.env.SANTISO_DATA_DIR, "santiso.db")),
  );
  await bd.migrarBd(db);
  const s = bd.schema;
  const [t] = await db.insert(s.temporadas).values({ nombre: "2026/27", activa: true }).returning();
  const [c] = await db
    .insert(s.competiciones)
    .values({ temporadaId: t!.id, nombre: "Liga", categoria: "Senior" })
    .returning();
  const [club, rival] = await db
    .insert(s.equipos)
    .values([
      { nombre: "Santiso", clave: "santiso", categoria: "Senior", esPropio: true },
      { nombre: "Rival", clave: "rival", categoria: "Senior" },
    ])
    .returning();
  const [jornada] = await db
    .insert(s.jornadas)
    .values({ competicionId: c!.id, numero: 1 })
    .returning();
  const [p, otro] = await db
    .insert(s.partidos)
    .values([
      { jornadaId: jornada!.id, equipoLocalId: rival!.id, equipoVisitanteId: club!.id },
      { jornadaId: jornada!.id, equipoLocalId: club!.id, equipoVisitanteId: rival!.id },
    ])
    .returning();
  const personas = await db
    .insert(s.jugadores)
    .values([{ nombre: "Brais" }, { nombre: "Iago" }, { nombre: "Pablo" }])
    .returning();
  await db.insert(s.jugadoresTemporada).values(
    personas.map((j, i) => ({
      temporadaId: t!.id,
      categoria: "Senior" as const,
      jugadorId: j.id,
      dorsal: [9, 6, 1][i]!,
    })),
  );
  cerrar();
  const acciones = await import("./directo");
  const { db: conexion } = await (await import("@/lib/server/db")).obtenerDb();
  return { s, p: p!, otro: otro!, personas, acciones, db: conexion };
}

const evento = (extra: Partial<EventoDirecto> = {}): EventoDirecto => ({
  id: "m-1",
  tipo: "gol",
  lado: "propio",
  propia: false,
  parte: 1,
  minuto: 23,
  jugadorId: null,
  jugadorSaleId: null,
  dorsal: 9,
  dorsalSale: null,
  nota: "",
  ...extra,
});

it("cargarDirecto sin libreta: reloj inicial, sin eventos y plantilla ordenada por dorsal", async () => {
  const { p, acciones } = await preparar();
  const r = await acciones.cargarDirecto(p.id);
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.datos.reloj).toMatchObject({ estado: "previo", duracionParte: 45 });
  expect(r.datos.eventos).toEqual([]);
  expect(r.datos.jugadores.map((j) => j.dorsal)).toEqual([1, 6, 9]);
  expect(r.datos.partido).toMatchObject({
    local: "Rival",
    visitante: "Santiso",
    somosLocal: false,
    categoria: "Senior",
  });
  expect(await acciones.cargarDirecto("no-existe")).toMatchObject({ ok: false });
});

it("con convocatoria solo salen los convocados", async () => {
  const { s, p, personas, acciones, db } = await preparar();
  await db.insert(s.partidoConvocatorias).values({ partidoId: p.id });
  await db.insert(s.partidoConvocados).values({ partidoId: p.id, jugadorId: personas[0]!.id });
  const r = await acciones.cargarDirecto(p.id);
  expect(r.ok && r.datos.jugadores).toEqual([{ id: personas[0]!.id, nombre: "Brais", dorsal: 9 }]);
});

it("guardar dos veces el mismo id deja una fila; borrar inexistente no falla; reloj se guarda", async () => {
  const { p, personas, acciones } = await preparar();
  const ops = [
    { op: "guardar" as const, evento: evento() },
    { op: "guardar" as const, evento: evento({ minuto: 24, jugadorId: personas[0]!.id }) },
    { op: "borrar" as const, id: "nunca-existio" },
    {
      op: "reloj" as const,
      reloj: {
        duracionParte: 40,
        estado: "primera" as const,
        inicioParte: 1000,
        pausadoMs: 0,
        pausaDesde: null,
      },
    },
  ];
  expect(await acciones.aplicarDirecto(p.id, ops)).toEqual({ ok: true, datos: null });
  expect(await acciones.aplicarDirecto(p.id, ops)).toEqual({ ok: true, datos: null });
  const r = await acciones.cargarDirecto(p.id);
  expect(r.ok && r.datos.eventos).toEqual([evento({ minuto: 24, jugadorId: personas[0]!.id })]);
  expect(r.ok && r.datos.reloj).toMatchObject({ duracionParte: 40, estado: "primera" });
  await acciones.aplicarDirecto(p.id, [{ op: "borrar", id: "m-1" }]);
  const r2 = await acciones.cargarDirecto(p.id);
  expect(r2.ok && r2.datos.eventos).toEqual([]);
});

it("eventos ordenados por parte y minuto", async () => {
  const { p, acciones } = await preparar();
  await acciones.aplicarDirecto(p.id, [
    { op: "guardar", evento: evento({ id: "a", parte: 2, minuto: 50 }) },
    { op: "guardar", evento: evento({ id: "b", parte: 1, minuto: 47 }) },
    { op: "guardar", evento: evento({ id: "c", parte: 1, minuto: 10 }) },
  ]);
  const r = await acciones.cargarDirecto(p.id);
  expect(r.ok && r.datos.eventos.map((e) => e.id)).toEqual(["c", "b", "a"]);
});

it("id de otro partido: fallo y nada cambia", async () => {
  const { p, otro, acciones } = await preparar();
  await acciones.aplicarDirecto(otro.id, [{ op: "guardar", evento: evento() }]);
  const r = await acciones.aplicarDirecto(p.id, [
    { op: "guardar", evento: evento({ minuto: 80 }) },
  ]);
  expect(r).toMatchObject({ ok: false });
  const enOtro = await acciones.cargarDirecto(otro.id);
  expect(enOtro.ok && enOtro.datos.eventos[0]!.minuto).toBe(23);
  // Borrar desde otro partido tampoco toca nada.
  await acciones.aplicarDirecto(p.id, [{ op: "borrar", id: "m-1" }]);
  const sigue = await acciones.cargarDirecto(otro.id);
  expect(sigue.ok && sigue.datos.eventos).toHaveLength(1);
});

it("operación inválida: fallo y las anteriores no se aplican", async () => {
  const { p, acciones } = await preparar();
  const r = await acciones.aplicarDirecto(p.id, [
    { op: "guardar", evento: evento({ id: "a" }) },
    { op: "guardar", evento: evento({ id: "b" }) },
    { op: "guardar", evento: evento({ id: "c", tipo: "penalti" as never }) },
  ]);
  expect(r).toMatchObject({ ok: false });
  const r2 = await acciones.aplicarDirecto(p.id, [
    { op: "guardar", evento: evento({ id: "d", parte: 3 as never }) },
  ]);
  expect(r2).toMatchObject({ ok: false });
  const c = await acciones.cargarDirecto(p.id);
  expect(c.ok && c.datos.eventos).toEqual([]);
});

it("no toca el acta ni el partido; jugador borrado conserva el dorsal", async () => {
  const { s, p, personas, acciones, db } = await preparar();
  const [antes] = await db.select().from(s.partidos).where(eq(s.partidos.id, p.id));
  await acciones.aplicarDirecto(p.id, [
    { op: "guardar", evento: evento({ jugadorId: personas[2]!.id, dorsal: 1 }) },
  ]);
  expect(await db.select().from(s.partidoEventos)).toEqual([]);
  expect(await db.select().from(s.partidoParticipaciones)).toEqual([]);
  const [despues] = await db.select().from(s.partidos).where(eq(s.partidos.id, p.id));
  expect(despues).toEqual(antes);
  await db
    .delete(s.jugadoresTemporada)
    .where(eq(s.jugadoresTemporada.jugadorId, personas[2]!.id));
  await db.delete(s.jugadores).where(eq(s.jugadores.id, personas[2]!.id));
  const r = await acciones.cargarDirecto(p.id);
  expect(r.ok && r.datos.eventos[0]).toMatchObject({ jugadorId: null, dorsal: 1 });
});

it("un jugador que ya no existe no atasca el lote: se guarda sin jugador y con su dorsal", async () => {
  const { p, acciones } = await preparar();
  const r = await acciones.aplicarDirecto(p.id, [
    { op: "guardar", evento: evento({ id: "a", jugadorId: "borrado", jugadorSaleId: "otro" }) },
    { op: "guardar", evento: evento({ id: "b" }) },
  ]);
  expect(r).toEqual({ ok: true, datos: null });
  const c = await acciones.cargarDirecto(p.id);
  expect(c.ok && c.datos.eventos.map((e) => [e.id, e.jugadorId, e.jugadorSaleId, e.dorsal])).toEqual([
    ["a", null, null, 9],
    ["b", null, null, 9],
  ]);
});
