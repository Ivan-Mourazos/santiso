import { describe, expect, it } from "vitest";
import { fabricar, snapshotVacio } from "../test/fabricas";
import { transformarCompeticiones } from "./competiciones";
import { transformarTemporadas } from "./temporadas";
import { crearInforme } from "./tipos";

function escenario() {
  const origen = snapshotVacio();
  const antigua = fabricar.temporada({ nombre: "2025/26", activa: false });
  const actual = fabricar.temporada({ nombre: "2026/27", activa: true });
  origen.temporadas.push(antigua, actual);
  return { origen, antigua, actual };
}

describe("transformarCompeticiones", () => {
  it("toma la temporada de sus jornadas y normaliza formato y reglas", () => {
    const { origen, antigua } = escenario();
    const competicion = fabricar.competicion({ activa: false, formato: null });
    origen.competiciones.push(competicion);
    origen.jornadas.push(
      fabricar.jornada({ competicion_id: competicion.id, temporada_id: antigua.id }),
    );
    const reglas = [{ id: "r1", nombre: "Ascenso", puestos: [1], color: "#10b981" }];
    origen.reglas_liga.push(
      fabricar.reglas({ competicion_id: competicion.id, temporada_id: antigua.id, reglas }),
    );
    const informe = crearInforme();

    const { competiciones } = transformarCompeticiones(
      origen,
      transformarTemporadas(origen, informe),
      informe,
    );

    expect(competiciones[0]).toMatchObject({
      id: competicion.id,
      temporadaId: antigua.id,
      categoria: "Senior",
      formato: "liga",
      reglasClasificacion: reglas,
    });
  });

  it("asigna competiciones sin jornadas: activa → temporada activa; inactiva → última inactiva", () => {
    const { origen, antigua, actual } = escenario();
    const vigente = fabricar.competicion({ activa: true, nombre: "Liga nueva" });
    const vieja = fabricar.competicion({ activa: false, nombre: "Copa vieja" });
    origen.competiciones.push(vigente, vieja);
    const informe = crearInforme();

    const { competiciones } = transformarCompeticiones(
      origen,
      transformarTemporadas(origen, informe),
      informe,
    );

    expect(competiciones.find((c) => c.id === vigente.id)?.temporadaId).toBe(actual.id);
    expect(competiciones.find((c) => c.id === vieja.id)?.temporadaId).toBe(antigua.id);
    expect(informe.avisos).toContain(
      'Competición sin jornadas "Copa vieja" asignada a la temporada 2025/26.',
    );
  });

  it("se detiene si una competición abarca varias temporadas o sus reglas son de otra", () => {
    const { origen, antigua, actual } = escenario();
    const competicion = fabricar.competicion();
    origen.competiciones.push(competicion);
    origen.jornadas.push(
      fabricar.jornada({ competicion_id: competicion.id, temporada_id: antigua.id, numero: 1 }),
      fabricar.jornada({ competicion_id: competicion.id, temporada_id: actual.id, numero: 2 }),
    );
    const informe = crearInforme();
    const temporadas = transformarTemporadas(origen, informe);
    expect(() => transformarCompeticiones(origen, temporadas, informe)).toThrow(/2 temporadas/);

    origen.jornadas.pop();
    origen.reglas_liga.push(
      fabricar.reglas({ competicion_id: competicion.id, temporada_id: actual.id }),
    );
    expect(() => transformarCompeticiones(origen, temporadas, informe)).toThrow(/otra temporada/);
  });

  it("deduplica alias por clave normalizada", () => {
    const { origen, actual } = escenario();
    const competicion = fabricar.competicion({ activa: true });
    origen.competiciones.push(competicion);
    origen.competicion_etiquetas.push(
      fabricar.etiqueta({ competicion_id: competicion.id, etiqueta: "División de Honor" }),
      fabricar.etiqueta({ competicion_id: competicion.id, etiqueta: "Division de Honor " }),
      fabricar.etiqueta({ competicion_id: competicion.id, etiqueta: "Liga principal" }),
    );
    const informe = crearInforme();

    const { competicionAlias } = transformarCompeticiones(
      origen,
      transformarTemporadas(origen, informe),
      informe,
    );

    expect(competicionAlias).toEqual([
      { competicionId: competicion.id, alias: "División de Honor", clave: "division de honor" },
      { competicionId: competicion.id, alias: "Liga principal", clave: "liga principal" },
    ]);
    expect(actual.activa).toBe(true);
  });
});
