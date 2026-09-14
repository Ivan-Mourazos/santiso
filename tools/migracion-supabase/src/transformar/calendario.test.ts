import { describe, expect, it } from "vitest";
import type { FilaPartido } from "../snapshot/tipos";
import { fabricar, snapshotVacio } from "../test/fabricas";
import { transformarCalendario } from "./calendario";
import { transformarCompeticiones } from "./competiciones";
import { transformarEquipos } from "./equipos";
import { transformarTemporadas } from "./temporadas";
import { crearInforme } from "./tipos";

function crearContexto() {
  const origen = snapshotVacio();
  const temporada = fabricar.temporada();
  const competicion = fabricar.competicion({ nombre: "Tercera" });
  const local = fabricar.equipo({ nombre: "Local" });
  const visitante = fabricar.equipo({ nombre: "Visitante" });
  const campo = fabricar.campo({ nombre: " A Gándara ", poblacion: "" });
  const jornada = fabricar.jornada({
    temporada_id: temporada.id,
    competicion_id: competicion.id,
    numero: 1,
    fecha_inicio: "2026-09-27T00:00:00+00:00",
    fecha_fin: "2026-09-28",
    nombre_fase: " ",
  });
  origen.temporadas.push(temporada);
  origen.competiciones.push(competicion);
  origen.equipos.push(local, visitante);
  origen.campos_futbol.push(campo);
  origen.jornadas.push(jornada);
  const partido = (parcial: Partial<FilaPartido> = {}) =>
    fabricar.partido({
      jornada_id: jornada.id,
      competicion_id: competicion.id,
      equipo_local_id: local.id,
      equipo_visitante_id: visitante.id,
      ...parcial,
    });
  return { origen, temporada, competicion, local, visitante, campo, jornada, partido };
}

function preparar(configurar: (ctx: ReturnType<typeof crearContexto>) => void = () => {}) {
  const ctx = crearContexto();
  configurar(ctx);
  const informe = crearInforme();
  const temporadas = transformarTemporadas(ctx.origen, informe);
  const { competiciones } = transformarCompeticiones(ctx.origen, temporadas, informe);
  const equipos = transformarEquipos(ctx.origen, competiciones, informe);
  return {
    ...ctx,
    informe,
    resultado: transformarCalendario(ctx.origen, competiciones, equipos, informe),
  };
}

describe("transformarCalendario", () => {
  it("normaliza campos y jornadas", () => {
    const { resultado, campo, competicion } = preparar();
    expect(resultado.campos[0]).toMatchObject({
      id: campo.id,
      nombre: "A Gándara",
      clave: "a gandara",
      poblacion: null,
    });
    expect(resultado.jornadas[0]).toMatchObject({
      competicionId: competicion.id,
      numero: 1,
      nombreFase: null,
      fechaInicio: "2026-09-27",
      fechaFin: "2026-09-28",
    });
  });

  it("conserva marcador y fecha literal de un partido finalizado", () => {
    const { resultado, jornada, local, visitante, campo } = preparar(
      ({ origen, partido, campo }) => {
        origen.partidos_liga.push(
          partido({
            estado: "finalizado",
            goles_local: 2,
            goles_visitante: 1,
            fecha: "2026-09-27T17:00:00+00:00",
            campo_id: campo.id,
          }),
        );
      },
    );
    expect(resultado.partidos[0]).toMatchObject({
      jornadaId: jornada.id,
      equipoLocalId: local.id,
      equipoVisitanteId: visitante.id,
      golesLocal: 2,
      golesVisitante: 1,
      estado: "finalizado",
      fecha: "2026-09-27T17:00",
      campoId: campo.id,
    });
  });

  it("quita el 0-0 por defecto a los partidos sin disputar y lo avisa", () => {
    const { resultado, informe } = preparar(({ origen, partido, local }) => {
      const tercero = fabricar.equipo({ nombre: "Tercero" });
      origen.equipos.push(tercero);
      origen.partidos_liga.push(
        partido({ estado: "programado", goles_local: 0, goles_visitante: 0 }),
        partido({
          estado: "cancelado",
          equipo_local_id: tercero.id,
          equipo_visitante_id: local.id,
        }),
      );
    });
    expect(resultado.partidos.map((p) => [p.golesLocal, p.golesVisitante])).toEqual([
      [null, null],
      [null, null],
    ]);
    expect(informe.avisos).toContain(
      "Partidos sin disputar con marcador 0-0 por defecto: 1. Ahora quedan sin marcador.",
    );
  });

  it("se detiene ante marcadores o estados incoherentes", () => {
    expect(() =>
      preparar(({ origen, partido }) =>
        origen.partidos_liga.push(
          partido({ estado: "programado", goles_local: 2, goles_visitante: 1 }),
        ),
      ),
    ).toThrow(/"programado" pero tiene marcador 2-1/);
    expect(() =>
      preparar(({ origen, partido }) =>
        origen.partidos_liga.push(partido({ estado: "finalizado" })),
      ),
    ).toThrow(/no tiene marcador/);
    expect(() =>
      preparar(({ origen, partido }) =>
        origen.partidos_liga.push(partido({ estado: "suspendido" })),
      ),
    ).toThrow(/estado desconocido/);
    expect(() =>
      preparar(({ origen, partido }) =>
        origen.partidos_liga.push(partido({ estado: "en_juego", goles_local: 1 })),
      ),
    ).toThrow(/marcador incompleto/);
  });

  it("exige que el partido pertenezca a la competición de su jornada", () => {
    expect(() =>
      preparar(({ origen, partido }) =>
        origen.partidos_liga.push(partido({ competicion_id: "otra-competicion" })),
      ),
    ).toThrow(/distinta a la de su jornada/);
  });

  it("detecta jornadas repetidas, categorías distintas y campos duplicados", () => {
    expect(() =>
      preparar(({ origen, temporada, competicion }) =>
        origen.jornadas.push(
          fabricar.jornada({
            temporada_id: temporada.id,
            competicion_id: competicion.id,
            numero: 1,
          }),
        ),
      ),
    ).toThrow(/repetida/);
    expect(() =>
      preparar(({ origen, temporada, competicion }) =>
        origen.jornadas.push(
          fabricar.jornada({
            temporada_id: temporada.id,
            competicion_id: competicion.id,
            numero: 2,
            categoria: "Veteranos",
          }),
        ),
      ),
    ).toThrow(/otra categoría/);
    expect(() =>
      preparar(({ origen }) => origen.campos_futbol.push(fabricar.campo({ nombre: "a gandara" }))),
    ).toThrow(/Campos duplicados/);
  });

  it("deduplica descansos y resuelve el equipo", () => {
    const { resultado, jornada, local } = preparar(({ origen, jornada, local }) => {
      origen.jornada_equipo_descanso.push(
        fabricar.descanso({ jornada_id: jornada.id, equipo_id: local.id }),
        fabricar.descanso({ jornada_id: jornada.id, equipo_id: local.id }),
      );
    });
    expect(resultado.jornadaDescansos).toEqual([{ jornadaId: jornada.id, equipoId: local.id }]);
  });
});
