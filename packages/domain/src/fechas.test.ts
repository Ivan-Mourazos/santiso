import { describe, expect, it } from "vitest";
import { aFechaHoraLiteral, aFechaLiteral, aInstanteIso } from "./fechas";

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
