import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Un jugador que llevó el 9 en 2025/26 y lleva el 10 en 2026/27, con un partido en cada
 * temporada. El once del cartel de cada partido tiene que salir con el dorsal de su año.
 */
async function entorno() {
  const dir = mkdtempSync(path.join(tmpdir(), "santiso-convocatoria-"));
  process.env.SANTISO_DATA_DIR = dir;
  vi.resetModules();
  globalThis.santisoConexionDb = undefined;
  const bd = await import("@santiso/db");
  const { db, cerrar } = await bd.abrirDb(bd.urlArchivo(path.join(dir, "santiso.db")));
  await bd.migrarBd(db);
  const s = bd.schema;

  const [local, visitante] = await db
    .insert(s.equipos)
    .values([
      { nombre: "Santiso", clave: "santiso", categoria: "Senior", esPropio: true },
      { nombre: "Rival", clave: "rival", categoria: "Senior" },
    ])
    .returning({ id: s.equipos.id });
  const [brais, apoio] = await db
    .insert(s.jugadores)
    .values([{ nombre: "Brais" }, { nombre: "Apoio" }])
    .returning({ id: s.jugadores.id });
  if (!local || !visitante || !brais || !apoio) throw new Error("sin datos base");

  const partidos: Record<string, string> = {};
  for (const [nombre, activa, dorsal] of [
    ["2025/26", false, 9],
    ["2026/27", true, 10],
  ] as const) {
    const [temporada] = await db
      .insert(s.temporadas)
      .values({ nombre, activa })
      .returning({ id: s.temporadas.id });
    const [competicion] = await db
      .insert(s.competiciones)
      .values({ temporadaId: temporada!.id, categoria: "Senior", nombre: "Liga" })
      .returning({ id: s.competiciones.id });
    const [jornada] = await db
      .insert(s.jornadas)
      .values({ competicionId: competicion!.id, numero: 1 })
      .returning({ id: s.jornadas.id });
    const [partido] = await db
      .insert(s.partidos)
      .values({ jornadaId: jornada!.id, equipoLocalId: local.id, equipoVisitanteId: visitante.id })
      .returning({ id: s.partidos.id });
    partidos[nombre] = partido!.id;

    await db.insert(s.jugadoresTemporada).values({
      temporadaId: temporada!.id,
      jugadorId: brais.id,
      categoria: "Senior",
      dorsal,
    });
    await db
      .insert(s.partidoParticipaciones)
      .values({ partidoId: partido!.id, jugadorId: brais.id, titular: true, jugo: true });
  }

  // "Apoio" solo está inscrito en veteranos en 2025/26, pero jugó el partido sénior de ese año.
  const [anterior] = await db
    .select({ id: s.temporadas.id })
    .from(s.temporadas)
    .where(eq(s.temporadas.nombre, "2025/26"));
  await db
    .insert(s.jugadoresTemporada)
    .values({ temporadaId: anterior!.id, jugadorId: apoio.id, categoria: "Veteranos", dorsal: 33 });
  await db
    .insert(s.partidoParticipaciones)
    .values({ partidoId: partidos["2025/26"]!, jugadorId: apoio.id, titular: false, jugo: true });

  cerrar();
  return { consultas: await import("./actas"), partidos };
}

afterEach(() => {
  delete process.env.SANTISO_DATA_DIR;
  globalThis.santisoConexionDb = undefined;
});

describe("participacionesDePartido", () => {
  it("usa el dorsal de la temporada del partido, no el de hoy", async () => {
    const { consultas, partidos } = await entorno();
    const deAntes = await consultas.participacionesDePartido(partidos["2025/26"]!);
    const deAhora = await consultas.participacionesDePartido(partidos["2026/27"]!);
    expect(deAntes.find((f) => f.nombre === "Brais")?.dorsal).toBe(9);
    expect(deAhora.find((f) => f.nombre === "Brais")?.dorsal).toBe(10);
  });

  it("si jugó en una categoría en la que no estaba inscrito, toma su dorsal de ese año", async () => {
    const { consultas, partidos } = await entorno();
    const filas = await consultas.participacionesDePartido(partidos["2025/26"]!);
    expect(filas.find((f) => f.nombre === "Apoio")).toMatchObject({ dorsal: 33, titular: false });
    // Titulares primero.
    expect(filas.map((f) => f.nombre)).toEqual(["Brais", "Apoio"]);
  });
});
