import { describe, expect, it } from "vitest";
import { normalizarNombreTemporada, siguienteTemporada } from "./temporadas";

describe("normalizarNombreTemporada", () => {
  it("normaliza a AAAA/AA", () => {
    expect(normalizarNombreTemporada("25/26")).toBe("2025/26");
    expect(normalizarNombreTemporada("2026/27")).toBe("2026/27");
    expect(normalizarNombreTemporada("2025-2026")).toBe("2025/26");
    expect(normalizarNombreTemporada(" 2026 / 27 ")).toBe("2026/27");
  });

  it("rechaza años no consecutivos", () => {
    expect(() => normalizarNombreTemporada("2025/27")).toThrow(/no consecutiva/);
  });

  it("rechaza textos que no son temporadas", () => {
    expect(() => normalizarNombreTemporada("temporada actual")).toThrow(/inválido/);
  });
});

describe("siguienteTemporada", () => {
  it("propone la siguiente a la más reciente, sin importar el orden", () => {
    expect(siguienteTemporada(["2025/26", "2026/27"])).toBe("2027/28");
    expect(siguienteTemporada(["2026/27", "2024/25"])).toBe("2027/28");
  });
  it("sin temporadas, la del año en curso según el mes", () => {
    expect(siguienteTemporada([], new Date(2026, 8, 23))).toBe("2026/27");
    expect(siguienteTemporada([], new Date(2027, 2, 1))).toBe("2026/27");
  });
  it("ignora los nombres que no entiende", () => {
    expect(siguienteTemporada(["basura", "2025/26"])).toBe("2026/27");
  });
});
