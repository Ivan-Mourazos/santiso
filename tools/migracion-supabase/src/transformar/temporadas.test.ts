import { describe, expect, it } from "vitest";
import { fabricar, snapshotVacio } from "../test/fabricas";
import { transformarTemporadas } from "./temporadas";
import { crearInforme } from "./tipos";

describe("transformarTemporadas", () => {
  it("normaliza nombres, conserva ids y fechas, y avisa del cambio", () => {
    const origen = snapshotVacio();
    const antigua = fabricar.temporada({
      nombre: "25/26",
      activa: false,
      created_at: "2025-08-01T10:00:00.123456+00:00",
    });
    origen.temporadas.push(antigua, fabricar.temporada({ nombre: "2026/27", activa: true }));
    const informe = crearInforme();

    const temporadas = transformarTemporadas(origen, informe);

    expect(temporadas[0]).toEqual({
      id: antigua.id,
      nombre: "2025/26",
      activa: false,
      creadoEn: "2025-08-01T10:00:00.123Z",
      actualizadoEn: "2025-08-01T10:00:00.123Z",
    });
    expect(informe.avisos).toEqual(['Temporada "25/26" renombrada a "2025/26".']);
  });

  it("exige exactamente una temporada activa", () => {
    const sinActiva = snapshotVacio();
    sinActiva.temporadas.push(fabricar.temporada({ activa: false }));
    expect(() => transformarTemporadas(sinActiva, crearInforme())).toThrow(/exactamente una/);

    const dosActivas = snapshotVacio();
    dosActivas.temporadas.push(
      fabricar.temporada({ nombre: "2025/26" }),
      fabricar.temporada({ nombre: "2026/27" }),
    );
    expect(() => transformarTemporadas(dosActivas, crearInforme())).toThrow(/exactamente una/);
  });
});
