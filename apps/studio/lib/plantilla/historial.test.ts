import { describe, expect, it } from "vitest";

import {
  filaSiguiente,
  filasDeHistorial,
  normalizarTemporada,
  temporadaAnterior,
  temporadaDe,
  temporadasPosibles,
  textoDeHistorial,
} from "./historial";

describe("historial deportivo en filas", () => {
  it("lee las líneas guardadas, con la temporada escrita de cualquier forma", () => {
    expect(
      filasDeHistorial("25/26: U.D. Santiso F.C.\n2012/13: Atlético de Melide (Juvenil)\n\nSin año"),
    ).toEqual([
      { temporada: "25/26", equipo: "U.D. Santiso F.C." },
      { temporada: "12/13", equipo: "Atlético de Melide (Juvenil)" },
      { temporada: "", equipo: "Sin año" },
    ]);
  });

  it("vuelve al texto que se guarda y no pierde nada por el camino", () => {
    const texto = "25/26: U.D. Santiso F.C.\n09/10: Atlético de Melide (Cadete)\nSin año";
    expect(textoDeHistorial(filasDeHistorial(texto))).toBe(texto);
  });

  it("una fila sin club no se guarda", () => {
    expect(
      textoDeHistorial([
        { temporada: "25/26", equipo: " Santiso " },
        { temporada: "24/25", equipo: "  " },
      ]),
    ).toBe("25/26: Santiso");
  });

  it("sabe cuál es la temporada anterior, también al cambiar de siglo", () => {
    expect(temporadaAnterior("25/26")).toBe("24/25");
    expect(temporadaAnterior("00/01")).toBe("99/00");
    expect(temporadaAnterior("")).toBe("");
  });

  it("la temporada cambia en julio", () => {
    expect(temporadaDe(new Date(2026, 9, 13))).toBe("26/27");
    expect(temporadaDe(new Date(2026, 5, 30))).toBe("25/26");
    expect(temporadasPosibles(new Date(2026, 9, 13), 3)).toEqual(["26/27", "25/26", "24/25"]);
  });

  it("añadir temporada propone la anterior con el mismo club", () => {
    const hoy = new Date(2026, 9, 13);
    expect(filaSiguiente([], hoy)).toEqual({ temporada: "26/27", equipo: "" });
    expect(filaSiguiente([{ temporada: "25/26", equipo: "Santiso" }], hoy)).toEqual({
      temporada: "24/25",
      equipo: "Santiso",
    });
  });

  it("normaliza una temporada escrita a mano", () => {
    expect(normalizarTemporada("2025-2026")).toBe("25/26");
    expect(normalizarTemporada("verano")).toBeNull();
  });
});
