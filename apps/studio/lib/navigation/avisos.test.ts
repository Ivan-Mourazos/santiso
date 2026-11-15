import { describe, expect, it } from "vitest";
import { categoriasPorConvocar } from "./avisos";

describe("categoriasPorConvocar", () => {
  it("solo el Senior con el partido por jugar y sin convocados", () => {
    expect([
      ...categoriasPorConvocar([
        { categoria: "Senior", despues: false, convocados: null },
        { categoria: "Veteranos", despues: false, convocados: null },
      ]),
    ]).toEqual(["Senior"]);
  });

  it("hecha la convocatoria, o jugado el partido, ya no", () => {
    expect(
      categoriasPorConvocar([
        { categoria: "Senior", despues: false, convocados: 18 },
        { categoria: "Senior", despues: true, convocados: 0 },
      ]).size,
    ).toBe(0);
  });
});
