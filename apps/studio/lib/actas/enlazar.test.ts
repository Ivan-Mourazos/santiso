import { describe, expect, it } from "vitest";

import { enlazarActa, jugadorSeguro } from "./enlazar";
import type { ActaPlayerRef, ParsedActa } from "./types";

const plantilla = [
  { id: "iago", nombre: "Iago Castro Coego", apodo: "Iago SR" },
  { id: "manu", nombre: "Manuel Mejuto Martínez", apodo: "Manu Mejuto" },
  { id: "xandre", nombre: "Alexandre Mejuto Camba", apodo: "Xandre" },
  { id: "novas", nombre: "Manuel Vázquez Novas", apodo: null },
  { id: "chouri", nombre: "Manuel Vázquez Pereiro", apodo: "Chouri" },
];

describe("jugadorSeguro", () => {
  it("reconoce «APELLIDOS, NOMBRE» aunque aquí se guarde al revés y con tildes", () => {
    expect(jugadorSeguro("CASTRO COEGO, IAGO", plantilla)?.id).toBe("iago");
    expect(jugadorSeguro("MEJUTO MARTINEZ, MANUEL", plantilla)?.id).toBe("manu");
  });

  it("distingue a dos jugadores que comparten nombre y primer apellido", () => {
    expect(jugadorSeguro("VAZQUEZ NOVAS, MANUEL", plantilla)?.id).toBe("novas");
    expect(jugadorSeguro("VAZQUEZ PEREIRO, MANUEL", plantilla)?.id).toBe("chouri");
  });

  it("no elige cuando el nombre vale para dos", () => {
    expect(jugadorSeguro("VAZQUEZ, MANUEL", plantilla)).toBeNull();
  });

  it("no reconoce a quien no está en la plantilla", () => {
    expect(jugadorSeguro("PAYNO MIGUEZ, ANTON", plantilla)).toBeNull();
    expect(jugadorSeguro("", plantilla)).toBeNull();
    expect(jugadorSeguro("CASTRO COEGO, IAGO", [])).toBeNull();
  });
});

describe("enlazarActa", () => {
  const ref = (rawName: string, dorsal = ""): ActaPlayerRef => ({ id: rawName, dorsal, rawName });
  const acta = (parte: Partial<ParsedActa>): ParsedActa => ({
    marcadorLocal: "8",
    marcadorVisitante: "3",
    campoNombre: "",
    campoPoblacion: "",
    titulares: [],
    suplentes: [],
    eventos: [],
    warnings: [],
    rawText: "ficha",
    ...parte,
  });

  it("enlaza convocatoria y eventos y no deja dudas", () => {
    const { acta: enlazada, dudas } = enlazarActa(
      acta({
        titulares: [ref("CASTRO COEGO, IAGO", "4"), ref("MEJUTO MARTINEZ, MANUEL", "1")],
        suplentes: [ref("VAZQUEZ PEREIRO, MANUEL", "23")],
        eventos: [
          {
            id: "g",
            tipo: "gol",
            minuto: "75",
            isRival: false,
            confidence: "alta",
            jugador: ref("CASTRO COEGO, IAGO"),
          },
          {
            id: "c",
            tipo: "cambio",
            minuto: "36",
            isRival: false,
            confidence: "alta",
            jugadorEntra: ref("VAZQUEZ PEREIRO, MANUEL"),
            jugadorSale: ref("MEJUTO MARTINEZ, MANUEL"),
          },
          { id: "r", tipo: "gol", minuto: "16", isRival: true, confidence: "alta", nombreRival: "X" },
        ],
      }),
      plantilla,
    );
    expect(dudas).toEqual([]);
    expect(enlazada.titulares.map((j) => j.jugadorId)).toEqual(["iago", "manu"]);
    expect(enlazada.titulares[0]?.displayName).toBe("Iago SR");
    expect(enlazada.suplentes[0]?.jugadorId).toBe("chouri");
    expect(enlazada.eventos[0]?.jugador?.jugadorId).toBe("iago");
    expect(enlazada.eventos[1]?.jugadorEntra?.jugadorId).toBe("chouri");
    expect(enlazada.eventos[1]?.jugadorSale?.jugadorId).toBe("manu");
    // El evento del rival no lleva jugador propio y no genera duda.
    expect(enlazada.eventos[2]?.jugador).toBeUndefined();
  });

  it("apunta como duda a quien no reconoce, una vez aunque salga varias", () => {
    const { acta: enlazada, dudas } = enlazarActa(
      acta({
        titulares: [ref("FICHAJE NUEVO, PEPE"), ref("CASTRO COEGO, IAGO")],
        eventos: [
          {
            id: "g",
            tipo: "gol",
            minuto: "5",
            isRival: false,
            confidence: "alta",
            jugador: ref("FICHAJE NUEVO, PEPE"),
          },
        ],
      }),
      plantilla,
    );
    expect(dudas).toEqual(["FICHAJE NUEVO, PEPE"]);
    expect(enlazada.titulares[0]?.jugadorId).toBeUndefined();
    expect(enlazada.titulares[1]?.jugadorId).toBe("iago");
  });

  it("dos nombres del acta para la misma persona son una duda", () => {
    const { dudas } = enlazarActa(
      acta({ titulares: [ref("CASTRO COEGO, IAGO"), ref("COEGO CASTRO, IAGO MANUEL")] }),
      [plantilla[0]!],
    );
    expect(dudas).toHaveLength(1);
  });
});
