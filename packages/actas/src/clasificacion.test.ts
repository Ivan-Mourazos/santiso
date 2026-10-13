import { describe, expect, it } from "vitest";

import { parsearClasificacion } from "./clasificacion";

// Texto tal como sale del PDF de la federación (Tercera Futgal, grupo 3, jornada 2).
const TEXTO = `TERCERA FUTGAL, SANTIAGO | GRUPO 3 Temporada 2026-2027
Jornada 2 (04-10-2026)
C.D. COMPAÑÍA DE MARIA 1 - 7 S.D. TOURO
C.D. BERRES 8 - 3 U.D. SANTISO F.C.
Equipos Partidos Goles Últimos Sanción
Puntos J. G. E. P. F. C. Puntos
1 S.D. CRUCES 6 2 2 0 0 11 1 G G 0
3 GUERREROS DEL SOL 4 2 1 1 0 7 3 G E 0
5 C.S.D ARZUA "B" 4 2 1 1 0 4 3 G E 0
5 S.D. BANDEIRA 4 2 1 1 0 4 3 G E 0
12 U.D. SANTISO F.C. 0 2 0 0 2 4 11 P P 0
13 CLUB ARENAL -3 2 0 0 2 1 10 P P 3
(*) Resultado provisional
REAL FEDERACIÓN GALLEGA DE FÚTBOL`;

describe("clasificación oficial de la federación", () => {
  it("lee la tabla y no confunde los resultados de la jornada con filas", () => {
    const tabla = parsearClasificacion(TEXTO);
    expect(tabla).toMatchObject({
      competicion: "TERCERA FUTGAL, SANTIAGO | GRUPO 3",
      jornada: 2,
    });
    expect(tabla.filas).toHaveLength(6);
    expect(tabla.filas[0]).toEqual({
      posicion: 1,
      equipo: "S.D. CRUCES",
      puntos: 6,
      jugados: 2,
      ganados: 2,
      empatados: 0,
      perdidos: 0,
      golesFavor: 11,
      golesContra: 1,
      sancion: 0,
    });
  });

  it("respeta los empates de puesto, las comillas del nombre y los puntos de sanción", () => {
    const { filas } = parsearClasificacion(TEXTO);
    expect(filas.filter((f) => f.posicion === 5).map((f) => f.equipo)).toEqual([
      'C.S.D ARZUA "B"',
      "S.D. BANDEIRA",
    ]);
    expect(filas.at(-1)).toMatchObject({ equipo: "CLUB ARENAL", puntos: -3, sancion: 3 });
  });

  it("antes de jugarse nada, la tabla viene sin racha", () => {
    const sinJugar = `LIGA Temporada 2026-2027
Jornada 1 (27-09-2026)
Equipos Partidos Goles Últimos Sanción
1 EQUIPO UN 0 0 0 0 0 0 0 0
2 EQUIPO DOUS 0 0 0 0 0 0 0 0
REAL FEDERACIÓN`;
    expect(parsearClasificacion(sinJugar).filas).toHaveLength(2);
  });

  it("rechaza un PDF que no es una clasificación", () => {
    expect(() => parsearClasificacion("Jornada 3\nResultados")).toThrow(/no es una clasificación/);
  });
});
