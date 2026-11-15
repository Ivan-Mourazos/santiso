import { expect, it } from "vitest";
import { esPrimeraParte, ordenMinuto } from "./cronoloxia";

it("el descanso va después de todo el descuento de primera parte", () => {
  const minutos = ["46", "45+3", "90+5", "45", "45 + 1", "90", ""];
  const ordenados = [...minutos].sort((a, b) => ordenMinuto(a) - ordenMinuto(b));
  expect(ordenados.filter(esPrimeraParte)).toEqual(["45", "45 + 1", "45+3"]);
  expect(ordenados.filter((m) => !esPrimeraParte(m))).toEqual(["46", "90", "90+5", ""]);
});
