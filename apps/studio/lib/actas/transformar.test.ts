import { describe, expect, it } from "vitest";
import { ErrorActa, eventosDeActa, participacionesDeActa } from "./transformar";
import type { ActaEvent, ActaPlayerRef, ParsedActa } from "./types";

const jugador = (id: string, dorsal = "1"): ActaPlayerRef => ({
  id: `ref-${id}`,
  dorsal,
  rawName: id,
  jugadorId: id,
});

const acta = (parcial: Partial<ParsedActa> = {}): ParsedActa => ({
  marcadorLocal: "1",
  marcadorVisitante: "0",
  campoNombre: "",
  campoPoblacion: "",
  titulares: [],
  suplentes: [],
  eventos: [],
  warnings: [],
  rawText: "",
  ...parcial,
});

const evento = (parcial: Partial<ActaEvent>): ActaEvent => ({
  id: "e1",
  tipo: "gol",
  minuto: "10",
  isRival: false,
  confidence: "alta",
  ...parcial,
});

describe("participacionesDeActa", () => {
  it("marca titulares como jugados y suplentes como no jugados", () => {
    expect(
      participacionesDeActa(acta({ titulares: [jugador("a")], suplentes: [jugador("b")] })),
    ).toEqual([
      { jugadorId: "a", titular: true, jugo: true },
      { jugadorId: "b", titular: false, jugo: false },
    ]);
  });

  it("ignora a quien no está enlazado con un jugador de la base de datos", () => {
    const sinEnlazar: ActaPlayerRef = { id: "ref", dorsal: "9", rawName: "Desconocido" };
    expect(participacionesDeActa(acta({ titulares: [sinEnlazar] }))).toEqual([]);
  });

  it("no duplica a quien aparece como titular y como suplente", () => {
    expect(
      participacionesDeActa(acta({ titulares: [jugador("a")], suplentes: [jugador("a")] })),
    ).toEqual([{ jugadorId: "a", titular: true, jugo: true }]);
  });

  it("marca como jugado al suplente que marca un gol", () => {
    expect(
      participacionesDeActa(
        acta({ suplentes: [jugador("b")], eventos: [evento({ jugador: jugador("b") })] }),
      ),
    ).toEqual([{ jugadorId: "b", titular: false, jugo: true }]);
  });

  it("marca como jugado al suplente que entra en un cambio", () => {
    expect(
      participacionesDeActa(
        acta({
          titulares: [jugador("a")],
          suplentes: [jugador("b")],
          eventos: [
            evento({ tipo: "cambio", jugadorEntra: jugador("b"), jugadorSale: jugador("a") }),
          ],
        }),
      ),
    ).toContainEqual({ jugadorId: "b", titular: false, jugo: true });
  });

  it("crea la participación de quien tiene eventos pero no estaba en las listas", () => {
    expect(participacionesDeActa(acta({ eventos: [evento({ jugador: jugador("z") })] }))).toEqual([
      { jugadorId: "z", titular: false, jugo: true },
    ]);
  });

  it("cuenta como jugado a quien marca en propia en nuestra portería", () => {
    expect(
      participacionesDeActa(
        acta({
          suplentes: [jugador("b")],
          eventos: [evento({ isRival: true, esPropiaSantiso: true, jugador: jugador("b") })],
        }),
      ),
    ).toEqual([{ jugadorId: "b", titular: false, jugo: true }]);
  });
});

describe("eventosDeActa", () => {
  it("gol propio con jugador", () => {
    expect(eventosDeActa(acta({ eventos: [evento({ jugador: jugador("a") })] }))).toEqual([
      {
        tipo: "gol",
        lado: "propio",
        propia: false,
        minuto: 10,
        jugadorId: "a",
        jugadorSaleId: null,
        nombreRival: null,
      },
    ]);
  });

  it("gol en propia de un rival cuenta para nosotros y guarda su nombre", () => {
    expect(
      eventosDeActa(acta({ eventos: [evento({ esPropia: true, nombreRival: "Pérez" })] }))[0],
    ).toMatchObject({ lado: "propio", propia: true, nombreRival: "Pérez", jugadorId: null });
  });

  it("gol en propia nuestro cuenta para el rival y guarda nuestro jugador", () => {
    expect(
      eventosDeActa(
        acta({
          eventos: [evento({ isRival: true, esPropiaSantiso: true, jugador: jugador("a") })],
        }),
      )[0],
    ).toMatchObject({ lado: "rival", propia: true, jugadorId: "a", nombreRival: null });
  });

  it("gol del rival guarda su nombre y ningún jugador", () => {
    expect(
      eventosDeActa(acta({ eventos: [evento({ isRival: true, nombreRival: "Gómez" })] }))[0],
    ).toMatchObject({ lado: "rival", propia: false, jugadorId: null, nombreRival: "Gómez" });
  });

  it("tarjetas propias y rivales", () => {
    const resultado = eventosDeActa(
      acta({
        eventos: [
          evento({ tipo: "tarjeta_amarilla", jugador: jugador("a") }),
          evento({ id: "e2", tipo: "tarjeta_roja", isRival: true, nombreRival: "Gómez" }),
        ],
      }),
    );
    expect(resultado[0]).toMatchObject({
      tipo: "tarjeta_amarilla",
      lado: "propio",
      jugadorId: "a",
    });
    expect(resultado[1]).toMatchObject({
      tipo: "tarjeta_roja",
      lado: "rival",
      nombreRival: "Gómez",
    });
  });

  it("cambio guarda quien entra y quien sale", () => {
    expect(
      eventosDeActa(
        acta({
          eventos: [
            evento({ tipo: "cambio", jugadorEntra: jugador("b"), jugadorSale: jugador("a") }),
          ],
        }),
      )[0],
    ).toMatchObject({ tipo: "cambio", lado: "propio", jugadorId: "b", jugadorSaleId: "a" });
  });

  it("el minuto vacío se guarda como nulo y uno fuera de rango se rechaza", () => {
    expect(
      eventosDeActa(acta({ eventos: [evento({ minuto: "", jugador: jugador("a") })] }))[0],
    ).toMatchObject({ minuto: null });
    expect(() =>
      eventosDeActa(acta({ eventos: [evento({ minuto: "999", jugador: jugador("a") })] })),
    ).toThrow(ErrorActa);
  });

  it("rechaza un gol propio sin jugador ni marca de propia", () => {
    expect(() => eventosDeActa(acta({ eventos: [evento({})] }))).toThrow(ErrorActa);
  });

  it("rechaza un cambio al que le falta el jugador que sale", () => {
    expect(() =>
      eventosDeActa(acta({ eventos: [evento({ tipo: "cambio", jugadorEntra: jugador("b") })] })),
    ).toThrow(ErrorActa);
  });

  it("descarta eventos repetidos", () => {
    const uno = evento({ jugador: jugador("a") });
    const otro = evento({ id: "e2", jugador: jugador("a") });
    expect(eventosDeActa(acta({ eventos: [uno, otro] }))).toHaveLength(1);
  });
});
