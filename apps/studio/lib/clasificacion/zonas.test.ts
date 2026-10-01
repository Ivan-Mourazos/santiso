import { describe, expect, it } from "vitest";
import { aFila, validarZonas } from "./zonas";

const fila = (nombre: string, desde: string, hasta: string) => ({
  id: nombre,
  nombre,
  desde,
  hasta,
  color: "#10b981",
});

describe("zonas de la clasificación", () => {
  it("convierte cada tramo en su lista de puestos", () => {
    expect(validarZonas([fila("Ascenso", "1", "2"), fila(" Descenso ", "13", "14")], 14)).toEqual({
      zonas: [
        { id: "Ascenso", nombre: "Ascenso", puestos: [1, 2], color: "#10b981" },
        { id: " Descenso ", nombre: "Descenso", puestos: [13, 14], color: "#10b981" },
      ],
    });
  });

  it("rechaza zonas sin nombre, tramos al revés, fuera de la tabla o solapadas", () => {
    expect(validarZonas([fila("", "1", "2")], 14)).toEqual({ error: "Cada zona necesita un nombre." });
    expect(validarZonas([fila("A", "3", "2")], 14)).toMatchObject({ error: /tramo/ });
    expect(validarZonas([fila("A", "13", "15")], 14)).toMatchObject({ error: /14 puestos/ });
    expect(validarZonas([fila("A", "1", "3"), fila("B", "3", "4")], 14)).toEqual({
      error: "El puesto 3 está en «A» y en «B».",
    });
  });

  it("una zona guardada se edita como tramo de su primer a su último puesto", () => {
    expect(aFila({ id: "x", nombre: "Playoff", puestos: [4, 3, 5], color: "#3b82f6" })).toMatchObject({
      desde: "3",
      hasta: "5",
    });
  });
});
