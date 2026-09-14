import { describe, expect, it } from "vitest";
import { ESTADOS_PARTIDO, esValorDe } from "./catalogos";

describe("esValorDe", () => {
  it("indica si el valor pertenece al catálogo", () => {
    expect(esValorDe(ESTADOS_PARTIDO, "finalizado")).toBe(true);
    expect(esValorDe(ESTADOS_PARTIDO, "suspendido")).toBe(false);
  });
});
