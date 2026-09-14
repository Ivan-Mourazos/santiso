import { describe, expect, it } from "vitest";
import { idDeterminista } from "./ids";

describe("idDeterminista", () => {
  it("valor de referencia: cambiar esta función invalida los ids ya guardados en data/santiso.db", () => {
    // Los ids deterministas se calculan una vez en la migración y quedan grabados en la BD: si
    // esta prueba deja de cumplirse, cualquier cambio en el algoritmo desincroniza los ids nuevos
    // de los ya migrados. No "arreglar" el valor esperado sin más: hay que evaluar el impacto.
    expect(idDeterminista("equipo", "Veteranos", "s d cruces")).toBe(
      "8a2e55c6-bba0-8af1-928d-42905df94048",
    );
  });

  it("es estable, distingue entradas y tiene formato UUID v8", () => {
    const id = idDeterminista("equipo", "Veteranos", "s d cruces");
    expect(idDeterminista("equipo", "Veteranos", "s d cruces")).toBe(id);
    expect(idDeterminista("equipo", "Senior", "s d cruces")).not.toBe(id);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("no confunde partes concatenadas", () => {
    expect(idDeterminista("ab", "c")).not.toBe(idDeterminista("a", "bc"));
    expect(idDeterminista("equipo", "Sporting Melide", "Senior")).not.toBe(
      idDeterminista("equipo", "Sporting", "Melide Senior"),
    );
  });
});
