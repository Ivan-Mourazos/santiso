import { describe, expect, it } from "vitest";

import {
  cambioDeHorario,
  fechaBreve,
  fechaDeFederacion,
  jornadasPorJugar,
  jornadasSinArbitro,
  nombreDeArbitro,
  tocaMirarHorarios,
} from "./horarios";
import { jornadasSinEventos, tocaPasadaDiaria, type PartidoLocal } from "./plan";

const partido = (jornada: number, fecha: string | null, extra: Partial<PartidoLocal> = {}) =>
  ({
    id: `p${jornada}-${fecha}`,
    jornada,
    local: "A",
    visitante: "B",
    fecha,
    conMarcador: false,
    propio: false,
    conActa: false,
    ...extra,
  }) satisfies PartidoLocal;

describe("horarios de la federación", () => {
  it("junta día y hora con el formato de los partidos", () => {
    expect(fechaDeFederacion("2026-10-18", "17:00")).toBe("2026-10-18T17:00");
    expect(fechaDeFederacion("2026-10-18", null)).toBe("2026-10-18");
    expect(fechaBreve("2026-10-18T17:00")).toBe("18/10 17:00");
    expect(fechaBreve("2026-10-18")).toBe("18/10");
  });

  it("se miran al principio y luego cada pocas horas", () => {
    const ahora = new Date("2026-10-12T20:00:00Z");
    expect(tocaMirarHorarios(null, ahora)).toBe(true);
    expect(tocaMirarHorarios("2026-10-12T18:30:00Z", ahora)).toBe(false);
    expect(tocaMirarHorarios("2026-10-12T17:00:00Z", ahora)).toBe(true);
    expect(tocaMirarHorarios("no es una fecha", ahora)).toBe(true);
  });

  it("elige las dos jornadas más próximas que quedan por jugar", () => {
    const partidos = [
      partido(2, "2026-10-04T17:00", { conMarcador: true }),
      partido(3, "2026-10-18T17:00"),
      partido(3, "2026-10-17T18:00"),
      partido(4, "2026-10-25"),
      partido(5, "2026-11-01"),
      partido(6, null),
    ];
    expect(jornadasPorJugar(partidos, "2026-10-12T22:00")).toEqual([3, 4]);
    // El mismo día, sin hora publicada, sigue contando; uno ya empezado, no.
    expect(jornadasPorJugar(partidos, "2026-10-25T09:00")).toEqual([4, 5]);
    expect(jornadasPorJugar([partido(3, "2026-10-18T17:00")], "2026-10-18T17:30")).toEqual([]);
  });

  it("aplica lo que diga la federación cuando es distinto de lo que hay", () => {
    const federacion = { fecha: "2026-10-18T16:30", campo: "Municipal de Santiso" };
    expect(cambioDeHorario(federacion, { fecha: "2026-10-18T17:00" })).toEqual({
      fecha: "2026-10-18T16:30",
      campo: "Municipal de Santiso",
    });
    expect(cambioDeHorario(federacion, { fecha: "2026-10-18T16:30" })).toEqual({
      fecha: null,
      campo: "Municipal de Santiso",
    });
    expect(cambioDeHorario(federacion, { fecha: null })).toMatchObject({
      fecha: "2026-10-18T16:30",
    });
  });

  it("no cambia una hora por «sin hora» ni un campo por «por asignar»", () => {
    expect(
      cambioDeHorario({ fecha: "2026-10-25", campo: "" }, { fecha: "2026-10-25T17:00" }),
    ).toEqual({ fecha: null, campo: null });
    // Pero si la federación mueve el día, manda ella aunque todavía no dé hora.
    expect(
      cambioDeHorario({ fecha: "2026-10-24", campo: "" }, { fecha: "2026-10-25T17:00" }),
    ).toEqual({ fecha: "2026-10-24", campo: null });
  });

  it("escribe el árbitro como una persona, no como una lista", () => {
    expect(nombreDeArbitro("ENRIQUEZ PEREIRO, OSCAR")).toBe("Oscar Enriquez Pereiro");
    expect(nombreDeArbitro("  LOPEZ BLANCO ,  VICTOR ")).toBe("Victor Lopez Blanco");
    expect(nombreDeArbitro("COMITÉ")).toBe("Comité");
  });

  it("busca el árbitro de lo jugado hace poco, lo más reciente primero", () => {
    const jugado = (jornada: number, fecha: string, conArbitro = false) =>
      partido(jornada, fecha, { conMarcador: true, conArbitro });
    const partidos = [
      jugado(1, "2026-09-27T17:00"),
      jugado(2, "2026-10-04T17:00"),
      jugado(3, "2026-10-11T17:00", true),
      jugado(0, "2026-06-01T17:00"),
      partido(4, "2026-10-18T17:00"),
    ];
    expect(jornadasSinArbitro(partidos, "2026-10-12T22:00", "2026-08-28T22:00")).toEqual([2, 1]);
  });

  it("pone al día dos jornadas viejas cada vez, las más antiguas primero", () => {
    const jugado = (jornada: number, conEventos = false) =>
      partido(jornada, `2026-09-${10 + jornada}T17:00`, { conMarcador: true, conEventos });
    const partidos = [jugado(3), jugado(1), jugado(2, true), jugado(4), partido(5, "2026-10-18")];
    expect(jornadasSinEventos(partidos, "2026-10-12T22:00")).toEqual([1, 3]);
  });

  it("la comprobación diaria se hace una vez, a partir de las 21:00", () => {
    const el = (dia: number, hora: number, minuto = 0) => new Date(2026, 9, dia, hora, minuto);
    // Nunca se miró: toca.
    expect(tocaPasadaDiaria(el(13, 10), null)).toBe(true);
    // Hecha ayer a las 21:05: hoy no toca hasta las 21:00.
    expect(tocaPasadaDiaria(el(13, 20, 59), el(12, 21, 5))).toBe(false);
    expect(tocaPasadaDiaria(el(13, 21, 0), el(12, 21, 5))).toBe(true);
    // Ya hecha hoy después de las 21:00: no se repite.
    expect(tocaPasadaDiaria(el(13, 23), el(13, 21, 10))).toBe(false);
    // El ordenador estuvo apagado anoche: se hace por la mañana, al arrancar.
    expect(tocaPasadaDiaria(el(13, 9), el(11, 21, 5))).toBe(true);
    // Mirar a mano por la tarde no quita la de la noche; hacerlo después de las 21:00, sí.
    expect(tocaPasadaDiaria(el(13, 21, 30), el(13, 18))).toBe(true);
    expect(tocaPasadaDiaria(el(13, 22), el(13, 21, 30))).toBe(false);
  });
});
