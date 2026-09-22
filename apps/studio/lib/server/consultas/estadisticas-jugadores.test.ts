import { schema as s, type ConexionDb } from "@santiso/db";
import { crearDbPrueba } from "@santiso/db/testing";
import { CATEGORIAS, type Categoria } from "@santiso/domain";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { leerEstadisticasJugadores, listarEstadisticasJugadores } from "./estadisticas-jugadores";

let conexion: ConexionDb;
const ambito = { temporadaId: "anterior", categoria: "Senior" as const };

beforeEach(async () => {
  conexion = await crearDbPrueba();
  const { db } = conexion;
  await db.insert(s.temporadas).values([
    { id: "anterior", nombre: "2025/26" },
    { id: "actual", nombre: "2026/27", activa: true },
    { id: "vacia", nombre: "2024/25" },
  ]);
  await db.insert(s.jugadores).values([
    { id: "autor", nombre: "Zoe", apodo: "Z" },
    { id: "inactivo", nombre: "Ana" },
    { id: "sin-inscripcion", nombre: "Brais" },
    { id: "solo-convocado", nombre: "Carlos" },
  ]);
  for (const temporadaId of ["anterior", "actual"]) {
    for (const [indice, categoria] of CATEGORIAS.entries()) {
      const prefijo = `${temporadaId}-${categoria}`;
      await db.insert(s.jugadoresTemporada).values({
        jugadorId: "autor",
        temporadaId,
        categoria,
        dorsal: (temporadaId === "anterior" ? 9 : 19) + indice,
        foto: `jugadores/${prefijo} foto.webp`,
      });
      for (const nombre of ["liga", "copa"]) {
        const id = `${prefijo}-${nombre}`;
        await db.insert(s.equipos).values([
          { id: `${id}-local`, nombre: "Club", clave: `${id}-local`, categoria, esPropio: true },
          { id: `${id}-rival`, nombre: "Rival", clave: `${id}-rival`, categoria },
        ]);
        await db.insert(s.competiciones).values({ id, temporadaId, categoria, nombre });
        await db.insert(s.jornadas).values({ id, competicionId: id, numero: 1 });
        await db.insert(s.partidos).values({
          id,
          jornadaId: id,
          equipoLocalId: `${id}-local`,
          equipoVisitanteId: `${id}-rival`,
          estado: nombre === "liga" ? "programado" : "cancelado",
        });
        await db.insert(s.partidoParticipaciones).values({
          partidoId: id,
          jugadorId: "autor",
          titular: nombre === "liga",
          jugo: nombre === "liga",
        });
        await db.insert(s.partidoEventos).values([
          { id: `${id}-gol1`, partidoId: id, jugadorId: "autor", tipo: "gol", lado: "propio" },
          { id: `${id}-gol2`, partidoId: id, jugadorId: "autor", tipo: "gol", lado: "propio" },
          {
            id: `${id}-amarilla`,
            partidoId: id,
            jugadorId: "autor",
            tipo: "tarjeta_amarilla",
            lado: "propio",
          },
        ]);
      }
    }
  }
  await db.insert(s.jugadoresTemporada).values([
    { ...ambito, jugadorId: "inactivo", dorsal: 9 },
    {
      temporadaId: "actual",
      categoria: "Senior",
      jugadorId: "sin-inscripcion",
      dorsal: 99,
      foto: "actual.webp",
    },
    {
      temporadaId: "anterior",
      categoria: "Veteranos",
      jugadorId: "sin-inscripcion",
      dorsal: 88,
      foto: "otra.webp",
    },
  ]);
  await db.insert(s.partidoEventos).values({
    id: "sin-inscripcion-gol",
    partidoId: "anterior-Senior-liga",
    jugadorId: "sin-inscripcion",
    tipo: "gol",
    lado: "propio",
  });
  await db.insert(s.partidoParticipaciones).values({
    partidoId: "anterior-Senior-liga",
    jugadorId: "solo-convocado",
    titular: false,
    jugo: false,
  });
});

afterEach(() => {
  globalThis.santisoConexionDb = undefined;
  vi.restoreAllMocks();
  conexion?.cerrar();
});

describe("estadísticas por ámbito", () => {
  it("delimita año y categoría, sin multiplicar participaciones ni filtrar estados", async () => {
    const resultado = await leerEstadisticasJugadores(conexion.db, ambito);
    expect(resultado.ambito).toEqual(ambito);
    expect(resultado.disponibilidadPenaltis).toBe(false);
    expect(resultado.filas.find((f) => f.jugadorId === "autor")).toEqual({
      jugadorId: "autor",
      nombre: "Zoe",
      apodo: "Z",
      dorsal: 9,
      fotoUrl: "/media/jugadores/anterior-Senior%20foto.webp",
      inscripcionAusente: false,
      convocados: 2,
      titularidades: 1,
      partidosJugados: 1,
      goles: 4,
      golesPropia: 0,
      amarillas: 2,
      rojas: 0,
      golesPenalti: null,
    });
    expect(resultado.filas.map((f) => f.jugadorId)).toEqual([
      "inactivo",
      "autor",
      "sin-inscripcion",
      "solo-convocado",
    ]);
  });

  it.each(CATEGORIAS)("acepta %s y usa solo su inscripción anual", async (categoria) => {
    const { filas } = await leerEstadisticasJugadores(conexion.db, {
      temporadaId: "actual",
      categoria,
    });
    expect(filas.find((f) => f.jugadorId === "autor")).toMatchObject({
      convocados: 2,
      goles: 4,
      dorsal: 19 + CATEGORIAS.indexOf(categoria),
      fotoUrl: `/media/jugadores/actual-${categoria}%20foto.webp`,
      inscripcionAusente: false,
    });
    expect(filas.filter((f) => f.jugadorId === "autor")).toHaveLength(1);
  });

  it("filtra competición y mantiene inscritos sin actividad", async () => {
    const { filas } = await leerEstadisticasJugadores(conexion.db, {
      ...ambito,
      competicionId: "anterior-Senior-copa",
    });
    expect(filas.find((f) => f.jugadorId === "autor")).toMatchObject({
      convocados: 1,
      goles: 2,
      titularidades: 0,
      partidosJugados: 0,
    });
    expect(filas.find((f) => f.jugadorId === "inactivo")).toEqual({
      jugadorId: "inactivo",
      nombre: "Ana",
      apodo: null,
      dorsal: 9,
      fotoUrl: null,
      inscripcionAusente: false,
      convocados: 0,
      titularidades: 0,
      partidosJugados: 0,
      goles: 0,
      golesPropia: 0,
      amarillas: 0,
      rojas: 0,
      golesPenalti: null,
    });
    expect(filas).toHaveLength(2);
  });

  it("conserva autores y convocados sin inscripción sin tomar fotos de otro ámbito", async () => {
    const { filas } = await leerEstadisticasJugadores(conexion.db, ambito);
    expect(filas.find((f) => f.jugadorId === "sin-inscripcion")).toMatchObject({
      goles: 1,
      convocados: 0,
      dorsal: null,
      fotoUrl: null,
      inscripcionAusente: true,
    });
    expect(filas.find((f) => f.jugadorId === "solo-convocado")).toMatchObject({
      convocados: 1,
      partidosJugados: 0,
      dorsal: null,
      fotoUrl: null,
      inscripcionAusente: true,
    });
  });

  it.each(["actual-Senior-liga", "anterior-Femenino-liga", "inexistente", ""])(
    "rechaza competición incompatible %s",
    async (competicionId) => {
      await expect(
        leerEstadisticasJugadores(conexion.db, { ...ambito, competicionId }),
      ).rejects.toThrow(/competición/i);
    },
  );

  it.each(["", "   ", "inexistente"])("rechaza temporada ausente %s", async (temporadaId) => {
    await expect(
      leerEstadisticasJugadores(conexion.db, { ...ambito, temporadaId }),
    ).rejects.toThrow(/temporada/i);
  });

  it.each(["FEMENINO", "desconocida", "", undefined])(
    "valida categoría runtime %s",
    async (categoria) => {
      await expect(
        leerEstadisticasJugadores(conexion.db, { ...ambito, categoria: categoria as Categoria }),
      ).rejects.toThrow(/categoría/i);
    },
  );

  it("devuelve ámbito vacío sin buscar temporada activa", async () => {
    expect(
      await leerEstadisticasJugadores(conexion.db, { temporadaId: "vacia", categoria: "Femenino" }),
    ).toEqual({
      filas: [],
      ambito: { temporadaId: "vacia", categoria: "Femenino" },
      disponibilidadPenaltis: false,
    });
  });

  it("admite TransaccionDb y wrapper con conexión ya obtenida", async () => {
    const resultado = await conexion.db.transaction((tx) => leerEstadisticasJugadores(tx, ambito));
    expect(resultado.filas.find((f) => f.jugadorId === "autor")?.goles).toBe(4);
    globalThis.santisoConexionDb = Promise.resolve(conexion);
    expect(await listarEstadisticasJugadores(ambito)).toEqual(
      await leerEstadisticasJugadores(conexion.db, ambito),
    );
  });
  it.each(["éxito", "consulta", "rollback"] as const)(
    "libera transacción del wrapper ante %s",
    async (caso) => {
      const tx = await conexion.cliente.transaction("read");
      const cerrar = vi.spyOn(tx, "close");
      const rollback = vi.spyOn(tx, "rollback");
      const commit = vi.spyOn(tx, "commit");
      vi.spyOn(conexion.cliente, "transaction").mockResolvedValueOnce(tx);
      globalThis.santisoConexionDb = Promise.resolve(conexion);
      if (caso === "rollback") rollback.mockRejectedValueOnce(new Error("fallo rollback"));
      try {
        if (caso === "éxito") {
          const resultado = await listarEstadisticasJugadores(ambito);
          expect(resultado.filas.find((f) => f.jugadorId === "autor")?.goles).toBe(4);
        } else {
          await expect(
            listarEstadisticasJugadores({ ...ambito, temporadaId: "inexistente" }),
          ).rejects.toThrow(caso === "consulta" ? /temporada/i : /fallo rollback/);
        }
        if (caso === "éxito") expect(commit).toHaveBeenCalledOnce();
        else expect(rollback).toHaveBeenCalledOnce();
        expect(cerrar).toHaveBeenCalledOnce();
        expect(tx.closed).toBe(true);
      } finally {
        tx.close();
      }
    },
  );
});
