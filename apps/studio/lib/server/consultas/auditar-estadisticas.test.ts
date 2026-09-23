import { describe, expect, it } from "vitest";
import { compararFilasEstadisticas } from "./auditar-estadisticas";
const fila = (jugadorId: string, goles: number) => ({
  jugadorId,
  nombre: "Persona ficticia",
  apodo: null,
  dorsal: 8,
  fotoUrl: null,
  inscripcionAusente: false,
  convocados: 2,
  titularidades: 1,
  partidosJugados: 1,
  goles,
  golesPropia: 0,
  amarillas: 1,
  rojas: 0,
  golesPenalti: null,
});
describe("reconciliación de estadísticas", () => {
  it("acepta equivalencia por identidad sin depender del orden", () => {
    expect(
      compararFilasEstadisticas([fila("a", 1), fila("b", 2)], [fila("b", 2), fila("a", 1)]),
    ).toEqual([]);
  });
  it("detecta goles intercambiados aunque el total coincida", () => {
    expect(
      compararFilasEstadisticas([fila("a", 2), fila("b", 1)], [fila("a", 1), fila("b", 2)]),
    ).toHaveLength(2);
  });
  it("detecta dorsal/foto incorrectos y omisiones", () => {
    expect(
      compararFilasEstadisticas(
        [{ ...fila("a", 1), dorsal: 9, fotoUrl: "/media/otro.webp" }],
        [fila("a", 1), fila("b", 0)],
      ),
    ).toHaveLength(3);
  });
  it("detecta identidades duplicadas y jugadores inesperados", () => {
    expect(
      compararFilasEstadisticas([fila("a", 1), fila("a", 1), fila("b", 0)], [fila("a", 1)]),
    ).toHaveLength(2);
  });
});

it("reconcilia SQL con goles en propia de ambos lados y gol sin autor", async () => {
  const { crearDbPrueba } = await import("@santiso/db/testing");
  const { schema } = await import("@santiso/db");
  const { auditarEstadisticas } = await import("./auditar-estadisticas");
  const conexion = await crearDbPrueba();
  try {
    const { db } = conexion;
    await db.insert(schema.temporadas).values({ id: "t", nombre: "2025/26" });
    await db
      .insert(schema.competiciones)
      .values({ id: "c", temporadaId: "t", categoria: "Femenino", nombre: "Liga" });
    await db.insert(schema.equipos).values([
      {
        id: "local",
        nombre: "Club ficticio",
        clave: "club",
        categoria: "Femenino",
        esPropio: true,
      },
      { id: "rival", nombre: "Rival ficticio", clave: "rival", categoria: "Femenino" },
    ]);
    await db.insert(schema.jornadas).values({ id: "j", competicionId: "c", numero: 1 });
    await db
      .insert(schema.partidos)
      .values({ id: "p", jornadaId: "j", equipoLocalId: "local", equipoVisitanteId: "rival" });
    await db.insert(schema.jugadores).values({ id: "a", nombre: "Persona ficticia" });
    await db
      .insert(schema.partidoParticipaciones)
      .values({ partidoId: "p", jugadorId: "a", titular: true, jugo: true });
    await db.insert(schema.partidoEventos).values([
      { id: "gol", partidoId: "p", tipo: "gol", lado: "propio", jugadorId: "a" },
      { id: "propia-rival", partidoId: "p", tipo: "gol", lado: "propio", propia: true },
      { id: "sin-autor", partidoId: "p", tipo: "gol", lado: "propio" },
      {
        id: "propia-club",
        partidoId: "p",
        tipo: "gol",
        lado: "rival",
        propia: true,
        jugadorId: "a",
      },
    ]);
    const resultado = await auditarEstadisticas(
      { db, ejecutar: (sql) => conexion.cliente.execute(sql) },
      { temporadaId: "t", categoria: "Femenino" },
    );
    expect(resultado).toMatchObject({
      jugadores: 1,
      goles: 1,
      golesPropiaRival: 1,
      golesSinAutor: 1,
      sinInscripcion: 1,
      errores: [],
    });
  } finally {
    conexion.cerrar();
  }
});
