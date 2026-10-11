import { expect, it } from "vitest";
import { paqueteAxenda } from "./axenda";
import { leerPeticion } from "./esquema";
import { medidasDe, type PeticionCartel } from "./modelo";

const club = { nombre: "UD Santiso", escudo: null, propio: true, color: "#f5c518", relieve: false };
const rival = { ...club, nombre: "C.D. Compañía de María", propio: false, color: "#dc3030" };
const previa = { posicion: 3, racha: ["V", "E", "D"] as ("V" | "E" | "D")[] };
function portada(n: number): Extract<PeticionCartel, { plantilla: "proximos" }> {
  return {
    plantilla: "proximos",
    formato: "historia",
    datos: {
      institucionales: [],
      patrocinadores: [],
      partidos: Array.from({ length: n }, (_, i) => ({
        categoria: i % 2 ? "Veteranos" : "Senior",
        local: club,
        visitante: rival,
        fecha: "2026-10-18",
        hora: "17:00",
        campo: "A Merced",
        localidad: "Santiso",
        competicion: "Liga",
        jornada: "3",
        contexto: { local: previa, visitante: { posicion: 8, racha: [] } },
      })),
    },
  };
}

it("admite una a cuatro bandas y conserva formato, logos y contexto en cada lámina", () => {
  for (const n of [1, 2, 3, 4]) {
    const p = portada(n);
    expect(leerPeticion(p)).not.toBeNull();
    const paquete = paqueteAxenda(p);
    expect(paquete).toHaveLength(n + 1);
    expect(paquete.map((p) => p.nombre)).toEqual(
      Array.from({ length: n + 1 }, (_, i) => `axenda-${i + 1}.png`),
    );
    expect(paquete.every((p) => leerPeticion(p.peticion))).toBe(true);
    expect(paquete[1]?.peticion).toMatchObject({
      plantilla: "partido",
      formato: "historia",
      datos: { localidad: "Santiso", contexto: { local: previa } },
    });
  }
});
it("reutiliza medidas de historia y mantiene publicación por defecto", () => {
  expect(medidasDe("partido", "historia")).toEqual({ ancho: 1080, alto: 1920 });
  expect(medidasDe("proximos", "historia")).toEqual({ ancho: 1080, alto: 1920 });
  expect(medidasDe("partido")).toEqual({ ancho: 1080, alto: 1350 });
  expect(medidasDe("alineacion")).toEqual({ ancho: 1080, alto: 1920 });
});
it("rechaza quinto partido, formato desconocido y rachas inválidas", () => {
  expect(leerPeticion(portada(5))).toBeNull();
  expect(leerPeticion({ ...portada(1), formato: "cuadrado" })).toBeNull();
  const p = paqueteAxenda(portada(1))[1]!.peticion;
  if (p.plantilla !== "partido") throw new Error("lámina");
  expect(
    leerPeticion({
      ...p,
      datos: { ...p.datos, contexto: { local: { posicion: 0, racha: ["X"] }, visitante: previa } },
    }),
  ).toBeNull();
  expect(
    leerPeticion({
      ...p,
      datos: {
        ...p.datos,
        contexto: { local: { posicion: 1, racha: Array(6).fill("V") }, visitante: previa },
      },
    }),
  ).toBeNull();
});
