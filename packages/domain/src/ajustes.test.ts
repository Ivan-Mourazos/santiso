import { describe, expect, it } from "vitest";
import { esClaveAjuste, validarAjuste } from "./ajustes";

describe("ajustes", () => {
  it("valida cada clave con su esquema", () => {
    expect(validarAjuste("cartel.orden_logos", "rfgf_izquierda")).toBe("rfgf_izquierda");
    expect(validarAjuste("club.escudo", "escudo_club.webp")).toBe("escudo_club.webp");
    expect(() => validarAjuste("cartel.orden_logos", "izquierda")).toThrow();
    expect(() => validarAjuste("club.escudo", "")).toThrow();
  });

  it("reconoce solo claves conocidas", () => {
    expect(esClaveAjuste("club.escudo")).toBe(true);
    expect(esClaveAjuste("club.color")).toBe(false);
  });
});
