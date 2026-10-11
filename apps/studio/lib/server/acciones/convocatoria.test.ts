import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, expect, it, vi } from "vitest";

const anterior = process.env.SANTISO_DATA_DIR;
afterEach(async () => {
  const conexion = await globalThis.santisoConexionDb;
  conexion?.cerrar();
  globalThis.santisoConexionDb = undefined;
  if (anterior === undefined) delete process.env.SANTISO_DATA_DIR;
  else process.env.SANTISO_DATA_DIR = anterior;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("selección por defecto, sustitución, reapertura y paso a alineación sin pisar lo guardado", async () => {
  process.env.SANTISO_DATA_DIR = mkdtempSync(path.join(tmpdir(), "santiso-convocatoria-"));
  vi.resetModules();
  globalThis.santisoConexionDb = undefined;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 11, 12));
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
  const [p] = await db
    .insert(s.partidos)
    .values({
      jornadaId: jornada!.id,
      equipoLocalId: club!.id,
      equipoVisitanteId: rival!.id,
      fecha: "2026-10-18T17:00",
    })
    .returning();
  const personas = await db
    .insert(s.jugadores)
    .values([{ nombre: "Brais" }, { nombre: "Iago" }, { nombre: "Fóra" }])
    .returning();
  const ids = personas.slice(0, 2).map((j) => j.id);
  await db.insert(s.jugadoresTemporada).values(
    ids.map((jugadorId, i) => ({
      temporadaId: t!.id,
      categoria: "Senior" as const,
      jugadorId,
      dorsal: i + 1,
    })),
  );
  cerrar();
  const acciones = await import("./convocatoria");
  const { convocatoriaInicial } = await import("@/lib/convocatoria/modelo");
  const inicial = await acciones.cargarPantallaConvocatoria("Senior", p!.id);
  expect(inicial.ok && inicial.datos.convocatoria.jugadores).toEqual(ids);
  const datos = {
    ...convocatoriaInicial(ids),
    horaQuedada: "16:00",
    lugarQuedada: "Campo",
    equipacion: "Amarela",
    nota: "Puntualidade",
  };
  expect(await acciones.guardarConvocatoria(p!.id, datos)).toEqual({ ok: true, datos: null });
  const reducido = { ...datos, jugadores: [ids[1]!] };
  expect(await acciones.guardarConvocatoria(p!.id, reducido)).toEqual({ ok: true, datos: null });
  const recarga = await acciones.cargarPantallaConvocatoria("Senior", p!.id);
  expect(recarga.ok && recarga.datos.convocatoria).toEqual(reducido);
  const ali = await import("./alineacion");
  const antes = await ali.cargarPantallaAlineacion("Senior", p!.id);
  expect(antes.ok && antes.datos.jugadores.map((j) => j.id)).toEqual([ids[1]]);
  const seleccion = { titulares: [ids[0]!], suplentes: [], capitanId: null };
  await ali.guardarAlineacion(p!.id, seleccion);
  const despues = await ali.cargarPantallaAlineacion("Senior", p!.id);
  expect(despues.ok && despues.datos.alineacion).toEqual(seleccion);
  expect(despues.ok && despues.datos.jugadores.map((j) => j.id)).toEqual(ids);
  const { db: consulta } = await (await import("@/lib/server/db")).obtenerDb();
  expect(await consulta.select().from(s.partidoParticipaciones)).toHaveLength(0);
  // Una baja conserva persona e historial, pero no puede dejar un ID invisible seleccionado.
  await consulta.delete(s.jugadoresTemporada).where(eq(s.jugadoresTemporada.jugadorId, ids[1]!));
  const trasBaja = await acciones.cargarPantallaConvocatoria("Senior", p!.id);
  expect(trasBaja.ok && trasBaja.datos.convocatoria.jugadores).toEqual([]);
  expect(trasBaja.ok && trasBaja.datos.guardada).toBe(false);
  expect(await acciones.guardarConvocatoria(p!.id, { ...datos, jugadores: [ids[0]!] })).toEqual({
    ok: true,
    datos: null,
  });
  expect(await acciones.guardarConvocatoria(p!.id, { ...datos, jugadores: [] })).toMatchObject({
    ok: false,
  });
  expect(
    await acciones.guardarConvocatoria(p!.id, { ...datos, jugadores: [personas[2]!.id] }),
  ).toMatchObject({ ok: false });
  expect(await acciones.guardarConvocatoria("no-existe", datos)).toMatchObject({ ok: false });
  await consulta.update(s.partidos).set({ estado: "finalizado", golesLocal: 0, golesVisitante: 0 });
  expect(await acciones.guardarConvocatoria(p!.id, datos)).toMatchObject({
    ok: false,
    error: "El partido ya se jugó: su convocatoria no se cambia.",
  });
});
