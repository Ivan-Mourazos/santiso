import { describe, expect, it } from "vitest";
import type { GrupoDeArchivo } from "./server/consultas/fichas-rfgf";
import {
  elegirLigaPrincipal,
  ordenarCompeticiones,
  nombreCompeticion,
  esCopa,
} from "./archivo-historico";

function grupo(codGrupo: string, competicion: string, fase = ""): GrupoDeArchivo {
  return {
    codGrupo,
    competicion,
    grupo: fase,
    categoria: "Senior",
    estado: "listo",
    jugadores: 0,
    conCifras: 0,
    archivo: {
      estado: "no_pedido",
      texto: "",
      total: 0,
      listos: 0,
      sinActa: 0,
      pendientes: 0,
      errores: 0,
      pedidoEn: null,
      aviso: "",
    },
    partidos: [],
    clasificacion: null,
  };
}

describe("archivo: trayectoria y orden", () => {
  it("elige última fase aunque siga pendiente y no confunde copa con liga", () => {
    const previa = grupo("99", "TERCERA FUTGAL", "Fase previa");
    const ascenso = grupo("2", "TERCERA FUTGAL", "Fase de ascenso");
    const copa = grupo("100", "Copa do Sar");
    expect(elegirLigaPrincipal([copa, ascenso, previa])).toBe(ascenso);
    expect(nombreCompeticion(ascenso, [previa, ascenso])).toBe("Tercera Futgal · Fase de ascenso");
  });
  it("ordena ligas antes de copas sin modificar entrada y resuelve empates", () => {
    const copa = grupo("3", "Copa do Sar");
    const segunda = grupo("2", "Liga", "Fase 2");
    const primera = grupo("1", "Liga", "Fase 1");
    const entrada = [copa, segunda, primera];
    expect(ordenarCompeticiones(entrada)).toEqual([primera, segunda, copa]);
    expect(entrada).toEqual([copa, segunda, primera]);
    expect(
      ordenarCompeticiones([grupo("10", "Liga"), grupo("2", "Liga")]).map((g) => g.codGrupo),
    ).toEqual(["2", "10"]);
  });
  it("prioriza datos dentro de ligas y copas sin cambiar la fase principal", () => {
    const previa = grupo("1", "Liga", "Fase previa");
    previa.clasificacion = {
      estado: "leido",
      ronda: "",
      filas: [{ equipo: "U.D. Santiso" }],
    } as NonNullable<GrupoDeArchivo["clasificacion"]>;
    const final = grupo("2", "Liga", "Fase de ascenso");
    final.clasificacion = { estado: "sin_datos" } as NonNullable<GrupoDeArchivo["clasificacion"]>;
    const pendiente = grupo("3", "Liga pendiente");
    const copa = grupo("4", "Copa Z");
    copa.clasificacion = { estado: "leido", ronda: "Octavos" } as NonNullable<
      GrupoDeArchivo["clasificacion"]
    >;
    const copaSin = grupo("5", "Copa A");
    copaSin.clasificacion = { estado: "sin_datos" } as NonNullable<GrupoDeArchivo["clasificacion"]>;
    expect(ordenarCompeticiones([copaSin, final, pendiente, copa, previa])).toEqual([
      previa,
      pendiente,
      final,
      copa,
      copaSin,
    ]);
    expect(elegirLigaPrincipal([previa, final])).toBe(final);
  });
  it("admite temporadas sin liga y oculta grupos técnicos aislados", () => {
    expect(elegirLigaPrincipal([])).toBeNull();
    expect(elegirLigaPrincipal([grupo("1", "Copa do Sar")])).toBeNull();
    expect(nombreCompeticion(grupo("1", "TERCERA FUTGAL", "GRUPO 1"), [])).toBe("Tercera Futgal");
  });
  it("reconoce copa por formato aunque su nombre no diga Copa", () => {
    const eliminatoria = grupo("1", "Trofeo local");
    eliminatoria.clasificacion = { formato: "copa" } as NonNullable<
      GrupoDeArchivo["clasificacion"]
    >;
    expect(esCopa(eliminatoria)).toBe(true);
    expect(elegirLigaPrincipal([eliminatoria])).toBeNull();
  });
});
