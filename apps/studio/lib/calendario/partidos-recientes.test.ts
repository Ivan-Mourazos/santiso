import { expect, it } from "vitest";
import { partidosRecientes } from "./partidos-recientes";
it("conserva último finalizado y siguientes, incluido un empate a cero", () => {
  const partidos = [
    { id: "1", estado: "finalizado" },
    { id: "2", estado: "finalizado", goles_local: 0, goles_visitante: 0 },
    { id: "3", estado: "programado" },
  ];
  expect(partidosRecientes(partidos)).toEqual({
    anteriores: partidos.slice(0, 1),
    actuales: partidos.slice(1),
  });
  expect(partidos).toHaveLength(3);
});
it("sin resultados muestra todo; un aplazado no es jugado aunque conserve marcador", () => {
  const partidos = [
    { id: "a", estado: "aplazado", goles_local: 0, goles_visitante: 0 },
    { id: "b", estado: "programado" },
  ];
  expect(partidosRecientes(partidos)).toEqual({ anteriores: [], actuales: partidos });
  expect(partidosRecientes([])).toEqual({ anteriores: [], actuales: [] });
});
it("admite marcador sin estado y acaba mostrando último partido al terminar temporada", () => {
  const partidos = [
    { id: "1", goles_local: 2, goles_visitante: 1 },
    { id: "2", goles_local: 0, goles_visitante: 0 },
  ];
  expect(partidosRecientes(partidos)).toEqual({
    anteriores: [partidos[0]],
    actuales: [partidos[1]],
  });
});
