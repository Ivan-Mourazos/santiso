import { describe, expect, it } from "vitest";
import { normalizarCategoria } from "./categorias";

describe("normalizarCategoria", () => {
  it("acepta variantes de escritura", () => {
    expect(normalizarCategoria("Sénior")).toBe("Senior");
    expect(normalizarCategoria("FEMININO")).toBe("Femenino");
    expect(normalizarCategoria("veteranos")).toBe("Veteranos");
  });

  it("rechaza categorías desconocidas", () => {
    expect(() => normalizarCategoria("Juvenil")).toThrow(/Categoría desconocida/);
  });
});
