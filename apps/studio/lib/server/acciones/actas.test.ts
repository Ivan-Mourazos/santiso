import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActaPlayerRef, ParsedActa } from "@/lib/actas/types";

/** BD con una competición, dos equipos, una jornada, un partido y dos jugadores propios. */
async function entorno() {
  const dir = mkdtempSync(path.join(tmpdir(), "santiso-actas-"));
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
      { nombre: "Santiso", clave: "santiso", categoria: "Senior", esPropio: true },
      { nombre: "Rival", clave: "rival", categoria: "Senior" },
    ])
    .returning({ id: bd.schema.equipos.id });
  const [jornada] = await db
    .insert(bd.schema.jornadas)
    .values({ competicionId: competicion.id, numero: 1 })
    .returning({ id: bd.schema.jornadas.id });
  if (!jornada || !equipos[0] || !equipos[1]) throw new Error("sin jornada o equipos");
  const [partido] = await db
    .insert(bd.schema.partidos)
    .values({
      jornadaId: jornada.id,
      equipoLocalId: equipos[0].id,
      equipoVisitanteId: equipos[1].id,
    })
    .returning({ id: bd.schema.partidos.id });
  if (!partido) throw new Error("sin partido");
  const jugadores = await db
    .insert(bd.schema.jugadores)
    .values([{ nombre: "Ana" }, { nombre: "Bea" }])
    .returning({ id: bd.schema.jugadores.id, nombre: bd.schema.jugadores.nombre });
  await db.insert(bd.schema.jugadoresTemporada).values(
    jugadores.map((j, i) => ({
      temporadaId: temporada.id,
      jugadorId: j.id,
      categoria: "Senior" as const,
      dorsal: i + 1,
    })),
  );
  cerrar();

  const idDe = (nombre: string) => {
    const encontrado = jugadores.find((j) => j.nombre === nombre);
    if (!encontrado) throw new Error(`sin jugador ${nombre}`);
    return encontrado.id;
  };
  return { acciones: await import("./actas"), partidoId: partido.id, idDe };
}

const ref = (jugadorId: string): ActaPlayerRef => ({
  id: `ref-${jugadorId}`,
  dorsal: "1",
  rawName: "x",
  jugadorId,
});

const acta = (parcial: Partial<ParsedActa> = {}): ParsedActa => ({
  marcadorLocal: "2",
  marcadorVisitante: "1",
  campoNombre: "",
  campoPoblacion: "",
  titulares: [],
  suplentes: [],
  eventos: [],
  warnings: [],
  rawText: "",
  ...parcial,
});

const gol = (id: string, jugadorId: string, minuto: string) => ({
  id,
  tipo: "gol" as const,
  minuto,
  isRival: false,
  confidence: "alta" as const,
  jugador: ref(jugadorId),
});

/** Lee lo que quedó guardado del partido. */
async function estado(partidoId: string) {
  const bd = await import("@santiso/db");
  const { eq } = await import("drizzle-orm");
  const { db } = await (await import("@/lib/server/db")).obtenerDb();
  const [partido] = await db
    .select()
    .from(bd.schema.partidos)
    .where(eq(bd.schema.partidos.id, partidoId));
  const participaciones = await db
    .select()
    .from(bd.schema.partidoParticipaciones)
    .where(eq(bd.schema.partidoParticipaciones.partidoId, partidoId));
  const eventos = await db
    .select()
    .from(bd.schema.partidoEventos)
    .where(eq(bd.schema.partidoEventos.partidoId, partidoId));
  return { partido, participaciones, eventos };
}

describe("guardarActa", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.SANTISO_DATA_DIR;
    vi.restoreAllMocks();
  });

  it("guarda marcador, convocatoria y eventos, y finaliza el partido", async () => {
    const { acciones, partidoId, idDe } = await entorno();
    expect(
      await acciones.guardarActa(
        partidoId,
        acta({
          titulares: [ref(idDe("Ana"))],
          suplentes: [ref(idDe("Bea"))],
          eventos: [gol("e1", idDe("Ana"), "12")],
        }),
      ),
    ).toEqual({ ok: true, datos: null });

    const { partido, participaciones, eventos } = await estado(partidoId);
    expect(partido).toMatchObject({ golesLocal: 2, golesVisitante: 1, estado: "finalizado" });
    expect(participaciones).toHaveLength(2);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({ tipo: "gol", lado: "propio", minuto: 12 });
  });

  it("reimportar sustituye lo anterior en vez de acumularlo", async () => {
    const { acciones, partidoId, idDe } = await entorno();
    await acciones.guardarActa(
      partidoId,
      acta({ titulares: [ref(idDe("Ana"))], eventos: [gol("e1", idDe("Ana"), "12")] }),
    );
    await acciones.guardarActa(
      partidoId,
      acta({
        marcadorLocal: "3",
        marcadorVisitante: "0",
        titulares: [ref(idDe("Bea"))],
        eventos: [gol("e2", idDe("Bea"), "20")],
      }),
    );

    const { partido, participaciones, eventos } = await estado(partidoId);
    expect(partido).toMatchObject({ golesLocal: 3, golesVisitante: 0 });
    expect(participaciones).toHaveLength(1);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({ minuto: 20 });
  });

  it("si el acta trae un evento imposible no toca nada: ni marcador ni datos previos", async () => {
    const { acciones, partidoId, idDe } = await entorno();
    await acciones.guardarActa(
      partidoId,
      acta({ titulares: [ref(idDe("Ana"))], eventos: [gol("e1", idDe("Ana"), "12")] }),
    );
    const antes = await estado(partidoId);

    // Gol propio sin jugador enlazado: la transformación lo rechaza antes de abrir transacción.
    const resultado = await acciones.guardarActa(
      partidoId,
      acta({
        marcadorLocal: "9",
        marcadorVisitante: "9",
        eventos: [{ id: "e2", tipo: "gol", minuto: "30", isRival: false, confidence: "alta" }],
      }),
    );
    expect(resultado.ok).toBe(false);

    const despues = await estado(partidoId);
    expect(despues.partido).toMatchObject({ golesLocal: 2, golesVisitante: 1 });
    expect(despues.participaciones).toHaveLength(antes.participaciones.length);
    expect(despues.eventos).toHaveLength(antes.eventos.length);
  });

  it("si un jugador del acta no existe, la transacción no deja nada a medias", async () => {
    const { acciones, partidoId, idDe } = await entorno();
    await acciones.guardarActa(
      partidoId,
      acta({ titulares: [ref(idDe("Ana"))], eventos: [gol("e1", idDe("Ana"), "12")] }),
    );

    const resultado = await acciones.guardarActa(
      partidoId,
      acta({ marcadorLocal: "5", marcadorVisitante: "5", titulares: [ref("jugador-inexistente")] }),
    );
    expect(resultado.ok).toBe(false);

    const { partido, participaciones, eventos } = await estado(partidoId);
    expect(partido).toMatchObject({ golesLocal: 2, golesVisitante: 1 });
    expect(participaciones).toHaveLength(1);
    expect(eventos).toHaveLength(1);
  });

  it("registra el campo del acta y lo deja apuntado en el partido", async () => {
    const { acciones, partidoId, idDe } = await entorno();
    await acciones.guardarActa(
      partidoId,
      acta({
        campoNombre: "A Carballeira",
        campoPoblacion: "Santiso",
        titulares: [ref(idDe("Ana"))],
      }),
    );

    const { partido } = await estado(partidoId);
    expect(partido?.campoId).toBeTruthy();

    const { cargarCampos } = await import("./campos");
    const campos = await cargarCampos();
    if (!campos.ok) throw new Error("sin campos");
    expect(campos.datos.map((c) => c.nombre)).toEqual(["A Carballeira"]);
  });

  it("rechaza un marcador que no son números", async () => {
    const { acciones, partidoId } = await entorno();
    expect(
      await acciones.guardarActa(partidoId, acta({ marcadorLocal: "dos", marcadorVisitante: "1" })),
    ).toMatchObject({ ok: false });
  });

  it("rechaza guardar en un partido que no existe", async () => {
    const { acciones } = await entorno();
    expect(await acciones.guardarActa("no-existe", acta())).toMatchObject({ ok: false });
  });
});
