import { describe, expect, it } from "vitest";
import {
  esColumna,
  filtrarPorTexto,
  nombreVisible,
  ordenarEstadisticas,
  totales,
  type FilaEstadistica,
} from "./modelo";

const fila = (parcial: Partial<FilaEstadistica> & { jugadorId: string }): FilaEstadistica => ({
  nombre: "Jugador",
  apodo: null,
  dorsal: null,
  fotoUrl: null,
  inscripcionAusente: false,
  convocados: 0,
  titularidades: 0,
  partidosJugados: 0,
  goles: 0,
  golesPropia: 0,
  amarillas: 0,
  rojas: 0,
  golesPenalti: null,
  ...parcial,
});

const plantilla = [
  fila({ jugadorId: "a", nombre: "Brais Rei", apodo: "Rei", dorsal: 9, goles: 7, convocados: 10 }),
  fila({ jugadorId: "b", nombre: "Álex Núñez", dorsal: 1, goles: 7, convocados: 8 }),
  fila({ jugadorId: "c", nombre: "Xan Novo", dorsal: null, goles: 2, convocados: 0 }),
  fila({ jugadorId: "d", nombre: "Iago Vez", dorsal: 14, goles: 0, inscripcionAusente: true }),
];

describe("filtrarPorTexto", () => {
  it("sin texto devuelve todo", () => {
    expect(filtrarPorTexto(plantilla, "  ")).toHaveLength(4);
  });

  it("no distingue tildes ni mayúsculas", () => {
    expect(filtrarPorTexto(plantilla, "ALEX NUNEZ").map((f) => f.jugadorId)).toEqual(["b"]);
  });

  it("busca también por apodo", () => {
    expect(filtrarPorTexto(plantilla, "rei").map((f) => f.jugadorId)).toEqual(["a"]);
  });
});

describe("ordenarEstadisticas", () => {
  it("ordena por goles de mayor a menor y deshace el empate con el orden de entrada", () => {
    expect(ordenarEstadisticas(plantilla, "goles", true).map((f) => f.jugadorId)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("al revés mantiene el mismo desempate", () => {
    expect(ordenarEstadisticas(plantilla, "goles", false).map((f) => f.jugadorId)).toEqual([
      "d",
      "c",
      "a",
      "b",
    ]);
  });

  it("sin dorsal va al final en los dos sentidos", () => {
    expect(ordenarEstadisticas(plantilla, "dorsal", false).at(-1)?.jugadorId).toBe("c");
    expect(ordenarEstadisticas(plantilla, "dorsal", true).at(-1)?.jugadorId).toBe("c");
  });

  it("por jugador ordena en español", () => {
    expect(ordenarEstadisticas(plantilla, "jugador", false).map((f) => f.jugadorId)).toEqual([
      "b",
      "a",
      "d",
      "c",
    ]);
  });

  it("no toca el array recibido", () => {
    const copia = [...plantilla];
    ordenarEstadisticas(plantilla, "goles", true);
    expect(plantilla).toEqual(copia);
  });
});

describe("totales", () => {
  it("suma lo que hay y cuenta los casos que se avisan", () => {
    expect(totales(plantilla)).toEqual({
      jugadores: 4,
      goles: 16,
      golesPropia: 0,
      amarillas: 0,
      rojas: 0,
      sinConvocatoria: 2,
      sinInscripcion: 1,
    });
  });

  it("sin filas devuelve ceros", () => {
    expect(totales([]).jugadores).toBe(0);
  });

  it("no inventa penaltis", () => {
    expect(Object.keys(totales(plantilla))).not.toContain("golesPenalti");
  });
});

it("nombreVisible prefiere el apodo", () => {
  expect(nombreVisible(plantilla[0]!)).toBe("Rei");
  expect(nombreVisible(plantilla[1]!)).toBe("Álex Núñez");
  expect(nombreVisible(fila({ jugadorId: "x", nombre: "Ana", apodo: "  " }))).toBe("Ana");
});

it("esColumna rechaza lo que no es columna", () => {
  expect(esColumna("goles")).toBe(true);
  expect(esColumna("inventada")).toBe(false);
});
