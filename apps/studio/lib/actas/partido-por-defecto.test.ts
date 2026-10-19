import { describe, expect, it } from "vitest";
import { ahoraLocal, partidoJugado, partidoPorDefectoActa } from "./partido-por-defecto";

const base = { estado: "programado", goles_local: null, con_acta: false };
const ahora = "2026-10-19T12:00";

describe("partidoPorDefectoActa", () => {
  it("elige el último jugado sin acta, nunca uno por jugar", () => {
    const partidos = [
      { ...base, id: "j30", fecha: "2027-05-10T17:00" },
      { ...base, id: "j5", fecha: "2026-10-25T17:00" },
      { ...base, id: "j4", fecha: "2026-10-18T17:00", goles_local: 2 },
      { ...base, id: "j3", fecha: "2026-10-11T17:00", goles_local: 1, con_acta: true },
      { ...base, id: "j2", fecha: "2026-10-04T17:00", goles_local: 0 },
    ];
    expect(partidoPorDefectoActa(partidos, ahora)).toBe("j4");
  });

  it("salta los que ya tienen acta y los aplazados", () => {
    const partidos = [
      { ...base, id: "a", fecha: "2026-10-18T17:00", estado: "aplazado" },
      { ...base, id: "b", fecha: "2026-10-11T17:00", con_acta: true, goles_local: 1 },
      { ...base, id: "c", fecha: "2026-10-04T17:00" },
    ];
    expect(partidoPorDefectoActa(partidos, ahora)).toBe("c");
  });

  it("sin ninguno jugado y pendiente, no propone nada", () => {
    expect(partidoPorDefectoActa([{ ...base, id: "x", fecha: "2026-11-01T17:00" }], ahora)).toBe(
      "",
    );
  });
});

describe("partidoJugado", () => {
  it("con marcador o finalizado cuenta aunque falte la fecha", () => {
    expect(partidoJugado({ ...base, id: "a", goles_local: 0 }, ahora)).toBe(true);
    expect(partidoJugado({ ...base, id: "b", estado: "finalizado" }, ahora)).toBe(true);
    expect(partidoJugado({ ...base, id: "c", fecha: null }, ahora)).toBe(false);
  });
});

describe("ahoraLocal", () => {
  it("da la hora local en el formato de la base", () => {
    expect(ahoraLocal(new Date(2026, 9, 5, 9, 7))).toBe("2026-10-05T09:07");
  });
});
