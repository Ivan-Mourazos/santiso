import { schema as s, type ConexionDb } from "@santiso/db";
import { crearDbPrueba } from "@santiso/db/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pantallaJornada } from "./jornada";

let conexion: ConexionDb;

beforeEach(async () => {
  conexion = await crearDbPrueba();
  const { db } = conexion;
  await db.insert(s.temporadas).values([
    { id: "pasada", nombre: "2025/26" },
    { id: "activa", nombre: "2026/27", activa: true },
  ]);
  await db.insert(s.equipos).values([
    {
      id: "santiso",
      nombre: "U.D. Santiso F.C.",
      clave: "santiso",
      categoria: "Senior",
      esPropio: true,
    },
    { id: "vet", nombre: "Santiso Solaina", clave: "vet", categoria: "Veteranos", esPropio: true },
    {
      id: "rival",
      nombre: "Rival Ficticio",
      clave: "rival",
      categoria: "Senior",
      escudo: "equipos/r.webp",
    },
    { id: "otro", nombre: "Otro Ficticio", clave: "otro", categoria: "Senior" },
    { id: "rvet", nombre: "Rival Veterano", clave: "rvet", categoria: "Veteranos" },
  ]);
  await db.insert(s.competiciones).values([
    { id: "liga", temporadaId: "activa", categoria: "Senior", nombre: "Liga" },
    { id: "ligav", temporadaId: "activa", categoria: "Veteranos", nombre: "Liga V" },
    { id: "vieja", temporadaId: "pasada", categoria: "Senior", nombre: "Liga vieja" },
  ]);
  await db.insert(s.competicionEquipos).values([
    { competicionId: "liga", equipoId: "santiso" },
    { competicionId: "liga", equipoId: "rival" },
    { competicionId: "liga", equipoId: "otro" },
    { competicionId: "ligav", equipoId: "vet" },
    { competicionId: "ligav", equipoId: "rvet" },
  ]);
  await db.insert(s.jornadas).values([
    { id: "j1", competicionId: "liga", numero: 1 },
    { id: "j2", competicionId: "liga", numero: 2 },
    { id: "jv", competicionId: "ligav", numero: 3 },
    { id: "jx", competicionId: "vieja", numero: 1 },
  ]);
  await db.insert(s.partidos).values([
    // Semana del 21 al 27/09/2026: jugado con acta, visitante.
    {
      id: "jugado",
      jornadaId: "j1",
      equipoLocalId: "rival",
      equipoVisitanteId: "santiso",
      golesLocal: 1,
      golesVisitante: 3,
      estado: "finalizado",
      fecha: "2026-09-27T17:00",
    },
    // Misma semana, veteranos, sin acta todavía.
    {
      id: "sin-acta",
      jornadaId: "jv",
      equipoLocalId: "vet",
      equipoVisitanteId: "rvet",
      golesLocal: 0,
      golesVisitante: 0,
      estado: "finalizado",
      fecha: "2026-09-26T18:00",
    },
    // Otro partido de la liga sin el Santiso: no sale.
    {
      id: "ajeno",
      jornadaId: "j1",
      equipoLocalId: "otro",
      equipoVisitanteId: "rival",
      fecha: "2026-09-27T12:00",
    },
    // Semana siguiente.
    {
      id: "siguiente",
      jornadaId: "j2",
      equipoLocalId: "santiso",
      equipoVisitanteId: "otro",
      fecha: "2026-10-04T17:00",
    },
    // Misma fecha pero de la temporada pasada: no sale.
    {
      id: "viejo",
      jornadaId: "jx",
      equipoLocalId: "santiso",
      equipoVisitanteId: "rival",
      fecha: "2026-09-27T10:00",
    },
  ]);
  await db.insert(s.jugadores).values([
    { id: "ana", nombre: "Ana Pérez Ficticia", apodo: "Anita" },
    { id: "bea", nombre: "Bea Ruiz Ficticia" },
  ]);
  await db.insert(s.partidoParticipaciones).values([
    { partidoId: "jugado", jugadorId: "ana", titular: true, jugo: true },
    { partidoId: "jugado", jugadorId: "bea", titular: true, jugo: true },
  ]);
  await db.insert(s.partidoEventos).values([
    { id: "g1", partidoId: "jugado", tipo: "gol", lado: "propio", jugadorId: "ana", minuto: 10 },
    { id: "g2", partidoId: "jugado", tipo: "gol", lado: "propio", jugadorId: "ana", minuto: 50 },
    {
      id: "g3",
      partidoId: "jugado",
      tipo: "gol",
      lado: "propio",
      propia: true,
      nombreRival: "X",
      minuto: 70,
    },
    { id: "g4", partidoId: "jugado", tipo: "gol", lado: "rival", nombreRival: "Y", minuto: 80 },
    {
      id: "t1",
      partidoId: "jugado",
      tipo: "tarjeta_amarilla",
      lado: "propio",
      jugadorId: "bea",
      minuto: 30,
    },
    {
      id: "t2",
      partidoId: "jugado",
      tipo: "tarjeta_amarilla",
      lado: "rival",
      nombreRival: "Z",
      minuto: 31,
    },
  ]);
  globalThis.santisoConexionDb = Promise.resolve(conexion);
});

afterEach(() => {
  globalThis.santisoConexionDb = undefined;
  conexion.cerrar();
});

describe("pantallaJornada", () => {
  it("trae los partidos del club de esa semana y temporada, por categoría", async () => {
    const pantalla = await pantallaJornada("2026-09-23");
    expect(pantalla.semana).toEqual({ desde: "2026-09-21", hasta: "2026-09-27" });
    expect(pantalla.categorias.map((c) => c.categoria)).toEqual(["Senior", "Veteranos"]);
    const senior = pantalla.categorias[0]!.partidos.map((p) => p.id);
    expect(senior).toEqual(["jugado"]);
    expect(pantalla.categorias[1]!.partidos.map((p) => p.id)).toEqual(["sin-acta"]);
  });

  it("pone al Santiso de su lado y al rival del otro, con su escudo", async () => {
    const [p] = (await pantallaJornada("2026-09-23")).categorias[0]!.partidos;
    expect(p).toMatchObject({
      santisoLocal: false,
      santiso: "U.D. Santiso F.C.",
      rival: { nombre: "Rival Ficticio", escudoUrl: "/media/equipos/r.webp" },
      golesSantiso: 3,
      golesRival: 1,
      jornadaNumero: 1,
    });
  });

  it("resume el acta con las mismas reglas que las estadísticas", async () => {
    const [p] = (await pantallaJornada("2026-09-23")).categorias[0]!.partidos;
    expect(p!.acta).toEqual({
      convocados: 2,
      goleadores: [{ nombre: "Anita", goles: 2 }],
      golesPropiaRival: 1,
      amarillas: 1,
      rojas: 0,
    });
  });

  it("sin convocatoria el acta está pendiente", async () => {
    const [p] = (await pantallaJornada("2026-09-23")).categorias[1]!.partidos;
    expect(p!.acta).toBeNull();
  });

  it("da la posición del Santiso en la liga", async () => {
    const [p] = (await pantallaJornada("2026-09-23")).categorias[0]!.partidos;
    expect(p!.clasificacion).toEqual({ posicion: 1, puntos: 3, equipos: 3 });
  });

  it("otra semana, otros partidos; una semana sin partido deja la categoría vacía", async () => {
    const pantalla = await pantallaJornada("2026-10-01");
    expect(pantalla.categorias[0]!.partidos.map((p) => p.id)).toEqual(["siguiente"]);
    expect(pantalla.categorias[1]!.partidos).toEqual([]);
  });
});
