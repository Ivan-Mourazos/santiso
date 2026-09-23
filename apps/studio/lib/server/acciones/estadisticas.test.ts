import { schema as s, type ConexionDb } from "@santiso/db";
import { crearDbPrueba } from "@santiso/db/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cargarPantallaEstadisticas } from "./estadisticas";

let conexion: ConexionDb;

beforeEach(async () => {
  conexion = await crearDbPrueba();
  const { db } = conexion;
  await db.insert(s.temporadas).values([
    { id: "anterior", nombre: "2025/26" },
    { id: "actual", nombre: "2026/27", activa: true },
  ]);
  await db.insert(s.jugadores).values([
    { id: "goleador", nombre: "Zoe Ficticia" },
    { id: "suplente", nombre: "Ana Ficticia" },
  ]);
  await db.insert(s.jugadoresTemporada).values([
    { jugadorId: "goleador", temporadaId: "anterior", categoria: "Senior", dorsal: 9 },
    { jugadorId: "suplente", temporadaId: "anterior", categoria: "Senior", dorsal: 14 },
    { jugadorId: "goleador", temporadaId: "actual", categoria: "Senior", dorsal: 7 },
  ]);
  await db.insert(s.equipos).values([
    { id: "propio", nombre: "Club", clave: "club", categoria: "Senior", esPropio: true },
    { id: "rival", nombre: "Rival", clave: "rival", categoria: "Senior" },
  ]);
  // Dos competiciones en la temporada anterior, una en la activa y otra de Veteranos.
  await db.insert(s.competiciones).values([
    { id: "liga", temporadaId: "anterior", categoria: "Senior", nombre: "Liga", orden: 0 },
    { id: "copa", temporadaId: "anterior", categoria: "Senior", nombre: "Copa", orden: 1 },
    { id: "veteranos", temporadaId: "anterior", categoria: "Veteranos", nombre: "Liga V" },
    { id: "nueva", temporadaId: "actual", categoria: "Senior", nombre: "Liga 26/27" },
  ]);
  for (const competicionId of ["liga", "copa"]) {
    await db.insert(s.jornadas).values({ id: competicionId, competicionId, numero: 1 });
    await db.insert(s.partidos).values({
      id: competicionId,
      jornadaId: competicionId,
      equipoLocalId: "propio",
      equipoVisitanteId: "rival",
    });
    await db
      .insert(s.partidoParticipaciones)
      .values({ partidoId: competicionId, jugadorId: "goleador", titular: true, jugo: true });
    await db.insert(s.partidoEventos).values({
      id: `${competicionId}-gol`,
      partidoId: competicionId,
      jugadorId: "goleador",
      tipo: "gol",
      lado: "propio",
    });
  }
  globalThis.santisoConexionDb = Promise.resolve(conexion);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  globalThis.santisoConexionDb = undefined;
  conexion.cerrar();
  vi.restoreAllMocks();
});

describe("cargarPantallaEstadisticas", () => {
  it("sin temporada pedida usa la activa y trae sus competiciones", async () => {
    const pantalla = await cargarPantallaEstadisticas("Senior");
    if (!pantalla.ok) throw new Error(pantalla.error);
    expect(pantalla.datos.temporadaId).toBe("actual");
    expect(pantalla.datos.competiciones.map((c) => c.id)).toEqual(["nueva"]);
    expect(pantalla.datos.competicionId).toBeNull();
    // La activa está vacía de partidos: el inscrito sale con ceros, no desaparece.
    expect(pantalla.datos.filas.map((f) => [f.jugadorId, f.goles])).toEqual([["goleador", 0]]);
  });

  it("una temporada pasada trae sus dos competiciones y suma las dos", async () => {
    const pantalla = await cargarPantallaEstadisticas("Senior", "anterior");
    if (!pantalla.ok) throw new Error(pantalla.error);
    expect(pantalla.datos.competiciones.map((c) => c.nombre)).toEqual(["Liga", "Copa"]);
    const goleador = pantalla.datos.filas.find((f) => f.jugadorId === "goleador");
    expect(goleador?.goles).toBe(2);
    expect(goleador?.dorsal).toBe(9);
    // Quien está inscrito y no jugó sale a cero.
    expect(pantalla.datos.filas.find((f) => f.jugadorId === "suplente")?.convocados).toBe(0);
  });

  it("filtrar por competición reduce el ámbito", async () => {
    const pantalla = await cargarPantallaEstadisticas("Senior", "anterior", "liga");
    if (!pantalla.ok) throw new Error(pantalla.error);
    expect(pantalla.datos.competicionId).toBe("liga");
    expect(pantalla.datos.filas.find((f) => f.jugadorId === "goleador")?.goles).toBe(1);
  });

  it("una competición de otra temporada o categoría se ignora, no rompe la pantalla", async () => {
    const otra = await cargarPantallaEstadisticas("Senior", "anterior", "nueva");
    if (!otra.ok) throw new Error(otra.error);
    expect(otra.datos.competicionId).toBeNull();
    expect(otra.datos.filas.find((f) => f.jugadorId === "goleador")?.goles).toBe(2);

    const deVeteranos = await cargarPantallaEstadisticas("Senior", "anterior", "veteranos");
    if (!deVeteranos.ok) throw new Error(deVeteranos.error);
    expect(deVeteranos.datos.competicionId).toBeNull();
  });

  it("nunca dice que hay desglose de penaltis", async () => {
    const pantalla = await cargarPantallaEstadisticas("Senior", "anterior");
    if (!pantalla.ok) throw new Error(pantalla.error);
    expect(pantalla.datos.disponibilidadPenaltis).toBe(false);
    expect(pantalla.datos.filas.every((f) => f.golesPenalti === null)).toBe(true);
  });

  it("rechaza una categoría que no existe", async () => {
    expect(await cargarPantallaEstadisticas("Alevines")).toMatchObject({ ok: false });
  });
});
