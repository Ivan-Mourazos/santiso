import { describe, expect, it } from "vitest";
import { idDeterminista } from "./ids";

describe("idDeterminista", () => {
  it("es estable, distingue entradas y tiene formato UUID v8", () => {
    const id = idDeterminista("equipo", "Veteranos", "s d cruces");
    expect(idDeterminista("equipo", "Veteranos", "s d cruces")).toBe(id);
    expect(idDeterminista("equipo", "Senior", "s d cruces")).not.toBe(id);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("no confunde partes concatenadas", () => {
    expect(idDeterminista("ab", "c")).not.toBe(idDeterminista("a", "bc"));
  });
});
