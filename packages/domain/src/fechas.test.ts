import { describe, expect, it } from "vitest";
import { aFechaHoraLiteral, aFechaLiteral, aInstanteIso, fechaHoraDePartido } from "./fechas";

describe("aFechaHoraLiteral", () => {
  it("conserva fecha y hora tal cual, sin convertir zona", () => {
    expect(aFechaHoraLiteral("2026-09-27T17:00:00+00:00")).toBe("2026-09-27T17:00");
    expect(aFechaHoraLiteral("2026-09-27T17:00")).toBe("2026-09-27T17:00");
  });

  it("rechaza formatos no ISO", () => {
    expect(() => aFechaHoraLiteral("27/09/2026 17:00")).toThrow(/Fecha-hora inválida/);
  });
});

describe("aFechaLiteral", () => {
  it("se queda con la parte de fecha", () => {
    expect(aFechaLiteral("2025-10-26T00:00:00+00:00")).toBe("2025-10-26");
    expect(aFechaLiteral("2025-10-26")).toBe("2025-10-26");
  });

  it("rechaza valores sin fecha", () => {
    expect(() => aFechaLiteral("")).toThrow(/Fecha inválida/);
  });
});

describe("aInstanteIso", () => {
  it("normaliza a ISO UTC con milisegundos", () => {
    expect(aInstanteIso("2026-04-20T19:34:47.623266+00:00")).toBe("2026-04-20T19:34:47.623Z");
    expect(aInstanteIso("2026-04-20T21:00:00+02:00")).toBe("2026-04-20T19:00:00.000Z");
  });

  it("rechaza instantes inválidos", () => {
    expect(() => aInstanteIso("ayer")).toThrow(/Instante inválido/);
  });
});

describe("fechaHoraDePartido", () => {
  it("guarda la hora de pared tal cual, también en los días del cambio de hora", () => {
    // 25/10/2026: a las 3:00 vuelven a ser las 2:00. 29/03/2026: de 2:00 se salta a 3:00.
    for (const valor of [
      "2026-09-26T19:00",
      "2026-10-25T02:30",
      "2026-10-25T19:00",
      "2026-11-15T19:00",
      "2026-03-29T02:30",
    ]) {
      expect(fechaHoraDePartido(valor)).toBe(valor);
    }
  });

  it("entiende las horas como se escriben a mano o las lee una foto", () => {
    expect(fechaHoraDePartido("2026-09-26T7:00")).toBe("2026-09-26T07:00");
    expect(fechaHoraDePartido("2026-09-26T19.00")).toBe("2026-09-26T19:00");
    expect(fechaHoraDePartido("2026-09-26T19h")).toBe("2026-09-26T19:00");
    expect(fechaHoraDePartido("2026-09-26 19:00 h")).toBe("2026-09-26T19:00");
    expect(fechaHoraDePartido(" 2026-09-26T19:00 ")).toBe("2026-09-26T19:00");
  });

  it("solo el día vale; vacío es sin fecha", () => {
    expect(fechaHoraDePartido("2026-09-26")).toBe("2026-09-26");
    expect(fechaHoraDePartido("  ")).toBeNull();
  });

  it("rechaza zonas, segundos y fechas u horas imposibles", () => {
    for (const valor of [
      "2026-09-26T19:00Z",
      "2026-09-26T19:00:00+02:00",
      "2026-09-26T19:00:00",
      "2026-02-30T19:00",
      "2026-09-26T24:00",
      "2026-09-26T19:60",
      "26/09/2026 19:00",
    ]) {
      expect(() => fechaHoraDePartido(valor), valor).toThrow();
    }
  });
});
