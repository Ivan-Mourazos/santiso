import { describe, expect, it } from "vitest";
import { normalizarNombreTemporada } from "./temporadas";

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
