import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { jornadaActual } = await import("./partidos-liga");

const p = (jornada: number, fecha: string | null, jugado: boolean) => ({ jornada, fecha, jugado });

describe("jornadaActual", () => {
  it("el día de un partido del Santiso, la de ese partido aunque ya tenga resultado", () => {
    expect(
      jornadaActual([p(5, "2026-10-11T17:00", true), p(6, "2026-10-18T17:00", true)], "2026-10-18T21:00"),
    ).toBe(6);
  });
  it("si no juega hoy, la del próximo partido por jugar", () => {
    expect(
      jornadaActual(
        [p(5, "2026-10-11T17:00", true), p(7, "2026-10-25T17:00", false), p(6, "2026-10-19T17:00", false)],
        "2026-10-15T10:00",
      ),
    ).toBe(6);
  });
  it("el recién jugado sigue dos días si le faltan carteles, salvo que hoy se juegue otro", () => {
    const jugado = { ...p(5, "2026-10-17T17:00", true), cerrado: false };
    const proximo = p(6, "2026-10-19T17:00", false);
    expect(jornadaActual([jugado, proximo], "2026-10-18T10:00")).toBe(5);
    expect(jornadaActual([{ ...jugado, cerrado: true }, proximo], "2026-10-18T10:00")).toBe(6);
    expect(jornadaActual([jugado, proximo], "2026-10-19T10:00")).toBe(6);
    expect(jornadaActual([jugado, p(6, "2026-10-25T17:00", false)], "2026-10-20T10:00")).toBe(6);
  });
  it("sin partidos por jugar, la última jugada", () => {
    expect(jornadaActual([p(1, "2026-09-01", true), p(2, "2026-09-08", true)], "2027-01-01T10:00")).toBe(2);
  });
  it("sin partidos del Santiso, ninguna", () => {
    expect(jornadaActual([], "2026-10-15T10:00")).toBeNull();
  });
});
