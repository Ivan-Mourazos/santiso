import { describe, expect, it } from "vitest";

import { MAXIMO_JORNADAS, jornadasPendientes, partidoDeActa, type PartidoLocal } from "./plan";

const partido = (parte: Partial<PartidoLocal>): PartidoLocal => ({
  id: "p",
  jornada: 1,
  local: "S.D. Bandeira",
  visitante: "C.D. Berres",
  fecha: "2026-10-04T17:00",
  conMarcador: false,
  propio: false,
  conActa: false,
  ...parte,
});

describe("jornadasPendientes", () => {
  const ahora = "2026-10-05T10:00";

  it("mira la jornada con un partido ya jugado y sin marcador", () => {
    expect(jornadasPendientes([partido({ jornada: 2 })], ahora)).toEqual([2]);
  });

  it("no mira lo que aún no ha empezado ni lo que no tiene fecha", () => {
    expect(
      jornadasPendientes(
        [partido({ jornada: 3, fecha: "2026-10-18T17:00" }), partido({ jornada: 4, fecha: null })],
        ahora,
      ),
    ).toEqual([]);
  });

  it("con marcador, un partido ajeno está completo; uno del Santiso necesita además su acta", () => {
    const ajeno = partido({ jornada: 2, conMarcador: true });
    const nuestro = partido({ jornada: 5, conMarcador: true, propio: true });
    expect(jornadasPendientes([ajeno], ahora)).toEqual([]);
    expect(jornadasPendientes([nuestro], ahora)).toEqual([5]);
    expect(jornadasPendientes([{ ...nuestro, conActa: true }], ahora)).toEqual([]);
  });

  it("las más antiguas primero y sin pasar del tope por pasada", () => {
    const muchas = [7, 3, 5, 1, 9].map((jornada) => partido({ jornada }));
    const pendientes = jornadasPendientes(muchas, ahora);
    expect(pendientes).toEqual([1, 3, 5]);
    expect(pendientes).toHaveLength(MAXIMO_JORNADAS);
  });
});

describe("partidoDeActa", () => {
  const jornada = [
    partido({ id: "a", local: "C.D. Berres", visitante: "U.D. Santiso F.C." }),
    partido({ id: "b", local: 'C.S.D. Arzúa "B"', visitante: "Guerreros del Sol" }),
  ];

  it("casa los nombres como los escribe la federación", () => {
    expect(partidoDeActa("C.D. BERRES", "U.D. SANTISO F.C.", jornada)?.id).toBe("a");
    expect(partidoDeActa('C.S.D ARZUA "B"', "GUERREROS DEL SOL", jornada)?.id).toBe("b");
  });

  it("respeta quién es local: la vuelta no es el mismo partido", () => {
    expect(partidoDeActa("U.D. SANTISO F.C.", "C.D. BERRES", jornada)).toBeNull();
  });

  it("no elige si no hay ninguno o si valdrían dos", () => {
    expect(partidoDeActa("VILATUXE F.C.", "CLUB ARENAL", jornada)).toBeNull();
    const repetido = [...jornada, partido({ id: "c", local: "CD Berres", visitante: "UD Santiso FC" })];
    expect(partidoDeActa("C.D. BERRES", "U.D. SANTISO F.C.", repetido)).toBeNull();
  });
});
