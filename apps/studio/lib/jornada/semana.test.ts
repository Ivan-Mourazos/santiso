import { describe, expect, it } from "vitest";
import { enSemana, esDia, hoyLocal, semanaDe, semanaVecina } from "./semana";

describe("semanaDe", () => {
  it("va de lunes a domingo", () => {
    // 23/09/2026 es miércoles.
    expect(semanaDe("2026-09-23")).toEqual({ desde: "2026-09-21", hasta: "2026-09-27" });
  });
  it("el domingo pertenece a la semana que acaba, no a la siguiente", () => {
    expect(semanaDe("2026-09-27")).toEqual({ desde: "2026-09-21", hasta: "2026-09-27" });
  });
  it("cruza meses y años", () => {
    expect(semanaDe("2026-10-01")).toEqual({ desde: "2026-09-28", hasta: "2026-10-04" });
    expect(semanaDe("2027-01-01")).toEqual({ desde: "2026-12-28", hasta: "2027-01-03" });
  });
  it("rechaza días que no existen", () => {
    expect(() => semanaDe("2026-02-30")).toThrow(/no válido/);
    expect(esDia("2026-13-01")).toBe(false);
    expect(esDia("ayer")).toBe(false);
    expect(esDia("2026-09-23")).toBe(true);
  });
});

describe("semanaVecina", () => {
  it("da el lunes de la semana de al lado", () => {
    expect(semanaVecina("2026-09-23", 1)).toBe("2026-09-28");
    expect(semanaVecina("2026-09-23", -1)).toBe("2026-09-14");
  });
});

describe("enSemana", () => {
  const semana = semanaDe("2026-09-23");
  it("compara por el día, con o sin hora", () => {
    expect(enSemana("2026-09-27T17:00", semana)).toBe(true);
    expect(enSemana("2026-09-21", semana)).toBe(true);
    expect(enSemana("2026-09-28T10:00", semana)).toBe(false);
    expect(enSemana(null, semana)).toBe(false);
  });
});

it("hoyLocal da la fecha local", () => {
  expect(hoyLocal(new Date(2026, 8, 23, 23, 30))).toBe("2026-09-23");
});
