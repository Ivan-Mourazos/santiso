import { describe, expect, it } from "vitest";
import { iniciales } from "./iniciales";

describe("iniciales", () => {
  it("toma el nombre y el primer apellido", () => {
    expect(iniciales("Iván Sánchez Vázquez")).toBe("IS");
  });
  it("salta las partículas", () => {
    expect(iniciales("José de la Fuente")).toBe("JF");
  });
  it("con una sola palabra da una letra", () => {
    expect(iniciales("Pichi")).toBe("P");
  });
  it("vacío sin nombre", () => {
    expect(iniciales("  ")).toBe("");
  });
  it("en mayúscula aunque venga en minúscula", () => {
    expect(iniciales("álvaro ñúñez")).toBe("ÁÑ");
  });
});
