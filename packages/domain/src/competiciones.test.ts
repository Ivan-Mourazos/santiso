import { describe, expect, it } from "vitest";
import { reglasClasificacionSchema } from "./competiciones";

describe("reglasClasificacionSchema", () => {
  it("acepta las reglas guardadas en la BD actual", () => {
    const reglas = [
      {
        id: "eb69acb1-05ca-444f-bf37-02429587dcc6",
        color: "#10b981",
        nombre: "Pase a Cuadro Copa",
        puestos: [1],
      },
    ];
    expect(reglasClasificacionSchema.parse(reglas)).toEqual(reglas);
  });

  it("rechaza colores no hexadecimales y reglas sin puestos", () => {
    expect(() =>
      reglasClasificacionSchema.parse([{ id: "a", nombre: "X", puestos: [1], color: "verde" }]),
    ).toThrow();
    expect(() =>
      reglasClasificacionSchema.parse([{ id: "a", nombre: "X", puestos: [], color: "#10b981" }]),
    ).toThrow();
  });
});
