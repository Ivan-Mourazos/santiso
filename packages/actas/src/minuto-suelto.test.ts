import { expect, it } from "vitest";

import { evento } from "./ficha-eventos";
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

it("lee los minutos con añadido y las tarjetas sacadas tras el final", () => {
  expect(evento("APELIDO, NOME (56')")).toEqual({ autor: "APELIDO, NOME", minuto: "56" });
  expect(evento("APELIDO, NOME (90'+5)")).toEqual({ autor: "APELIDO, NOME", minuto: "90+5" });
  expect(evento("APELIDO DE TAL, NOME (Final)")).toEqual({
    autor: "APELIDO DE TAL, NOME",
    minuto: "90",
  });
  expect(() => evento("APELIDO, NOME")).toThrow(/Evento no reconocido/);
});
