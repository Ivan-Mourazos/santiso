import { describe, expect, it } from "vitest";
import {
  construirPartidos,
  papelEnPartido,
  resultadoDePartido,
  totalesDeFicha,
  type EventoDeFicha,
  type PartidoBase,
} from "./ficha";

const partido = (id: string, fecha: string, extra: Partial<PartidoBase> = {}): PartidoBase => ({
  partidoId: id,
  fecha,
  competicion: "Liga",
  jornada: 1,
  rival: "Rival",
  rivalEscudoUrl: null,
  local: true,
  golesSantiso: 2,
  golesRival: 1,
  ...extra,
});

const evento = (
  id: string,
  partidoId: string,
  tipo: EventoDeFicha["tipo"],
  extra: Partial<EventoDeFicha> = {},
): EventoDeFicha => ({
  id,
  partidoId,
  tipo,
  lado: "propio",
  propia: false,
  jugadorId: "yo",
  jugadorSaleId: null,
  minuto: null,
  ...extra,
});

describe("ficha del jugador", () => {
  const partidos = [
    partido("a", "2026-09-27T18:00"),
    partido("b", "2026-10-04T17:00", { local: false, golesSantiso: 1, golesRival: 3 }),
    partido("c", "2026-10-11T17:00", { golesSantiso: 0, golesRival: 0 }),
    partido("d", "2026-10-18T17:00"),
  ];
  const participaciones = [
    { partidoId: "a", jugadorId: "yo", titular: true, jugo: true },
    { partidoId: "b", jugadorId: "yo", titular: false, jugo: true },
    { partidoId: "c", jugadorId: "yo", titular: false, jugo: false },
    // «d»: no convocado; ese partido no sale en su ficha.
    { partidoId: "d", jugadorId: "otro", titular: true, jugo: true },
  ];
  const eventos = [
    evento("1", "a", "gol", { minuto: 10 }),
    evento("2", "a", "gol", { minuto: 50 }),
    evento("3", "a", "tarjeta_amarilla", { minuto: 60 }),
    evento("4", "a", "cambio", { jugadorId: "otro", jugadorSaleId: "yo", minuto: 75 }),
    evento("5", "b", "cambio", { jugadorId: "yo", jugadorSaleId: "otro", minuto: 60 }),
    evento("6", "b", "tarjeta_roja", { minuto: 88 }),
    // Gol en propia: va al marcador rival y no cuenta como gol suyo.
    evento("7", "b", "gol", { lado: "rival", propia: true, minuto: 70 }),
    // De otro jugador: no es suyo.
    evento("8", "a", "gol", { jugadorId: "otro" }),
  ];
  const ficha = construirPartidos("yo", partidos, participaciones, eventos);

  it("un partido por convocatoria, del más reciente al más antiguo", () => {
    expect(ficha.map((p) => p.partidoId)).toEqual(["c", "b", "a"]);
  });

  it("goles, tarjetas y cambios de cada partido, con las reglas de la tabla", () => {
    const [c, b, a] = ficha;
    expect(a).toMatchObject({ titular: true, goles: 2, amarillas: 1, rojas: 0, sale: 75 });
    expect(b).toMatchObject({ titular: false, goles: 0, golesPropia: 1, rojas: 1, entra: 60 });
    expect(c).toMatchObject({ jugo: false, goles: 0 });
    expect(papelEnPartido(a!)).toBe("Titular (cambio 75')");
    expect(papelEnPartido(b!)).toBe("Suplente (entró 60')");
    expect(papelEnPartido(c!)).toBe("No jugó");
  });

  it("el resultado se cuenta desde el lado del Santiso", () => {
    expect(ficha.map(resultadoDePartido)).toEqual(["E 0-0", "D 1-3", "V 2-1"]);
    expect(resultadoDePartido(partido("x", "", { golesSantiso: null }))).toBe("");
  });

  it("los totales salen de los partidos", () => {
    expect(totalesDeFicha(ficha)).toEqual({
      convocados: 3,
      titularidades: 1,
      jugados: 2,
      goles: 2,
      amarillas: 1,
      rojas: 1,
    });
  });
});
