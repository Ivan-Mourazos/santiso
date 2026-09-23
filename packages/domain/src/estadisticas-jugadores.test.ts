import { describe, expect, it } from "vitest";
import { calcularEstadisticasJugadores, type EventoEstadistica } from "./estadisticas-jugadores";

const evento = (id: string, cambios: Partial<EventoEstadistica> = {}): EventoEstadistica => ({
  id,
  partidoId: "p1",
  jugadorId: "a",
  tipo: "gol",
  lado: "propio",
  propia: false,
  ...cambios,
});

describe("estadísticas de jugadores", () => {
  it("cuenta convocados, titulares y suplentes sin inferir minutos", () => {
    const filas = calcularEstadisticasJugadores(
      [
        { partidoId: "p1", jugadorId: "a", titular: true, jugo: true },
        { partidoId: "p2", jugadorId: "a", titular: false, jugo: true },
        { partidoId: "p3", jugadorId: "a", titular: false, jugo: false },
        { partidoId: "p1", jugadorId: "b", titular: false, jugo: false },
      ],
      [],
    );
    expect(filas).toEqual([
      {
        jugadorId: "a",
        convocados: 3,
        titularidades: 1,
        partidosJugados: 2,
        goles: 0,
        golesPropia: 0,
        amarillas: 0,
        rojas: 0,
        golesPenalti: null,
      },
      {
        jugadorId: "b",
        convocados: 1,
        titularidades: 0,
        partidosJugados: 0,
        goles: 0,
        golesPropia: 0,
        amarillas: 0,
        rojas: 0,
        golesPenalti: null,
      },
    ]);
  });
  it("separa goles y propia sin atribuir goles del rival", () => {
    expect(
      calcularEstadisticasJugadores(
        [],
        [
          evento("g1"),
          evento("g2"),
          evento("p1", { lado: "rival", propia: true }),
          evento("p2", { propia: true }),
          evento("r1", { lado: "rival" }),
          evento("s1", { jugadorId: null }),
        ],
      ),
    ).toEqual([
      {
        jugadorId: "a",
        convocados: 0,
        titularidades: 0,
        partidosJugados: 0,
        goles: 2,
        golesPropia: 1,
        amarillas: 0,
        rojas: 0,
        golesPenalti: null,
      },
    ]);
  });
  it("suma tarjetas propias almacenadas sin convertir dos amarillas en roja extra", () => {
    const [fila] = calcularEstadisticasJugadores(
      [],
      [
        evento("a1", { tipo: "tarjeta_amarilla" }),
        evento("a2", { tipo: "tarjeta_amarilla" }),
        evento("r1", { tipo: "tarjeta_roja" }),
        evento("r2", { tipo: "tarjeta_roja", lado: "rival" }),
        evento("a3", { tipo: "tarjeta_amarilla", jugadorId: null }),
        evento("c", { tipo: "cambio" }),
      ],
    );
    expect(fila).toMatchObject({ amarillas: 2, rojas: 1, partidosJugados: 0 });
  });
  it("deduplica identidades, no eventos distintos del mismo partido", () => {
    const p = { partidoId: "p1", jugadorId: "a", titular: true, jugo: true };
    const e = evento("g");
    expect(
      calcularEstadisticasJugadores([p, { ...p }], [e, { ...e }, evento("otro")])[0],
    ).toMatchObject({ convocados: 1, titularidades: 1, partidosJugados: 1, goles: 2 });
  });
  it("no crea filas para eventos ajenos o cambios", () => {
    expect(
      calcularEstadisticasJugadores(
        [],
        [evento("r", { lado: "rival" }), evento("c", { tipo: "cambio" })],
      ),
    ).toEqual([]);
    expect(calcularEstadisticasJugadores([], [])).toEqual([]);
  });
  it("no muta entradas y ordena por identidad estable", () => {
    const eventos = Object.freeze([
      Object.freeze(evento("b", { jugadorId: "b" })),
      Object.freeze(evento("a")),
    ]);
    expect(
      calcularEstadisticasJugadores(Object.freeze([]), eventos).map((f) => f.jugadorId),
    ).toEqual(["a", "b"]);
    expect(eventos[0]?.jugadorId).toBe("b");
  });
});
