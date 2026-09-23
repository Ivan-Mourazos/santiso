import { describe, expect, it } from "vitest";
import { mejorCampo, mejorEquipo, normalizarFecha, parecido } from "./emparejar";

const equipos = [
  { id: "santiso", nombre: "U.D. Santiso F.C." },
  { id: "bandeira", nombre: "S.D. Bandeira" },
  { id: "arzua-b", nombre: 'C.S.D ARZUA "B"' },
];

describe("parecido", () => {
  it("no distingue tildes, mayúsculas ni puntuación", () => {
    expect(parecido("U.D. SANTISO F.C.", "U.D. Santiso F.C.")).toBe(1);
    // Las siglas casan escritas con puntos o sin ellos.
    expect(parecido("ud santiso fc", "U.D. Santiso F.C.")).toBe(1);
    expect(parecido("Arzúa", "ARZUA")).toBe(1);
  });
  it("vacío no se parece a nada", () => {
    expect(parecido("", "Santiso")).toBe(0);
  });
});

describe("mejorEquipo", () => {
  it("enlaza el nombre leído con el del catálogo", () => {
    expect(mejorEquipo("U.D. SANTISO F.C.", equipos)).toBe("santiso");
    expect(mejorEquipo("UD Santiso FC", equipos)).toBe("santiso");
    expect(mejorEquipo("SD BANDEIRA", equipos)).toBe("bandeira");
    expect(mejorEquipo("S.D. BANDEIRA", equipos)).toBe("bandeira");
  });
  it("sin parecido suficiente no inventa: devuelve vacío", () => {
    expect(mejorEquipo("Racing Villalbés", equipos)).toBe("");
    expect(mejorEquipo("   ", equipos)).toBe("");
  });
});

describe("mejorCampo", () => {
  const campos = [
    { id: "merced", nombre: "A Merced", poblacion: "Santiso" },
    { id: "municipal", nombre: "Municipal de Melide", poblacion: "Melide" },
  ];
  it("casa por nombre o por nombre y población", () => {
    expect(mejorCampo("A Merced", "", campos)).toBe("merced");
    expect(mejorCampo("Municipal", "Melide", campos)).toBe("municipal");
  });
  it("sin nombre no elige", () => {
    expect(mejorCampo("", "Santiso", campos)).toBe("");
  });
});

describe("normalizarFecha", () => {
  it("pasa día-mes-año a ISO y conserva la hora", () => {
    expect(normalizarFecha("8/11/2026")).toBe("2026-11-08");
    expect(normalizarFecha("08-11-2026T17:00")).toBe("2026-11-08T17:00");
  });
  it("deja lo que ya es ISO y lo que no entiende", () => {
    expect(normalizarFecha("2026-11-08T17:00")).toBe("2026-11-08T17:00");
    expect(normalizarFecha("mañana")).toBe("mañana");
    expect(normalizarFecha("")).toBe("");
  });
});
