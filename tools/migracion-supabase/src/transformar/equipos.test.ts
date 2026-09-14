import { describe, expect, it } from "vitest";
import { idDeterminista } from "../ids";
import { fabricar, snapshotVacio } from "../test/fabricas";
import { transformarCompeticiones } from "./competiciones";
import { transformarEquipos } from "./equipos";
import { transformarTemporadas } from "./temporadas";
import { crearInforme } from "./tipos";

const BASE = "https://abc.supabase.co/storage/v1/object/public/fotos/";

function preparar(configurar: (ctx: ReturnType<typeof base>) => void) {
  const ctx = base();
  configurar(ctx);
  const informe = crearInforme();
  const temporadas = transformarTemporadas(ctx.origen, informe);
  const { competiciones } = transformarCompeticiones(ctx.origen, temporadas, informe);
  return { ...ctx, informe, resultado: transformarEquipos(ctx.origen, competiciones, informe) };
}

function base() {
  const origen = snapshotVacio();
  const temporada = fabricar.temporada();
  const senior = fabricar.competicion({ categoria: "Senior", nombre: "Tercera" });
  const veteranos = fabricar.competicion({ categoria: "Veteranos", nombre: "Veteranos 1ª" });
  origen.temporadas.push(temporada);
  origen.competiciones.push(senior, veteranos);
  const jornadaSenior = fabricar.jornada({ temporada_id: temporada.id, competicion_id: senior.id });
  const jornadaVeteranos = fabricar.jornada({
    temporada_id: temporada.id,
    competicion_id: veteranos.id,
  });
  origen.jornadas.push(jornadaSenior, jornadaVeteranos);
  return { origen, senior, veteranos, jornadaSenior, jornadaVeteranos };
}

describe("transformarEquipos", () => {
  it("fusiona duplicados por categoría y clave: conserva el más antiguo con el primer escudo", () => {
    const antiguo = fabricar.equipo({
      nombre: "U.D. Santiso F.C.",
      created_at: "2026-04-17T10:00:00+00:00",
    });
    const nuevo = fabricar.equipo({
      nombre: "U.D. SANTISO F.C.",
      escudo_url: `${BASE}escudos/santiso.webp`,
      created_at: "2026-09-12T10:00:00+00:00",
    });
    const rival = fabricar.equipo({ nombre: "C.D. Berres" });

    const { resultado, informe, senior, jornadaSenior } = preparar(
      ({ origen, senior, jornadaSenior }) => {
        origen.equipos.push(nuevo, antiguo, rival);
        origen.equipo_competiciones.push(
          fabricar.equipoCompeticion({ equipo_id: nuevo.id, competicion_id: senior.id }),
          fabricar.equipoCompeticion({ equipo_id: antiguo.id, competicion_id: senior.id }),
          fabricar.equipoCompeticion({ equipo_id: rival.id, competicion_id: senior.id }),
        );
        origen.partidos_liga.push(
          fabricar.partido({
            jornada_id: jornadaSenior.id,
            competicion_id: senior.id,
            equipo_local_id: nuevo.id,
            equipo_visitante_id: rival.id,
          }),
        );
      },
    );

    expect(resultado.equipos).toHaveLength(2);
    expect(resultado.equipos.find((e) => e.id === antiguo.id)).toMatchObject({
      nombre: "U.D. Santiso F.C.",
      clave: "u d santiso f c",
      esPropio: true,
      escudo: "escudos/santiso.webp",
    });
    expect(resultado.resolver(nuevo.id, senior.id)).toBe(antiguo.id);
    expect(resultado.competicionEquipos).toHaveLength(2);
    expect(informe.equiposFusionados).toEqual([
      {
        conservado: antiguo.id,
        eliminados: [nuevo.id],
        nombre: "U.D. Santiso F.C.",
        categoria: "Senior",
      },
    ]);
    expect(jornadaSenior.competicion_id).toBe(senior.id);
  });

  it("no fusiona la misma clave en categorías distintas", () => {
    const { resultado } = preparar(({ origen }) => {
      origen.equipos.push(
        fabricar.equipo({ nombre: "S.D. Touro", categoria: "Senior" }),
        fabricar.equipo({ nombre: "S.D. Touro", categoria: "Veteranos" }),
      );
    });
    expect(resultado.equipos).toHaveLength(2);
  });

  it("separa un equipo usado en una competición de otra categoría", () => {
    const cruces = fabricar.equipo({ nombre: "S.D. CRUCES", categoria: "Senior" });
    const solaina = fabricar.equipo({
      nombre: "U.D. Santiso F.C. Solaina",
      categoria: "Veteranos",
    });

    const { resultado, informe, senior, veteranos } = preparar(
      ({ origen, senior, veteranos, jornadaSenior, jornadaVeteranos }) => {
        const rivalSenior = fabricar.equipo({ nombre: "C.D. Berres" });
        origen.equipos.push(cruces, solaina, rivalSenior);
        origen.equipo_competiciones.push(
          fabricar.equipoCompeticion({ equipo_id: cruces.id, competicion_id: senior.id }),
          fabricar.equipoCompeticion({ equipo_id: cruces.id, competicion_id: veteranos.id }),
          fabricar.equipoCompeticion({ equipo_id: solaina.id, competicion_id: veteranos.id }),
          fabricar.equipoCompeticion({ equipo_id: rivalSenior.id, competicion_id: senior.id }),
        );
        origen.partidos_liga.push(
          fabricar.partido({
            jornada_id: jornadaVeteranos.id,
            competicion_id: veteranos.id,
            equipo_local_id: cruces.id,
            equipo_visitante_id: solaina.id,
          }),
          fabricar.partido({
            jornada_id: jornadaSenior.id,
            competicion_id: senior.id,
            equipo_local_id: cruces.id,
            equipo_visitante_id: rivalSenior.id,
          }),
        );
      },
    );

    const idVeteranos = idDeterminista("equipo", "Veteranos", "s d cruces");
    expect(resultado.resolver(cruces.id, senior.id)).toBe(cruces.id);
    expect(resultado.resolver(cruces.id, veteranos.id)).toBe(idVeteranos);
    expect(resultado.equipos.find((e) => e.id === idVeteranos)).toMatchObject({
      nombre: "S.D. CRUCES",
      categoria: "Veteranos",
    });
    expect(resultado.competicionEquipos).toContainEqual({
      competicionId: veteranos.id,
      equipoId: idVeteranos,
    });
    expect(resultado.competicionEquipos).not.toContainEqual({
      competicionId: veteranos.id,
      equipoId: cruces.id,
    });
    expect(informe.equiposSeparados).toEqual([
      {
        origen: cruces.id,
        nuevo: idVeteranos,
        nombre: "S.D. CRUCES",
        categoria: "Veteranos",
        competicion: "Veteranos 1ª",
      },
    ]);
  });

  it("reutiliza el equipo homónimo que ya existe en la categoría destino", () => {
    const crucesSenior = fabricar.equipo({ nombre: "S.D. Cruces", categoria: "Senior" });
    const crucesVeteranos = fabricar.equipo({ nombre: "S.D. CRUCES", categoria: "Veteranos" });
    const { resultado, informe, veteranos } = preparar(({ origen, veteranos }) => {
      origen.equipos.push(crucesSenior, crucesVeteranos);
      origen.equipo_competiciones.push(
        fabricar.equipoCompeticion({ equipo_id: crucesSenior.id, competicion_id: veteranos.id }),
      );
    });
    expect(resultado.resolver(crucesSenior.id, veteranos.id)).toBe(crucesVeteranos.id);
    expect(informe.equiposSeparados).toEqual([]);
  });

  it("inscribe equipos que juegan sin estar inscritos y guarda la clasificación manual antigua", () => {
    const local = fabricar.equipo({
      nombre: "Local",
      pts: 30,
      pj: 12,
      pg: 9,
      pe: 3,
      gf: 25,
      gc: 10,
    });
    const visitante = fabricar.equipo({ nombre: "Visitante" });
    const { resultado, informe, senior } = preparar(({ origen, senior, jornadaSenior }) => {
      origen.equipos.push(local, visitante);
      origen.partidos_liga.push(
        fabricar.partido({
          jornada_id: jornadaSenior.id,
          competicion_id: senior.id,
          equipo_local_id: local.id,
          equipo_visitante_id: visitante.id,
        }),
      );
    });
    expect(resultado.competicionEquipos).toEqual([
      { competicionId: senior.id, equipoId: local.id },
      { competicionId: senior.id, equipoId: visitante.id },
    ]);
    expect(informe.avisos.filter((a) => a.includes("inscrito"))).toHaveLength(2);
    expect(informe.clasificacionManualAntigua).toEqual([
      {
        equipoId: local.id,
        nombre: "Local",
        categoria: "Senior",
        pts: 30,
        pj: 12,
        pg: 9,
        pe: 3,
        pp: 0,
        gf: 25,
        gc: 10,
      },
    ]);
  });

  it("se detiene ante referencias rotas o equipos sin categoría", () => {
    expect(() =>
      preparar(({ origen, senior }) => {
        origen.equipo_competiciones.push(
          fabricar.equipoCompeticion({ equipo_id: "no-existe", competicion_id: senior.id }),
        );
      }),
    ).toThrow(/equipo inexistente/);

    expect(() =>
      preparar(({ origen }) => {
        origen.equipos.push(fabricar.equipo({ nombre: "Sin categoría", categoria: null }));
      }),
    ).toThrow(/no tiene categoría/);
  });
});
