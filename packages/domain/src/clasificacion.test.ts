import { describe, expect, it } from "vitest";
import { calcularClasificacion, type PartidoClasificacion } from "./clasificacion";

const finalizado = (
  local: string,
  visitante: string,
  golesLocal: number,
  golesVisitante: number,
): PartidoClasificacion => ({
  equipoLocalId: local,
  equipoVisitanteId: visitante,
  golesLocal,
  golesVisitante,
  estado: "finalizado",
});

describe("calcularClasificacion", () => {
  it("incluye a todos los equipos aunque no hayan jugado", () => {
    const tabla = calcularClasificacion(["a", "b"], []);
    expect(tabla).toHaveLength(2);
    expect(tabla[0]).toMatchObject({ puntos: 0, jugados: 0, diferencia: 0 });
  });

  it("da 3 puntos al ganador y 0 al perdedor", () => {
    const tabla = calcularClasificacion(["a", "b"], [finalizado("a", "b", 2, 1)]);
    expect(tabla.find((f) => f.equipoId === "a")).toMatchObject({
      puntos: 3,
      ganados: 1,
      perdidos: 0,
      golesFavor: 2,
      golesContra: 1,
    });
    expect(tabla.find((f) => f.equipoId === "b")).toMatchObject({ puntos: 0, perdidos: 1 });
  });

  it("da 1 punto a cada uno en el empate", () => {
    const tabla = calcularClasificacion(["a", "b"], [finalizado("a", "b", 1, 1)]);
    expect(tabla.every((f) => f.puntos === 1 && f.empatados === 1)).toBe(true);
  });

  it("ignora los partidos que no están finalizados", () => {
    const tabla = calcularClasificacion(
      ["a", "b"],
      [{ ...finalizado("a", "b", 3, 0), estado: "aplazado" }],
    );
    expect(tabla.every((f) => f.jugados === 0)).toBe(true);
  });

  it("ignora los partidos finalizados sin marcador", () => {
    const tabla = calcularClasificacion(
      ["a", "b"],
      [{ ...finalizado("a", "b", 0, 0), golesLocal: null, golesVisitante: null }],
    );
    expect(tabla.every((f) => f.jugados === 0)).toBe(true);
  });

  it("cuenta un 0-0 finalizado como empate, no como partido sin jugar", () => {
    const tabla = calcularClasificacion(["a", "b"], [finalizado("a", "b", 0, 0)]);
    expect(tabla.every((f) => f.jugados === 1 && f.puntos === 1)).toBe(true);
  });

  it("ignora los partidos de equipos que no están en la lista", () => {
    const tabla = calcularClasificacion(["a"], [finalizado("a", "fuera", 1, 0)]);
    expect(tabla).toHaveLength(1);
    expect(tabla[0]).toMatchObject({ jugados: 0, puntos: 0 });
  });

  it("acumula varios partidos del mismo equipo", () => {
    const tabla = calcularClasificacion(
      ["a", "b", "c"],
      [finalizado("a", "b", 2, 0), finalizado("c", "a", 1, 1)],
    );
    expect(tabla.find((f) => f.equipoId === "a")).toMatchObject({
      puntos: 4,
      jugados: 2,
      ganados: 1,
      empatados: 1,
      golesFavor: 3,
      golesContra: 1,
      diferencia: 2,
    });
  });

  it("ordena por puntos, luego diferencia de goles y luego goles a favor", () => {
    // a: 3 pts, DG +1, GF 2 · b: 3 pts, DG +3, GF 3 · c: 3 pts, DG +1, GF 5
    const tabla = calcularClasificacion(
      ["a", "b", "c", "x", "y", "z"],
      [finalizado("a", "x", 2, 1), finalizado("b", "y", 3, 0), finalizado("c", "z", 5, 4)],
    );
    expect(tabla.slice(0, 3).map((f) => f.equipoId)).toEqual(["b", "c", "a"]);
  });

  it("desempata por orden alfabético de id cuando todo lo demás coincide", () => {
    const tabla = calcularClasificacion(["b", "a"], []);
    expect(tabla.map((f) => f.equipoId)).toEqual(["a", "b"]);
  });
});
