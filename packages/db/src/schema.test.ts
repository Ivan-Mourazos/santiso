import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ConexionDb } from "./client";
import * as s from "./schema";
import { crearDbPrueba } from "./testing";

let conexion: ConexionDb;
beforeEach(async () => {
  conexion = await crearDbPrueba();
});
afterEach(() => conexion.cerrar());

/** Las consultas de Drizzle son thenables: se envuelven para usar `rejects`. */
const rechaza = (consulta: PromiseLike<unknown>) =>
  expect(Promise.resolve(consulta)).rejects.toThrow();

async function sembrar() {
  const { db } = conexion;
  const [temporada] = await db
    .insert(s.temporadas)
    .values({ nombre: "2026/27", activa: true })
    .returning();
  const [competicion] = await db
    .insert(s.competiciones)
    .values({ temporadaId: temporada!.id, categoria: "Senior", nombre: "Liga" })
    .returning();
  const [local] = await db
    .insert(s.equipos)
    .values({ nombre: "Local", clave: "local", categoria: "Senior" })
    .returning();
  const [visitante] = await db
    .insert(s.equipos)
    .values({ nombre: "Visitante", clave: "visitante", categoria: "Senior" })
    .returning();
  const [jornada] = await db
    .insert(s.jornadas)
    .values({ competicionId: competicion!.id, numero: 1 })
    .returning();
  const [jugador] = await db.insert(s.jugadores).values({ nombre: "Jugador" }).returning();
  return {
    temporada: temporada!,
    competicion: competicion!,
    local: local!,
    visitante: visitante!,
    jornada: jornada!,
    jugador: jugador!,
  };
}

describe("temporadas", () => {
  it("solo admite una temporada activa", async () => {
    const { db } = conexion;
    await db.insert(s.temporadas).values({ nombre: "2025/26", activa: true });
    await rechaza(db.insert(s.temporadas).values({ nombre: "2026/27", activa: true }));
    await db.insert(s.temporadas).values({ nombre: "2026/27", activa: false });
    expect(await db.select().from(s.temporadas)).toHaveLength(2);
  });
});

describe("equipos", () => {
  it("rechaza categorías fuera del catálogo", async () => {
    await rechaza(
      conexion.cliente.execute(
        "insert into equipos (id, nombre, clave, categoria) values ('x', 'X', 'x', 'Juvenil')",
      ),
    );
  });

  it("es único por categoría y clave, pero admite la misma clave en otra categoría", async () => {
    const { db } = conexion;
    await db
      .insert(s.equipos)
      .values({ nombre: "S.D. Touro", clave: "s d touro", categoria: "Senior" });
    await rechaza(
      db
        .insert(s.equipos)
        .values({ nombre: "S.D. TOURO", clave: "s d touro", categoria: "Senior" }),
    );
    await db
      .insert(s.equipos)
      .values({ nombre: "S.D. Touro", clave: "s d touro", categoria: "Veteranos" });
  });
});

describe("partidos", () => {
  it("nace programado y sin marcador", async () => {
    const { jornada, local, visitante } = await sembrar();
    const [partido] = await conexion.db
      .insert(s.partidos)
      .values({ jornadaId: jornada.id, equipoLocalId: local.id, equipoVisitanteId: visitante.id })
      .returning();
    expect(partido).toMatchObject({ estado: "programado", golesLocal: null, golesVisitante: null });
  });

  it("rechaza equipos iguales, marcador incompleto y finalizado sin marcador", async () => {
    const { jornada, local, visitante } = await sembrar();
    const base = {
      jornadaId: jornada.id,
      equipoLocalId: local.id,
      equipoVisitanteId: visitante.id,
    };
    await rechaza(conexion.db.insert(s.partidos).values({ ...base, equipoVisitanteId: local.id }));
    await rechaza(conexion.db.insert(s.partidos).values({ ...base, golesLocal: 1 }));
    await rechaza(conexion.db.insert(s.partidos).values({ ...base, estado: "finalizado" }));
  });

  it("impide borrar un equipo con partidos y borra en cascada desde la competición", async () => {
    const { db } = conexion;
    const { competicion, jornada, local, visitante, jugador } = await sembrar();
    const [partido] = await db
      .insert(s.partidos)
      .values({
        jornadaId: jornada.id,
        equipoLocalId: local.id,
        equipoVisitanteId: visitante.id,
        golesLocal: 2,
        golesVisitante: 1,
        estado: "finalizado",
      })
      .returning();
    await db
      .insert(s.partidoParticipaciones)
      .values({ partidoId: partido!.id, jugadorId: jugador.id, titular: true, jugo: true });
    await db.insert(s.partidoEventos).values({
      partidoId: partido!.id,
      tipo: "gol",
      lado: "propio",
      jugadorId: jugador.id,
      minuto: 10,
    });

    await rechaza(db.delete(s.equipos).where(eq(s.equipos.id, local.id)));
    await rechaza(db.delete(s.jugadores).where(eq(s.jugadores.id, jugador.id)));

    await db.delete(s.competiciones).where(eq(s.competiciones.id, competicion.id));
    expect(await db.select().from(s.partidos)).toHaveLength(0);
    expect(await db.select().from(s.partidoEventos)).toHaveLength(0);
    expect(await db.select().from(s.partidoParticipaciones)).toHaveLength(0);
  });

  it("actualiza actualizado_en al modificar", async () => {
    const { jornada, local, visitante } = await sembrar();
    const [partido] = await conexion.db
      .insert(s.partidos)
      .values({ jornadaId: jornada.id, equipoLocalId: local.id, equipoVisitanteId: visitante.id })
      .returning();
    await new Promise((resolver) => setTimeout(resolver, 5));
    const [actualizado] = await conexion.db
      .update(s.partidos)
      .set({ fecha: "2026-09-27T17:00" })
      .where(eq(s.partidos.id, partido!.id))
      .returning();
    expect(actualizado!.actualizadoEn > partido!.actualizadoEn).toBe(true);
  });
});

describe("acta", () => {
  it("valida propia, cambios, minutos y titularidad", async () => {
    const { db } = conexion;
    const { jornada, local, visitante, jugador } = await sembrar();
    const [partido] = await db
      .insert(s.partidos)
      .values({ jornadaId: jornada.id, equipoLocalId: local.id, equipoVisitanteId: visitante.id })
      .returning();
    const evento = { partidoId: partido!.id, jugadorId: jugador.id };

    await rechaza(
      db
        .insert(s.partidoEventos)
        .values({ ...evento, tipo: "tarjeta_amarilla", lado: "propio", propia: true }),
    );
    await rechaza(
      db.insert(s.partidoEventos).values({ ...evento, tipo: "cambio", lado: "propio" }),
    );
    await rechaza(
      db.insert(s.partidoEventos).values({ ...evento, tipo: "gol", lado: "propio", minuto: 999 }),
    );
    await rechaza(
      db
        .insert(s.partidoParticipaciones)
        .values({ partidoId: partido!.id, jugadorId: jugador.id, titular: true, jugo: false }),
    );
    await db.insert(s.partidoEventos).values({
      partidoId: partido!.id,
      tipo: "gol",
      lado: "rival",
      propia: true,
      jugadorId: jugador.id,
    });
  });
});

describe("staff, JSON y ajustes", () => {
  it("la directiva no tiene categoría y el técnico sí", async () => {
    const { db } = conexion;
    const { temporada } = await sembrar();
    const [persona] = await db.insert(s.staff).values({ nombre: "P" }).returning();
    const base = { temporadaId: temporada.id, staffId: persona!.id };
    await rechaza(
      db
        .insert(s.staffTemporada)
        .values({ ...base, cargo: "Presidente", tipo: "directiva", categoria: "Senior" }),
    );
    await rechaza(
      db.insert(s.staffTemporada).values({ ...base, cargo: "Entrenador", tipo: "tecnico" }),
    );
    await db.insert(s.staffTemporada).values({ ...base, cargo: "Presidente", tipo: "directiva" });
  });

  it("guarda y lee JSON con valores por defecto", async () => {
    const { db } = conexion;
    const { competicion } = await sembrar();
    expect(competicion.reglasClasificacion).toEqual([]);
    const reglas = [{ id: "r1", nombre: "Ascenso", puestos: [1, 2], color: "#10b981" }];
    const [conReglas] = await db
      .update(s.competiciones)
      .set({ reglasClasificacion: reglas })
      .where(eq(s.competiciones.id, competicion.id))
      .returning();
    expect(conReglas!.reglasClasificacion).toEqual(reglas);

    await db.insert(s.ajustes).values({ id: "cartel.orden_logos", valor: "xunta_izquierda" });
    expect((await db.select().from(s.ajustes))[0]?.valor).toBe("xunta_izquierda");
  });
});

describe("plantilla por temporada", () => {
  async function dosTemporadas() {
    const { db } = conexion;
    const base = await sembrar();
    const [anterior] = await db
      .insert(s.temporadas)
      .values({ nombre: "2025/26", activa: false })
      .returning();
    return { ...base, anterior: anterior! };
  }

  it("una persona se inscribe una vez por temporada y categoría, pero puede estar en dos", async () => {
    const { db } = conexion;
    const { temporada, anterior, jugador } = await dosTemporadas();
    const fila = { jugadorId: jugador.id, categoria: "Senior" as const, dorsal: 9 };
    await db.insert(s.jugadoresTemporada).values({ ...fila, temporadaId: temporada.id });
    await rechaza(db.insert(s.jugadoresTemporada).values({ ...fila, temporadaId: temporada.id }));
    // Otra temporada, u otra categoría la misma temporada: sí.
    await db.insert(s.jugadoresTemporada).values({ ...fila, temporadaId: anterior.id, dorsal: 10 });
    await db
      .insert(s.jugadoresTemporada)
      .values({ ...fila, temporadaId: temporada.id, categoria: "Veteranos" });
    expect(await db.select().from(s.jugadoresTemporada)).toHaveLength(3);
  });

  it("el dorsal repetido se admite: es un aviso de pantalla, no una restricción", async () => {
    const { db } = conexion;
    const { temporada, jugador } = await dosTemporadas();
    const [otro] = await db.insert(s.jugadores).values({ nombre: "Otro" }).returning();
    await db.insert(s.jugadoresTemporada).values([
      { temporadaId: temporada.id, jugadorId: jugador.id, categoria: "Senior", dorsal: 9 },
      { temporadaId: temporada.id, jugadorId: otro!.id, categoria: "Senior", dorsal: 9 },
    ]);
  });

  it("borrar una temporada borra sus inscripciones, nunca a las personas", async () => {
    const { db } = conexion;
    const { anterior, jugador } = await dosTemporadas();
    const [persona] = await db.insert(s.staff).values({ nombre: "Entrenador" }).returning();
    await db
      .insert(s.jugadoresTemporada)
      .values({ temporadaId: anterior.id, jugadorId: jugador.id, categoria: "Senior" });
    await db.insert(s.staffTemporada).values({
      temporadaId: anterior.id,
      staffId: persona!.id,
      tipo: "tecnico",
      categoria: "Senior",
      cargo: "Entrenador",
    });

    await db.delete(s.temporadas).where(eq(s.temporadas.id, anterior.id));
    expect(await db.select().from(s.jugadoresTemporada)).toHaveLength(0);
    expect(await db.select().from(s.staffTemporada)).toHaveLength(0);
    expect(await db.select().from(s.jugadores)).toHaveLength(1);
    expect(await db.select().from(s.staff)).toHaveLength(1);
  });

  it("borrar una persona borra sus inscripciones", async () => {
    const { db } = conexion;
    const { temporada } = await dosTemporadas();
    const [suelto] = await db.insert(s.jugadores).values({ nombre: "Sin partidos" }).returning();
    await db
      .insert(s.jugadoresTemporada)
      .values({ temporadaId: temporada.id, jugadorId: suelto!.id, categoria: "Senior" });
    await db.delete(s.jugadores).where(eq(s.jugadores.id, suelto!.id));
    expect(await db.select().from(s.jugadoresTemporada)).toHaveLength(0);
  });
});
