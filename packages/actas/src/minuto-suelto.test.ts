import { expect, it } from "vitest";

import { unirMinutoSuelto } from "./ficha-geometria";

it("devuelve a su fila el minuto que un nombre largo dejó en la línea de abajo", () => {
  expect(
    unirMinutoSuelto([
      "1 - 0 APELIDO, NOME (1')",
      "2 - 0 APELIDO MOI LONGO DE VERDADE, NOME COMPOSTO",
      "(11')",
      "2 - 1 OUTRO, XAN (45+2')",
      "3 - 1 APELIDO MOI LONGO DE VERDADE, NOME COMPOSTO",
      "(90'+3)",
    ]),
  ).toEqual([
    "1 - 0 APELIDO, NOME (1')",
    "2 - 0 APELIDO MOI LONGO DE VERDADE, NOME COMPOSTO (11')",
    "2 - 1 OUTRO, XAN (45+2')",
    "3 - 1 APELIDO MOI LONGO DE VERDADE, NOME COMPOSTO (90'+3)",
  ]);
});

it("no pega un minuto suelto a una fila que ya tiene el suyo, ni a la nada", () => {
  expect(unirMinutoSuelto(["(5')", "1 - 0 A, B (7')", "(9')"])).toEqual([
    "(5')",
    "1 - 0 A, B (7')",
    "(9')",
  ]);
});
