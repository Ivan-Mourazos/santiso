import { expect, it } from "vitest";
import { elegirAxenda } from "./seleccion-axenda";
import type { SelectorMatch } from "@/components/admin/cartel/Common";
const partido = (
  id: string,
  fecha: string,
  categoria = "Senior",
  estado = "programado",
): SelectorMatch => ({
  id,
  fecha,
  categoria,
  estado,
  equipo_local: { nombre: "UD Santiso" },
  equipo_visitante: { nombre: "Rival " + id },
  jornada: { numero: 3 },
  competicion: "Liga",
});
it("prepara todos los partidos del fin de semana, incluso dos por categoría; ordena y limita a cuatro", () => {
  const lista = [
    partido("c", "2026-10-18T18:00", "Veteranos"),
    partido("a", "2026-10-17T17:00"),
    partido("b", "2026-10-18T12:00"),
    partido("d", "2026-10-20T20:00", "Veteranos"),
    partido("semana-siguiente", "2026-10-25T12:00"),
    partido("e", "2026-10-21T18:00"),
    partido("jugado", "2026-10-17T12:00", "Senior", "finalizado"),
    partido("sin-fecha", ""),
  ];
  expect(elegirAxenda(lista, new Date(2026, 9, 11)).map((p) => p.partidoId)).toEqual([
    "a",
    "b",
    "c",
    "d",
  ]);
  expect(elegirAxenda([], new Date())).toEqual([]);
});
