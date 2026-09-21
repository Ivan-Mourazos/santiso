import { describe, expect, it } from "vitest";
import { repartirPorTemporada } from "./temporadas-plantilla";
import type { JugadorLegado, StaffLegado } from "./tipos";

// Mismo caso que `packages/db/src/migraciones.test.ts`: las dos implementaciones de las reglas
// tienen que dar el mismo reparto.
const temporadas = [
  { id: "t24", nombre: "2024/25", activa: false },
  { id: "t25", nombre: "2025/26", activa: false },
  { id: "t26", nombre: "2026/27", activa: true },
];
const competiciones = temporadas.map((t) => ({
  id: `c-${t.id}`,
  temporadaId: t.id,
  categoria: "Senior" as const,
  nombre: "Liga",
}));
const jornadas = temporadas.map((t) => ({
  id: `j-${t.id}`,
  competicionId: `c-${t.id}`,
  numero: 1,
}));
const partidos = ["t24", "t25"].map((t) => ({
  id: `p-${t}`,
  jornadaId: `j-${t}`,
  equipoLocalId: "e1",
  equipoVisitanteId: "e2",
}));

const jugador = (id: string, dorsal: number): JugadorLegado => ({
  id,
  nombre: id,
  categoria: "Senior",
  dorsal,
  posicion: null,
  capitania: null,
  foto: `jugadores/${id}.webp`,
});

describe("repartirPorTemporada", () => {
  it("aplica las mismas reglas que la migración 0001", () => {
    const staff: StaffLegado[] = [
      {
        id: "mister",
        nombre: "Mister",
        tipo: "tecnico",
        categoria: "Senior",
        cargo: "Entrenador",
        orden: 10,
        foto: null,
      },
    ];
    const resultado = repartirPorTemporada({
      jugadores: [jugador("veterano", 9), jugador("retirado", 4), jugador("fichaje", 17)],
      staff,
      temporadas,
      competiciones,
      jornadas,
      partidos,
      participaciones: [
        { partidoId: "p-t24", jugadorId: "veterano", titular: true, jugo: true },
        { partidoId: "p-t25", jugadorId: "veterano", titular: true, jugo: true },
        { partidoId: "p-t24", jugadorId: "retirado", titular: true, jugo: true },
      ],
    });

    const temporadaDe = Object.fromEntries(
      resultado.jugadoresTemporada.map((i) => [i.jugadorId, i.temporadaId]),
    );
    expect(temporadaDe).toEqual({ veterano: "t25", retirado: "t24", fichaje: "t26" });
    expect(resultado.staffTemporada.map((i) => i.temporadaId)).toEqual(["t25"]);

    // La persona se queda sin los campos que pasan a la inscripción.
    expect(resultado.jugadores[0]).not.toHaveProperty("dorsal");
    expect(resultado.jugadoresTemporada.find((i) => i.jugadorId === "veterano")).toMatchObject({
      dorsal: 9,
      foto: "jugadores/veterano.webp",
    });
    expect(resultado.staff[0]).toEqual({ id: "mister", nombre: "Mister" });
  });
});
