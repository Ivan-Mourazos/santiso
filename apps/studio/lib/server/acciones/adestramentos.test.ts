import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { claveNombre } from "@santiso/domain";
import type { Marca } from "@/lib/adestramentos/modelo";
async function entorno() {
  process.env.SANTISO_DATA_DIR = mkdtempSync(path.join(tmpdir(), "santiso-asistencia-"));
  vi.resetModules();
  globalThis.santisoConexionDb = undefined;
  const bd = await import("@santiso/db");
  const conexion = await bd.abrirDb(
    bd.urlArchivo(path.join(process.env.SANTISO_DATA_DIR, "santiso.db")),
  );
  await bd.migrarBd(conexion.db);
  globalThis.santisoConexionDb = Promise.resolve(conexion);
  const { db } = conexion;
  const s = bd.schema;
  const [t] = await db.insert(s.temporadas).values({ nombre: "2026/27", activa: true }).returning();
  const [j] = await db.insert(s.jugadores).values({ nombre: "Jugador Ficticio" }).returning();
  await db
    .insert(s.jugadoresTemporada)
    .values({ jugadorId: j!.id, temporadaId: t!.id, categoria: "Senior" });
  const [tecnico] = await db.insert(s.staff).values({ nombre: "Técnico Ficticio" }).returning();
  await db.insert(s.staffTemporada).values({
    staffId: tecnico!.id,
    temporadaId: t!.id,
    categoria: "Senior",
    tipo: "tecnico",
    cargo: "Entrenador",
  });
  await db.insert(s.multasConceptos).values([
    {
      nombre: "Chegar tarde (inxustificado)",
      clave: claveNombre("Chegar tarde (inxustificado)"),
      grupo: "adestramento",
      importeCentimos: 70,
    },
    {
      nombre: "Non asistencia (inxustificada)",
      clave: claveNombre("Non asistencia (inxustificada)"),
      grupo: "adestramento",
      importeCentimos: 130,
    },
  ]);
  const acciones = await import("./adestramentos");
  const marcas: Marca[] = [
    { personaClave: `jugador:${j!.id}`, estado: "tarde", justificado: false, motivo: "Tráfico" },
    { personaClave: `staff:${tecnico!.id}`, estado: "tarde", justificado: false },
  ];
  const guardar = (id?: string) =>
    acciones.guardarAdestramento({ id, categoria: "Senior", fecha: "2026-11-01", marcas });
  const alta = async () => {
    const r = await guardar();
    if (!r.ok) throw new Error(r.error);
    return r.datos.id;
  };
  return { db, s, marcas, guardar, alta, acciones, conexion };
}
describe("acciones asistencia con base temporal", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(async () => {
    (await globalThis.santisoConexionDb)?.cerrar();
    globalThis.santisoConexionDb = undefined;
    delete process.env.SANTISO_DATA_DIR;
    vi.restoreAllMocks();
  });
  it("alta, técnico doble desde catálogo, doble guardado y sustitución", async () => {
    const e = await entorno();
    const id = await e.alta();
    expect(
      (await e.db.select().from(e.s.multas)).map((m) => m.importeCentimos).sort((a, b) => a - b),
    ).toEqual([70, 140]);
    await e.guardar(id);
    expect(await e.db.select().from(e.s.multas)).toHaveLength(2);
    e.marcas[0]!.estado = "ausente";
    await e.guardar(id);
    expect(
      (await e.db.select().from(e.s.multas)).map((m) => m.importeCentimos).sort((a, b) => a - b),
    ).toEqual([130, 140]);
    e.marcas[0]!.justificado = true;
    await e.guardar(id);
    expect(await e.db.select().from(e.s.multas)).toHaveLength(1);
    e.marcas[1]!.estado = "presente";
    await e.guardar(id);
    expect(await e.db.select().from(e.s.multas)).toHaveLength(0);
  });
  it("pagadas intocables al cambiar y borrar; pendientes eliminadas", async () => {
    const e = await entorno();
    const id = await e.alta();
    const [m] = await e.db.select().from(e.s.multas);
    await e.db.update(e.s.multas).set({ pagadaEn: "2026-11-01" }).where(eq(e.s.multas.id, m!.id));
    e.marcas[0]!.estado = "presente";
    const r = await e.guardar(id);
    expect(r.ok && r.datos.avisos.length).toBe(1);
    expect(await e.db.select().from(e.s.multas)).toHaveLength(2);
    const borrado = await e.acciones.borrarAdestramento(id);
    expect(borrado.ok && borrado.datos.avisos.length).toBe(1);
    expect(await e.db.select().from(e.s.asistencias)).toHaveLength(0);
    expect((await e.db.select().from(e.s.multas)).map((m) => m.pagadaEn)).toEqual(["2026-11-01"]);
  });
  it("borrado manual deja FK null y no recrea al guardar ni cambiar motivo", async () => {
    const e = await entorno();
    const id = await e.alta();
    const multas = await e.db.select().from(e.s.multas);
    for (const m of multas) await e.db.delete(e.s.multas).where(eq(e.s.multas.id, m.id));
    expect((await e.db.select().from(e.s.asistencias)).every((a) => a.multaId === null)).toBe(true);
    e.marcas[0]!.motivo = "Otro motivo";
    await e.guardar(id);
    expect(await e.db.select().from(e.s.multas)).toHaveLength(0);
  });
  it("concepto inactivo o ausente avisa, conserva asistencia y no inventa importe", async () => {
    const e = await entorno();
    await e.db.update(e.s.multasConceptos).set({ activo: false });
    const r = await e.guardar();
    expect(r.ok && r.datos.avisos.length).toBe(2);
    expect(await e.db.select().from(e.s.asistencias)).toHaveLength(2);
    expect(await e.db.select().from(e.s.multas)).toHaveLength(0);
    await e.db.delete(e.s.multasConceptos);
    if (!r.ok) throw new Error(r.error);
    e.marcas[0]!.estado = "ausente";
    const cambio = await e.guardar(r.datos.id);
    expect(cambio.ok && cambio.datos.avisos.length).toBe(1);
  });
  it("histórico conserva personas fuera de plantilla y categoría independiente", async () => {
    const e = await entorno();
    await e.alta();
    await e.db.delete(e.s.jugadoresTemporada);
    const r = await e.acciones.cargarAdestramentos("Senior");
    expect(r.ok && r.datos.personas.length).toBe(2);
    const otro = await e.acciones.cargarAdestramentos("Veteranos");
    expect(otro.ok && otro.datos.entrenamientos).toEqual([]);
  });
  it("una entrada ajena revierte toda la transaccion", async () => {
    const e = await entorno();
    e.marcas.push({ personaClave: "jugador:ajeno", estado: "ausente", justificado: false });
    expect((await e.guardar()).ok).toBe(false);
    expect(await e.db.select().from(e.s.entrenamientos)).toHaveLength(0);
    expect(await e.db.select().from(e.s.multas)).toHaveLength(0);
  });
  it("motivo pagado permanece intacto y avisa", async () => {
    const e = await entorno();
    const id = await e.alta();
    const [m] = await e.db
      .select()
      .from(e.s.multas)
      .where(eq(e.s.multas.jugadorId, e.marcas[0]!.personaClave.slice(8)));
    await e.db.update(e.s.multas).set({ pagadaEn: "2026-11-01" }).where(eq(e.s.multas.id, m!.id));
    const [pagada] = await e.db.select().from(e.s.multas).where(eq(e.s.multas.id, m!.id));
    e.marcas[0]!.motivo = "Cambio de motivo";
    const r = await e.guardar(id);
    expect(r.ok && r.datos.avisos.length).toBe(1);
    const [despues] = await e.db.select().from(e.s.multas).where(eq(e.s.multas.id, m!.id));
    expect(despues).toEqual(pagada);
  });
  it("tecnico sin categoria entra en ambas categorias y Multas lo conserva una vez", async () => {
    const e = await entorno();
    // Compatibilidad con filas NULL: el CHECK actual solo permite NULL para directiva.
    // Omite exclusivamente CHECK durante esta siembra de la base temporal.
    await e.db.run(sql`PRAGMA ignore_check_constraints = ON`);
    try {
      await e.db.update(e.s.staffTemporada).set({ categoria: null });
    } finally {
      await e.db.run(sql`PRAGMA ignore_check_constraints = OFF`);
    }
    const [t] = await e.db.select().from(e.s.temporadas);
    const { personas } = await import("../personas-multas");
    for (const categoria of ["Senior", "Veteranos"] as const) {
      const lista = await personas(e.db, t!.id, categoria);
      expect(lista.filter((p) => p.clave === e.marcas[1]!.personaClave)).toHaveLength(1);
      const pantalla = await e.acciones.cargarAdestramentos(categoria);
      expect(pantalla.ok && pantalla.datos.actuales.includes(e.marcas[1]!.personaClave)).toBe(true);
    }
    const multas = await personas(e.db, t!.id);
    expect(multas).toHaveLength(2);
    expect(multas.filter((p) => p.clave === e.marcas[1]!.personaClave)).toHaveLength(1);
  });
  it("quitar ultima plantilla de jugador con asistencias borra en cascada sin error", async () => {
    const e = await entorno();
    await e.alta();
    const [inscripcion] = await e.db.select().from(e.s.jugadoresTemporada);
    const { quitarJugadorDeTemporada } = await import("./jugadores");
    expect(await quitarJugadorDeTemporada(inscripcion!.id)).toEqual({ ok: true, datos: null });
    expect(await e.db.select().from(e.s.jugadores)).toHaveLength(0);
    expect(await e.db.select().from(e.s.jugadoresTemporada)).toHaveLength(0);
    const asistencias = await e.db.select().from(e.s.asistencias);
    expect(asistencias).toHaveLength(1);
    expect(asistencias[0]!.jugadorId).toBeNull();
    const multas = await e.db.select().from(e.s.multas);
    expect(multas).toHaveLength(1);
    expect(multas[0]!.jugadorId).toBeNull();
  });
  it("quitar ultimo papel de tecnico con asistencias borra en cascada sin error", async () => {
    const e = await entorno();
    await e.alta();
    const [inscripcion] = await e.db.select().from(e.s.staffTemporada);
    const { quitarMiembroStaffDeTemporada } = await import("./staff");
    expect(await quitarMiembroStaffDeTemporada(inscripcion!.id)).toEqual({ ok: true, datos: null });
    expect(await e.db.select().from(e.s.staff)).toHaveLength(0);
    expect(await e.db.select().from(e.s.staffTemporada)).toHaveLength(0);
    const asistencias = await e.db.select().from(e.s.asistencias);
    expect(asistencias).toHaveLength(1);
    expect(asistencias[0]!.staffId).toBeNull();
    const multas = await e.db.select().from(e.s.multas);
    expect(multas).toHaveLength(1);
    expect(multas[0]!.staffId).toBeNull();
  });
});
