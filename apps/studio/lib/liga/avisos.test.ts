import { describe, expect, it } from "vitest";
import { avisosDePlantilla } from "./avisos";
import type { Disciplina } from "./tablas";

const aviso = (persona: string, situacion: Disciplina["situacion"], equipoId = "santiso") => ({
  persona,
  equipoId,
  equipo: equipoId,
  amarillas: 4,
  expulsiones: 0,
  situacion,
  motivo: `motivo de ${persona}`,
});

const plantilla = [
  { id: "j1", nombre: "Alejandro García Rey", apodo: null },
  { id: "j2", nombre: "Brais Pérez Souto", apodo: "Brais" },
  { id: "j3", nombre: "Carlos Pérez Souto", apodo: null },
];

describe("avisosDePlantilla", () => {
  it("enlaza el nombre de la federación con el jugador de la plantilla", () => {
    expect(
      avisosDePlantilla([aviso("GARCIA REY, ALEJANDRO", "apercibido")], "santiso", plantilla),
    ).toEqual([
      {
        jugadorId: "j1",
        persona: "GARCIA REY, ALEJANDRO",
        situacion: "apercibido",
        motivo: "motivo de GARCIA REY, ALEJANDRO",
      },
    ]);
  });

  it("solo los del Santiso y solo los que tienen algo de cara al partido", () => {
    const avisos = avisosDePlantilla(
      [
        aviso("GARCIA REY, ALEJANDRO", "sancionado"),
        aviso("GARCIA REY, ALEJANDRO", "sancionado", "rival"),
        aviso("PEREZ SOUTO, BRAIS", null),
      ],
      "santiso",
      plantilla,
    );
    expect(avisos.map((a) => [a.jugadorId, a.situacion])).toEqual([["j1", "sancionado"]]);
  });

  it("si el nombre no se reconoce sin duda, el aviso queda sin jugador pero no se pierde", () => {
    const avisos = avisosDePlantilla(
      [aviso("PEREZ SOUTO", "expulsado"), aviso("NADIE CONOCIDO, PEPE", "apercibido")],
      "santiso",
      plantilla,
    );
    expect(avisos.map((a) => [a.persona, a.jugadorId])).toEqual([
      ["PEREZ SOUTO", null],
      ["NADIE CONOCIDO, PEPE", null],
    ]);
  });
});
