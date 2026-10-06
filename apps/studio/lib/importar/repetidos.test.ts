import { describe, expect, it } from "vitest";

import { sinPartidosRepetidos } from "./repetidos";

const partido = (localNombre: string, visitanteNombre: string, extra = {}) => ({
  localNombre,
  visitanteNombre,
  golesLocal: "",
  golesVisitante: "",
  ...extra,
});

describe("sinPartidosRepetidos", () => {
  it("deja una fila por cruce aunque cambien mayúsculas, puntos o tildes", () => {
    const filas = sinPartidosRepetidos([
      partido("S.D. BANDEIRA", "CLUB ARENAL"),
      partido("U.D. SANTISO F.C.", "ATLETICO ETER"),
      partido("S.D. Bandeira", "Club Arenal"),
      partido("U.D. Santiso F.C.", "Atlético Eter"),
    ]);
    expect(filas.map((f) => f.localNombre)).toEqual(["S.D. BANDEIRA", "U.D. SANTISO F.C."]);
  });

  it("entre dos lecturas del mismo partido se queda con la que trae más datos", () => {
    const filas = sinPartidosRepetidos([
      partido("Vilatuxe F.C.", "C.D. Berres"),
      partido("Vilatuxe F.C.", "C.D. Berres", { golesLocal: "2", golesVisitante: "1" }),
      partido("S.D. Touro", "Guerreros del Sol", { hora: "17:00" }),
      partido("S.D. Touro", "Guerreros del Sol"),
    ]);
    expect(filas).toHaveLength(2);
    expect(filas[0]?.golesLocal).toBe("2");
    expect(filas[1]).toMatchObject({ hora: "17:00" });
  });

  it("la ida y la vuelta son partidos distintos", () => {
    const filas = sinPartidosRepetidos([partido("A", "B"), partido("B", "A")]);
    expect(filas).toHaveLength(2);
  });
});
