import type { Composicion, PeticionCartel } from "./modelo";

/** Un carrusel comparte formato y logos; cada lámina añade el contexto que omite la portada. */
export function paqueteAxenda(
  portada: Extract<PeticionCartel, { plantilla: "proximos" }>,
  composicion: Composicion = "diagonal",
): { nombre: string; peticion: PeticionCartel }[] {
  return [
    { nombre: "axenda-1.png", peticion: portada },
    ...portada.datos.partidos.map((p, i) => ({
      nombre: `axenda-${i + 2}.png`,
      peticion: {
        plantilla: "partido" as const,
        composicion,
        formato: portada.formato,
        datos: {
          ...p,
          competicion: p.competicion ?? "",
          jornada: p.jornada ?? "",
          institucionales: portada.datos.institucionales,
          patrocinadores: portada.datos.patrocinadores,
        },
      },
    })),
  ];
}
