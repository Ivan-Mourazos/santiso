import { describe, expect, it } from "vitest";

import { tipoDeCapturas } from "./tipo";

describe("tipoDeCapturas", () => {
  it("respeta lo que declara la lectura", () => {
    expect(tipoDeCapturas({ tipo: "acta" })).toBe("acta");
    expect(tipoDeCapturas({ tipo: " Jornada " })).toBe("jornada");
  });

  it("pregunta cuando el tipo no es ninguno de los que se importan", () => {
    expect(tipoDeCapturas({ tipo: "clasificacion", localTeam: "A", visitorTeam: "B" })).toBeNull();
    expect(tipoDeCapturas({ tipo: "otro" })).toBeNull();
  });

  it("sin tipo, una cabecera con los dos equipos es un acta", () => {
    expect(tipoDeCapturas({ jornada: 2, localTeam: "C.D. Berres", visitorTeam: "Santiso" })).toBe(
      "acta",
    );
  });

  it("sin tipo y sin equipos no se atreve a decidir", () => {
    expect(tipoDeCapturas({})).toBeNull();
    expect(tipoDeCapturas({ jornada: 3, localTeam: "", visitorTeam: null })).toBeNull();
  });
});
