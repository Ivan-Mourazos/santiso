import { describe, expect, it } from "vitest";
import { snapshotMinimo, snapshotVacio } from "../test/fabricas";
import { validarSnapshot } from "./tipos";

describe("validarSnapshot", () => {
  it("acepta un snapshot coherente", () => {
    const { snapshot } = snapshotMinimo();
    expect(validarSnapshot(snapshot).partidos_liga).toHaveLength(1);
  });

  it("descarta columnas que no se usan", () => {
    const snapshot = snapshotVacio();
    const crudo = {
      ...snapshot,
      campos_futbol: [{ id: "c1", nombre: "Campo", poblacion: null, created_at: null, extra: 1 }],
    };
    expect(validarSnapshot(crudo).campos_futbol[0]).not.toHaveProperty("extra");
  });

  it("se detiene si falta una tabla o una fila tiene otra forma", () => {
    const { temporadas: _omitida, ...sinTemporadas } = snapshotVacio();
    expect(() => validarSnapshot(sinTemporadas)).toThrow(/"temporadas"/);

    const snapshot = snapshotVacio();
    const crudo = {
      ...snapshot,
      temporadas: [{ id: "t", nombre: "2026/27", activa: "si", created_at: null }],
    };
    expect(() => validarSnapshot(crudo)).toThrow(/"temporadas"/);
  });
});
