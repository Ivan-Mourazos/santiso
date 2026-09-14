import { describe, expect, it } from "vitest";
import { fabricar, snapshotMinimo } from "../test/fabricas";
import { transformar } from "./index";

describe("transformar", () => {
  it("transforma el snapshot mínimo completo sin avisos", () => {
    const { snapshot, ids } = snapshotMinimo();

    const { modelo, informe } = transformar(snapshot);

    expect(
      Object.fromEntries(Object.entries(modelo).map(([tabla, filas]) => [tabla, filas.length])),
    ).toEqual({
      temporadas: 1,
      competiciones: 1,
      competicionAlias: 0,
      equipos: 2,
      competicionEquipos: 2,
      jugadores: 1,
      staff: 1,
      campos: 1,
      jornadas: 1,
      jornadaDescansos: 0,
      partidos: 1,
      partidoParticipaciones: 1,
      partidoEventos: 1,
      patrocinadores: 0,
      ajustes: 2,
    });
    expect(modelo.equipos.find((e) => e.id === ids.santiso)?.esPropio).toBe(true);
    expect(modelo.partidos[0]).toMatchObject({
      golesLocal: 2,
      golesVisitante: 1,
      fecha: "2026-09-27T17:00",
    });
    expect(informe.avisos).toEqual([]);
  });

  it("es determinista", () => {
    const { snapshot } = snapshotMinimo();
    expect(transformar(snapshot)).toEqual(transformar(snapshot));
  });

  it("detecta referencias rotas antes de importar", () => {
    const conJugadorFantasma = snapshotMinimo();
    conJugadorFantasma.snapshot.jugador_partido_stats.push(
      fabricar.estadistica({ partido_id: conJugadorFantasma.ids.partido, jugador_id: "fantasma" }),
    );
    expect(() => transformar(conJugadorFantasma.snapshot)).toThrow(/Referencia rota/);

    const conCampoFantasma = snapshotMinimo();
    conCampoFantasma.snapshot.partidos_liga[0]!.campo_id = "campo-fantasma";
    expect(() => transformar(conCampoFantasma.snapshot)).toThrow(/Referencia rota/);
  });
});
