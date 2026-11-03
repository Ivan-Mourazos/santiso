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

describe("carteles guardados por partido", () => {
  it("limita pasos y formatos, conserva JSON y borra en cascada", async () => {
    const { db } = conexion;
    const { jornada, local, visitante } = await sembrar();
    const [p] = await db
      .insert(s.partidos)
      .values({ jornadaId: jornada.id, equipoLocalId: local.id, equipoVisitanteId: visitante.id })
      .returning();
    const fila = {
      partidoId: p!.id,
      paso: "partido" as const,
      formato: "publicacion" as const,
      clave: "carteles/prueba.png",
      huella: "abc",
      peticion: { plantilla: "partido" },
      generadoEn: new Date().toISOString(),
    };
    await db.insert(s.cartelesPartido).values(fila);
    expect((await db.select().from(s.cartelesPartido))[0]?.peticion).toEqual(fila.peticion);
    await rechaza(db.insert(s.cartelesPartido).values(fila));
    await rechaza(db.insert(s.cartelesPartido).values({ ...fila, paso: "inventado" as "partido" }));
    await rechaza(
      db.insert(s.cartelesPartido).values({ ...fila, formato: "inventado" as "historia" }),
    );
    await rechaza(db.insert(s.cartelesPartido).values({ ...fila, partidoId: "no-existe" }));
    await db.insert(s.cartelesPartido).values({ ...fila, formato: "historia" });
    expect(await db.select().from(s.cartelesPartido)).toHaveLength(2);
    await db.delete(s.partidos).where(eq(s.partidos.id, p!.id));
    expect(await db.select().from(s.cartelesPartido)).toEqual([]);
  });
});

describe("sincronización con la federación", () => {
  it("un enlace por competición, un acta por código y estados conocidos", async () => {
    const { db } = conexion;
    const { competicion, jornada, local, visitante } = await sembrar();
    const [p] = await db
      .insert(s.partidos)
      .values({ jornadaId: jornada.id, equipoLocalId: local.id, equipoVisitanteId: visitante.id })
      .returning();
    const enlace = { competicionId: competicion.id, enlace: "https://www.futgal.es/x" };
    await db.insert(s.rfgfCompeticiones).values(enlace);
    await rechaza(db.insert(s.rfgfCompeticiones).values(enlace));
    const acta = { codActa: "1444198", competicionId: competicion.id, partidoId: p!.id };
    await db.insert(s.rfgfActas).values({ ...acta, estado: "guardada" });
    await rechaza(db.insert(s.rfgfActas).values({ ...acta, estado: "resultado" }));
    await rechaza(
      db.insert(s.rfgfActas).values({ ...acta, codActa: "2", estado: "inventado" as "error" }),
    );
    // Borrar el partido no borra la constancia del acta: solo la deja sin partido.
    await db.delete(s.partidos).where(eq(s.partidos.id, p!.id));
    const [resto] = await db.select().from(s.rfgfActas);
    // Sin repasos todavía: ni jugadores ni alineaciones releídos.
    expect(resto).toMatchObject({
      codActa: "1444198",
      partidoId: null,
      jugadoresEn: null,
      alineacionesEn: null,
    });
    // Borrar la competición se lo lleva todo.
    await db.delete(s.jornadas).where(eq(s.jornadas.id, jornada.id));
    await db.delete(s.competiciones).where(eq(s.competiciones.id, competicion.id));
    expect(await db.select().from(s.rfgfActas)).toHaveLength(0);
    expect(await db.select().from(s.rfgfCompeticiones)).toHaveLength(0);
  });
});

describe("jugadores en la federación", () => {
  it("un código por competición; borrar al jugador solo lo desenlaza", async () => {
    const { db } = conexion;
    const { competicion } = await sembrar();
    const [jugador] = await db.insert(s.jugadores).values({ nombre: "Xan Proba" }).returning();
    const fila = {
      codigo: "225808",
      competicionId: competicion.id,
      jugadorId: jugador!.id,
      nombre: "PROBA, XAN",
      codActa: "1444198",
    };
    await db.insert(s.rfgfJugadores).values(fila);
    await rechaza(db.insert(s.rfgfJugadores).values(fila));
    await db.delete(s.jugadores).where(eq(s.jugadores.id, jugador!.id));
    const [resto] = await db.select().from(s.rfgfJugadores);
    expect(resto).toMatchObject({ codigo: "225808", jugadorId: null, cifras: null });
  });
});

describe("convocatorias previas", () => {
  it("partido único, par jugador único y borrado en cascada, aparte del acta", async () => {
    const { db } = conexion;
    const { jornada, local, visitante, jugador } = await sembrar();
    const [p] = await db
      .insert(s.partidos)
      .values({ jornadaId: jornada.id, equipoLocalId: local.id, equipoVisitanteId: visitante.id })
      .returning();
    const cabecera = { partidoId: p!.id, lugarQuedada: "Campo" };
    const fila = { partidoId: p!.id, jugadorId: jugador.id };
    await db.insert(s.partidoConvocatorias).values(cabecera);
    await rechaza(db.insert(s.partidoConvocatorias).values(cabecera));
    await db.insert(s.partidoConvocados).values(fila);
    await rechaza(db.insert(s.partidoConvocados).values(fila));
    await rechaza(db.insert(s.partidoConvocados).values({ ...fila, jugadorId: "inexistente" }));
    expect(await db.select().from(s.partidoParticipaciones)).toHaveLength(0);
    expect(await db.select().from(s.partidoAlineaciones)).toHaveLength(0);
    await db.delete(s.partidos).where(eq(s.partidos.id, p!.id));
    expect(await db.select().from(s.partidoConvocatorias)).toHaveLength(0);
    expect(await db.select().from(s.partidoConvocados)).toHaveLength(0);
  });
});

describe("archivo de partidos históricos", () => {
  it("vive sin calendario activo, valida estados y borra eventos en cascada", async () => {
    const { db } = conexion;
    await db.insert(s.rfgfGruposHistoricos).values({
      codGrupo: "antiguo",
      categoria: "Senior",
      temporada: "2025-2026",
      competicion: "Liga",
      grupo: "1",
      codCompeticion: "30",
      codEquipo: "12",
    });
    const base = {
      codGrupo: "antiguo",
      jornada: 1,
      fechaNominal: "2025-09-14",
      local: "Santiso",
      visitante: "Rival",
      santisoLocal: true,
    };
    const [p] = await db.insert(s.rfgfHistoricoPartidos).values(base).returning();
    expect(p).toMatchObject({ estado: "pendiente", intentos: 0, golesLocal: null });
    await rechaza(db.insert(s.rfgfHistoricoPartidos).values(base));
    await rechaza(
      db.insert(s.rfgfHistoricoPartidos).values({ ...base, jornada: 2, codGrupo: "ausente" }),
    );
    await rechaza(
      db
        .insert(s.rfgfHistoricoPartidos)
        .values({ ...base, jornada: 2, estado: "inventado" as "error" }),
    );
    await rechaza(
      db.insert(s.rfgfHistoricoPartidos).values({ ...base, jornada: 2, golesLocal: 2 }),
    );
    const evento = {
      partidoId: p!.id,
      lado: "local" as const,
      persona: "Jugador",
      personaClave: "jugador",
      tipo: "gol" as const,
      minuto: "45+2",
    };
    await db.insert(s.rfgfHistoricoEventos).values(evento);
    await rechaza(
      db.insert(s.rfgfHistoricoEventos).values({ ...evento, tipo: "penalti" as "gol" }),
    );
    await rechaza(db.insert(s.rfgfHistoricoEventos).values({ ...evento, lado: "otro" as "local" }));
    await rechaza(db.update(s.rfgfGruposHistoricos).set({ partidosEstado: "otro" as "en_cola" }));
    await db.delete(s.rfgfGruposHistoricos).where(eq(s.rfgfGruposHistoricos.codGrupo, "antiguo"));
    expect(await db.select().from(s.rfgfHistoricoPartidos)).toEqual([]);
    expect(await db.select().from(s.rfgfHistoricoEventos)).toEqual([]);
    expect(await db.select().from(s.partidos)).toEqual([]);
    expect(await db.select().from(s.jornadas)).toEqual([]);
    expect(await db.select().from(s.competiciones)).toEqual([]);
  });
});

describe("acceso", () => {
  it("usuario único, rol conocido y sesiones que se van con su usuario", async () => {
    const { db } = conexion;
    const base = {
      usuario: "mou",
      nombre: "Iván",
      rol: "admin",
      claveHash: "scrypt$00$00",
    } as const;
    const [u] = await db.insert(s.usuarios).values(base).returning();
    expect(u).toMatchObject({ activo: true });
    await rechaza(db.insert(s.usuarios).values({ ...base, nombre: "Otro" }));
    await rechaza(
      db.insert(s.usuarios).values({ ...base, usuario: "otro", rol: "jefe" as unknown as "admin" }),
    );
    const sesion = { id: "huella", usuarioId: u!.id, expiraEn: "2099-01-01T00:00:00.000Z" };
    await db.insert(s.sesiones).values(sesion);
    await rechaza(db.insert(s.sesiones).values(sesion));
    await rechaza(db.insert(s.sesiones).values({ ...sesion, id: "otra", usuarioId: "nadie" }));
    await db.delete(s.usuarios).where(eq(s.usuarios.id, u!.id));
    expect(await db.select().from(s.sesiones)).toHaveLength(0);
  });
});

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

describe("clubes de la federación y alineaciones vistas", () => {
  it("enlaza equipos con su club, suelta el enlace al borrar el club y valida alineaciones", async () => {
    const { db } = conexion;
    const { jornada, local, visitante } = await sembrar();
    await db.insert(s.rfgfClubes).values({
      codigo: "1800",
      nombre: "Unión Deportiva Santiso F.C.",
      clave: "union deportiva santiso f c",
      leidoEn: "2026-10-18T10:00:00.000Z",
    });
    await rechaza(
      db
        .insert(s.rfgfClubes)
        .values({ codigo: "1800", nombre: "Otro", clave: "otro", leidoEn: "" }),
    );
    await db.update(s.equipos).set({ clubCodigo: "1800" }).where(eq(s.equipos.id, local.id));
    await rechaza(
      db.update(s.equipos).set({ clubCodigo: "ausente" }).where(eq(s.equipos.id, visitante.id)),
    );
    const [enlazado] = await db.select().from(s.equipos).where(eq(s.equipos.id, local.id));
    expect(enlazado).toMatchObject({
      clubCodigo: "1800",
      clubManual: false,
      colorFederacion: false,
    });
    await db.delete(s.rfgfClubes);
    const [suelto] = await db.select().from(s.equipos).where(eq(s.equipos.id, local.id));
    expect(suelto!.clubCodigo).toBeNull();

    await db
      .insert(s.rfgfEquiposClub)
      .values({ categoria: "Senior", codEquipo: "2860", temporadasEn: "2026-10-18" });
    await rechaza(
      db
        .insert(s.rfgfEquiposClub)
        .values({ categoria: "Juvenil" as "Senior", codEquipo: "1", temporadasEn: "" }),
    );

    const [p] = await db
      .insert(s.partidos)
      .values({ jornadaId: jornada.id, equipoLocalId: local.id, equipoVisitanteId: visitante.id })
      .returning();
    const fila = {
      partidoId: p!.id,
      equipoId: visitante.id,
      persona: "Ana Pérez",
      personaClave: "ana perez",
      titular: true,
    };
    await db.insert(s.ligaAlineaciones).values(fila);
    await rechaza(db.insert(s.ligaAlineaciones).values({ ...fila, dorsal: -1 }));
    await db.delete(s.partidos);
    expect(await db.select().from(s.ligaAlineaciones)).toHaveLength(0);

    await db.insert(s.rfgfGruposHistoricos).values({
      codGrupo: "antiguo",
      categoria: "Senior",
      temporada: "2018-2019",
      competicion: "Liga",
      grupo: "6",
      codCompeticion: "30",
      codEquipo: "2860",
    });
    const [h] = await db
      .insert(s.rfgfHistoricoPartidos)
      .values({
        codGrupo: "antiguo",
        jornada: 1,
        fechaNominal: "2018-09-16",
        local: "Santiso",
        visitante: "Rival",
        santisoLocal: true,
      })
      .returning();
    const vista = {
      partidoId: h!.id,
      lado: "visitante" as const,
      persona: "Ana",
      personaClave: "ana",
      titular: false,
    };
    await db.insert(s.rfgfHistoricoAlineaciones).values(vista);
    await rechaza(
      db.insert(s.rfgfHistoricoAlineaciones).values({ ...vista, lado: "otro" as "local" }),
    );
    await db.delete(s.rfgfGruposHistoricos);
    expect(await db.select().from(s.rfgfHistoricoAlineaciones)).toHaveLength(0);
  });
});

describe("entrenamientos y asistencia", () => {
  it("fecha única por categoría, persona exclusiva, estados y FK set null", async () => {
    const { db } = conexion;
    const { temporada, jugador } = await sembrar();
    const datos = { temporadaId: temporada.id, categoria: "Senior" as const, fecha: "2026-11-01" };
    const [e] = await db.insert(s.entrenamientos).values(datos).returning();
    await rechaza(db.insert(s.entrenamientos).values(datos));
    await db.insert(s.entrenamientos).values({ ...datos, categoria: "Veteranos" });
    const marca = { entrenamientoId: e!.id, jugadorId: jugador.id, estado: "presente" as const };
    await rechaza(db.insert(s.asistencias).values({ entrenamientoId: e!.id, estado: "presente" }));
    await rechaza(db.insert(s.asistencias).values({ ...marca, estado: "otro" as "presente" }));
    const [m] = await db
      .insert(s.multas)
      .values({
        temporadaId: temporada.id,
        jugadorId: jugador.id,
        concepto: "Prueba",
        importeCentimos: 50,
        fecha: datos.fecha,
      })
      .returning();
    await db.insert(s.asistencias).values({ ...marca, multaId: m!.id });
    await rechaza(db.insert(s.asistencias).values(marca));
    await db.delete(s.multas).where(eq(s.multas.id, m!.id));
    expect((await db.select().from(s.asistencias))[0]!.multaId).toBeNull();
    await db.delete(s.entrenamientos).where(eq(s.entrenamientos.id, e!.id));
    expect(await db.select().from(s.asistencias)).toHaveLength(0);
  });
});

it("otros clubes: unicidad, estados válidos, goles null y cascada desde jugador", async () => {
  const { db } = conexion;
  const [j] = await db.insert(s.jugadores).values({ nombre: "Jugador anterior" }).returning();
  const valores = {
    jugadorId: j!.id,
    linea: "23/24: Club",
    temporada: "2023-2024",
    club: "Club",
    codigo: "1",
  };
  const [p] = await db.insert(s.rfgfAnterioresPeticiones).values(valores).returning();
  await rechaza(db.insert(s.rfgfAnterioresPeticiones).values(valores));
  await rechaza(
    db
      .insert(s.rfgfAnterioresPeticiones)
      .values({ ...valores, linea: "otra", estado: "inventado" as never }),
  );
  await db
    .insert(s.rfgfAnterioresGrupo)
    .values({ codGrupo: "1", temporada: "2023-2024", codCompeticion: "2" });
  await db.insert(s.rfgfAnterioresCifras).values({
    peticionId: p!.id,
    codGrupo: "1",
    cifras: {
      convocados: 1,
      titular: 1,
      suplente: 0,
      jugados: 1,
      amarillas: 0,
      doblesAmarillas: 0,
      rojas: 0,
      goles: null,
    },
  });
  expect((await db.select().from(s.rfgfAnterioresCifras))[0]!.cifras!.goles).toBeNull();
  await db.delete(s.jugadores).where(eq(s.jugadores.id, j!.id));
  expect(await db.select().from(s.rfgfAnterioresCifras)).toEqual([]);
  expect(await db.select().from(s.rfgfAnterioresPeticiones)).toEqual([]);
});

it("clasificaciones históricas: una por grupo, JSON, estados y borrado en cascada", async () => {
  const { db } = conexion;
  await db.insert(s.rfgfGruposHistoricos).values({
    codGrupo: "300",
    categoria: "Senior",
    temporada: "2023-2024",
    competicion: "Liga",
    grupo: "1",
    codCompeticion: "30",
    codEquipo: "12",
  });
  const fila = {
    posicion: 6,
    equipo: "U.D. Santiso",
    puntos: 34,
    jugados: 26,
    ganados: 10,
    empatados: 4,
    perdidos: 12,
    golesFavor: 31,
    golesContra: 35,
    sancion: 0,
  };
  await db
    .insert(s.rfgfHistoricoClasificaciones)
    .values({ codGrupo: "300", formato: "liga", jornada: 26, filas: [fila], estado: "leido" });
  expect((await db.select().from(s.rfgfHistoricoClasificaciones))[0]!.filas).toEqual([fila]);
  await rechaza(db.insert(s.rfgfHistoricoClasificaciones).values({ codGrupo: "300" }));
  await rechaza(db.update(s.rfgfHistoricoClasificaciones).set({ estado: "inventado" as never }));
  await rechaza(db.update(s.rfgfHistoricoClasificaciones).set({ formato: "inventado" as never }));
  await db.delete(s.rfgfGruposHistoricos).where(eq(s.rfgfGruposHistoricos.codGrupo, "300"));
  expect(await db.select().from(s.rfgfHistoricoClasificaciones)).toEqual([]);
});

it("código equipo compatible con peticiones anteriores y caché única por equipo", async () => {
  const { db } = conexion;
  await db.insert(s.rfgfAnterioresEquipo).values({
    codigo: "5120",
    grupos: [
      {
        temporada: "2023-2024",
        codGrupo: "30",
        codCompeticion: "20",
        competicion: "Liga",
        grupo: "1",
        codEquipo: "5120",
      },
    ],
  });
  await rechaza(db.insert(s.rfgfAnterioresEquipo).values({ codigo: "5120" }));
  await rechaza(db.update(s.rfgfAnterioresEquipo).set({ estado: "inventado" as never }));
  expect((await db.select().from(s.rfgfAnterioresEquipo))[0]!.grupos![0]!.codEquipo).toBe("5120");
});

it("gastos: importe entero positivo, motivo obligatorio, FK y cascada", async () => {
  const { db } = conexion;
  const [temporada] = await db.insert(s.temporadas).values({ nombre: "2026/27" }).returning();
  if (!temporada) throw new Error("Falta temporada de prueba");
  const base = {
    temporadaId: temporada.id,
    fecha: "2026-11-03",
    concepto: "Cena",
    importeCentimos: 1200,
  };
  for (const importeCentimos of [0, -1, 1.5])
    await rechaza(db.insert(s.boteGastos).values({ ...base, importeCentimos }));
  await rechaza(db.insert(s.boteGastos).values({ ...base, concepto: "  " }));
  await rechaza(db.insert(s.boteGastos).values({ ...base, temporadaId: "inexistente" }));
  const [g] = await db.insert(s.boteGastos).values(base).returning();
  expect(g).toMatchObject({ ...base, nota: null });
  expect(g!.creadoEn).toBeTruthy();
  expect(g!.actualizadoEn).toBeTruthy();
  await db.delete(s.temporadas).where(eq(s.temporadas.id, temporada.id));
  expect(await db.select().from(s.boteGastos)).toEqual([]);
});
