import { describe, expect, it } from "vitest";

import { compararClasificacion } from "./clasificacion";

const fila = (equipo: string, puntos: number, jugados = 2, golesFavor = 4, golesContra = 3) => ({
  equipo,
  puntos,
  jugados,
  golesFavor,
  golesContra,
});
const oficial = (equipo: string, puntos: number, sancion = 0, jugados = 2, gf = 4, gc = 3) => ({
  ...fila(equipo, puntos, jugados, gf, gc),
  sancion,
});

describe("comparación con la clasificación oficial", () => {
  it("si todo cuadra no hay diferencias, aunque los nombres se escriban distinto", () => {
    expect(
      compararClasificacion(
        [oficial("S.D. CRUCES", 6), oficial("ATLETICO ETER", 1), oficial('C.S.D ARZUA "B"', 4)],
        [fila('C.S.D. Arzúa "B"', 4), fila("Atlético Éter", 1), fila("S.D. Cruces", 6)],
      ),
    ).toEqual({ diferencias: [], sanciones: [] });
  });

  it("dice en qué no coincide cada equipo", () => {
    const { diferencias } = compararClasificacion(
      [oficial("S.D. CRUCES", 6, 0, 2, 11, 1), oficial("CLUB ARENAL", 0)],
      [fila("S.D. Cruces", 3, 1, 5, 1), fila("Club Arenal", 0)],
    );
    expect(diferencias).toEqual([
      "S.D. Cruces: 2 partidos jugados en la oficial y 1 aquí; 6 puntos en la oficial y 3 aquí; goles 11–1 en la oficial y 5–1 aquí.",
    ]);
  });

  it("una resta de puntos igual a la sanción publicada se explica como sanción", () => {
    const resultado = compararClasificacion([oficial("CLUB ARENAL", 0, 3)], [fila("Club Arenal", 3)]);
    expect(resultado.diferencias).toEqual([
      "Club Arenal: la federación le quita 3 puntos de sanción (0 oficiales, 3 aquí).",
    ]);
    expect(resultado.sanciones).toEqual([{ equipo: "CLUB ARENAL", puntos: 3 }]);
  });

  it("avisa de los equipos que solo están en una de las dos tablas", () => {
    const { diferencias } = compararClasificacion(
      [oficial("S.D. CRUCES", 6), oficial("EQUIPO NUEVO DE VERDAD", 0)],
      [fila("S.D. Cruces", 6), fila("Vilatuxe F.C.", 1)],
    );
    expect(diferencias).toEqual([
      "EQUIPO NUEVO DE VERDAD: está en la oficial y no lo encuentro en el Studio.",
      "Vilatuxe F.C.: está en el Studio y no en la oficial.",
    ]);
  });
});
