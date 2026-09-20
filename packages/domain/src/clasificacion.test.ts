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

/** Posición de un equipo en la tabla; falla si no está. */
const posicionDe = (tabla: { equipoId: string }[], equipoId: string) => {
  const indice = tabla.findIndex((f) => f.equipoId === equipoId);
  if (indice < 0) throw new Error(`el equipo ${equipoId} no está en la tabla`);
  return indice;
};

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

  it("con los mismos puntos, gana quien ganó el enfrentamiento directo", () => {
    // a y b acaban empatados a 3 puntos, a diferencia y a goles a favor. Solo los separa que
    // b le ganó a a; sin ese criterio, el desempate por id pondría primero a "a".
    const tabla = calcularClasificacion(
      ["a", "b", "x", "y"],
      [finalizado("b", "a", 1, 0), finalizado("a", "x", 2, 1), finalizado("y", "b", 2, 1)],
    );
    expect(posicionDe(tabla, "b")).toBeLessThan(posicionDe(tabla, "a"));
  });

  it("el enfrentamiento directo manda sobre la diferencia de goles", () => {
    // a empata a puntos con b y tiene mucha mejor diferencia (+5 frente a 0), pero b le ganó.
    const tabla = calcularClasificacion(
      ["a", "b", "x", "y"],
      [finalizado("b", "a", 1, 0), finalizado("a", "x", 6, 0), finalizado("y", "b", 2, 1)],
    );
    expect(posicionDe(tabla, "b")).toBeLessThan(posicionDe(tabla, "a"));
  });

  it("si el directo queda empatado, decide la diferencia de goles", () => {
    const tabla = calcularClasificacion(
      ["a", "b", "x", "y"],
      [finalizado("a", "b", 1, 1), finalizado("a", "x", 5, 0), finalizado("b", "y", 1, 0)],
    );
    expect(posicionDe(tabla, "a")).toBeLessThan(posicionDe(tabla, "b"));
  });

  it("resuelve un empate a tres con la mini-liga entre ellos", () => {
    // a, b y c empatan a 6 puntos en la general. Entre ellos: a gana a b, b gana a c y c gana
    // a a, así que los tres suman 3 puntos en la mini-liga y decide su diferencia interna:
    // a +2 (3-1 y 0-1), b -1 (1-3 y 2-1), c -1 (1-2 y 1-0)... el orden lo fija esa diferencia.
    const tabla = calcularClasificacion(
      ["a", "b", "c", "x"],
      [
        finalizado("a", "b", 3, 1),
        finalizado("b", "c", 2, 1),
        finalizado("c", "a", 1, 0),
        finalizado("a", "x", 1, 0),
        finalizado("b", "x", 1, 0),
        finalizado("c", "x", 1, 0),
      ],
    );
    const tres = tabla.filter((f) => ["a", "b", "c"].includes(f.equipoId));
    expect(tres.every((f) => f.puntos === 6)).toBe(true);
    // a es el único con diferencia positiva en la mini-liga, así que va primero de los tres.
    expect(tres[0]?.equipoId).toBe("a");
  });

  it("no aplica el directo cuando los puntos difieren", () => {
    // b le ganó a a, pero a tiene el doble de puntos: el directo no entra.
    const tabla = calcularClasificacion(
      ["a", "b", "x", "y"],
      [finalizado("b", "a", 1, 0), finalizado("a", "x", 1, 0), finalizado("a", "y", 1, 0)],
    );
    expect(tabla[0]?.equipoId).toBe("a");
  });
});
