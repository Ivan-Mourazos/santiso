import { describe, expect, it } from "vitest";
import type { FilaEvento } from "../snapshot/tipos";
import { fabricar, snapshotVacio } from "../test/fabricas";
import { mapearEvento, transformarActas } from "./actas";
import { crearInforme } from "./tipos";

const P = "partido-1";
const J1 = "jugador-1";
const J2 = "jugador-2";

const casos: [string, Partial<FilaEvento>, Record<string, unknown>][] = [
  [
    "gol propio",
    { tipo: "gol", jugador_id: J1 },
    {
      tipo: "gol",
      lado: "propio",
      propia: false,
      jugadorId: J1,
      jugadorSaleId: null,
      nombreRival: null,
    },
  ],
  [
    "gol en propia de un rival (cuenta para nosotros)",
    { tipo: "gol", nombre_mostrado: "GÓMEZ MEJUTO, HUGO" },
    {
      tipo: "gol",
      lado: "propio",
      propia: true,
      jugadorId: null,
      nombreRival: "GÓMEZ MEJUTO, HUGO",
    },
  ],
  [
    "gol en propia nuestro (cuenta para el rival)",
    { tipo: "gol", es_rival: true, jugador_id: J1, nombre_mostrado: "En propia" },
    { tipo: "gol", lado: "rival", propia: true, jugadorId: J1, nombreRival: null },
  ],
  [
    "gol rival",
    { tipo: "gol", es_rival: true, nombre_mostrado: "PÉREZ, ANA" },
    { tipo: "gol", lado: "rival", propia: false, jugadorId: null, nombreRival: "PÉREZ, ANA" },
  ],
  [
    "tarjeta propia",
    { tipo: "tarjeta_roja", jugador_id: J1 },
    { tipo: "tarjeta_roja", lado: "propio", jugadorId: J1, nombreRival: null },
  ],
  [
    "tarjeta rival",
    { tipo: "tarjeta_amarilla", es_rival: true, nombre_mostrado: "RIVAL, X" },
    { tipo: "tarjeta_amarilla", lado: "rival", jugadorId: null, nombreRival: "RIVAL, X" },
  ],
  [
    "cambio (jugador_id entra, relacionado sale)",
    { tipo: "cambio", jugador_id: J2, jugador_relacionado_id: J1 },
    { tipo: "cambio", lado: "propio", jugadorId: J2, jugadorSaleId: J1 },
  ],
];

describe("mapearEvento", () => {
  it.each(casos)("%s", (_caso, parcial, esperado) => {
    const fila = fabricar.evento({ partido_id: P, minuto: 12, ...parcial });
    expect(mapearEvento(fila)).toMatchObject({
      id: fila.id,
      partidoId: P,
      minuto: 12,
      ...esperado,
    });
  });

  it("convierte el minuto 999 en null y rechaza minutos fuera de rango", () => {
    expect(mapearEvento(fabricar.evento({ jugador_id: J1, minuto: 999 })).minuto).toBeNull();
    expect(() => mapearEvento(fabricar.evento({ jugador_id: J1, minuto: 200 }))).toThrow(
      /fuera de rango/,
    );
  });

  it("rechaza formas no reconocidas", () => {
    expect(() =>
      mapearEvento(fabricar.evento({ tipo: "cambio", es_rival: true, nombre_mostrado: "X" })),
    ).toThrow(/forma no reconocida/);
    expect(() => mapearEvento(fabricar.evento({ tipo: "gol" }))).toThrow(/forma no reconocida/);
    expect(() => mapearEvento(fabricar.evento({ tipo: "penalti", jugador_id: J1 }))).toThrow(
      /forma no reconocida/,
    );
  });
});

describe("transformarActas", () => {
  it("crea participaciones y completa las de jugadores que solo aparecen en eventos", () => {
    const origen = snapshotVacio();
    origen.jugador_partido_stats.push(
      fabricar.estadistica({ partido_id: P, jugador_id: J1, titular: true, jugo: false, goles: 1 }),
      fabricar.estadistica({
        partido_id: P,
        jugador_id: J2,
        titular: false,
        jugo: false,
        goles: 0,
      }),
    );
    origen.partido_eventos_santiso.push(
      fabricar.evento({ partido_id: P, tipo: "gol", jugador_id: J1, minuto: 10 }),
      fabricar.evento({
        partido_id: P,
        tipo: "cambio",
        jugador_id: J2,
        jugador_relacionado_id: J1,
      }),
      fabricar.evento({ partido_id: P, tipo: "tarjeta_amarilla", jugador_id: "jugador-3" }),
    );
    const informe = crearInforme();

    const { partidoParticipaciones, partidoEventos } = transformarActas(origen, informe);

    expect(partidoEventos).toHaveLength(3);
    expect(partidoParticipaciones).toEqual([
      { partidoId: P, jugadorId: J1, titular: true, jugo: true },
      { partidoId: P, jugadorId: J2, titular: false, jugo: true },
      { partidoId: P, jugadorId: "jugador-3", titular: false, jugo: true },
    ]);
    expect(informe.participacionesCreadas).toEqual([{ partidoId: P, jugadorId: "jugador-3" }]);
    expect(informe.avisos).toEqual([
      `Jugador ${J2} marcado como que jugó el partido ${P} por tener eventos.`,
    ]);
  });

  it("se detiene si los goles de la estadística no cuadran con los eventos", () => {
    const origen = snapshotVacio();
    origen.jugador_partido_stats.push(
      fabricar.estadistica({ partido_id: P, jugador_id: J1, titular: true, jugo: true, goles: 2 }),
    );
    origen.partido_eventos_santiso.push(fabricar.evento({ partido_id: P, jugador_id: J1 }));
    expect(() => transformarActas(origen, crearInforme())).toThrow(/estadística 2, eventos 1/);
  });
});
