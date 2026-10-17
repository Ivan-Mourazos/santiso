/**
 * Los carteles de cada partido, paso a paso, y los formatos que se guardan de cada uno. Sirve al
 * servidor (qué se renderiza y guarda) y a las pantallas (qué se enseña): un solo catálogo.
 */
import type { FormatoCartel, Plantilla } from "./modelo";

export const PASOS_CARTEL = [
  "partido",
  "convocatoria",
  "once",
  "resultado",
  "cronoloxia",
  "noso11",
] as const;
export type PasoCartel = (typeof PASOS_CARTEL)[number];

/** Plantilla técnica de cada paso y formatos que se generan a la vez al pulsar «Generar». */
export const PASOS: Record<
  PasoCartel,
  { plantilla: Plantilla; formatos: readonly FormatoCartel[]; nombre: string }
> = {
  partido: {
    plantilla: "partido",
    formatos: ["publicacion", "historia"],
    nombre: "Cartel de partido",
  },
  convocatoria: { plantilla: "convocatoria", formatos: ["publicacion"], nombre: "Convocatoria" },
  once: { plantilla: "alineacion", formatos: ["historia"], nombre: "Once inicial" },
  resultado: { plantilla: "resultado", formatos: ["publicacion"], nombre: "Resultado" },
  cronoloxia: { plantilla: "cronoloxia", formatos: ["publicacion"], nombre: "Cronoloxía" },
  noso11: { plantilla: "once", formatos: ["publicacion"], nombre: "O Noso 11" },
};

export const NOMBRE_FORMATO: Record<FormatoCartel, string> = {
  publicacion: "Publicación",
  historia: "Historia",
};

/** Un PNG guardado de un paso, y si los datos con los que se hizo han cambiado desde entonces. */
export interface CartelGuardado {
  formato: FormatoCartel;
  url: string;
  generadoEn: string;
  desactualizado: boolean;
}

/** Cómo está un paso: sin hacer, hecho y al día, o hecho con datos que ya cambiaron. */
export function estadoPaso(guardados: readonly CartelGuardado[] | undefined) {
  if (!guardados?.length) return "pendiente" as const;
  return guardados.some((g) => g.desactualizado) ? ("desactualizado" as const) : ("hecho" as const);
}

/** Qué logos lleva el cartel: los de arriba (federación, Xunta) y los patrocinadores de abajo. */
export interface LogosElegidos {
  institucionales: boolean;
  patrocinadores: boolean;
}

/** La petición sin los logos que se han quitado. Los carteles sin esos logos los omiten. */
export function conLogos<T extends { datos: object }>(peticion: T, logos: LogosElegidos): T {
  const datos = peticion.datos as { institucionales?: string[]; patrocinadores?: string[] };
  return {
    ...peticion,
    datos: {
      ...peticion.datos,
      ...(datos.institucionales && !logos.institucionales ? { institucionales: [] } : {}),
      ...(datos.patrocinadores && !logos.patrocinadores ? { patrocinadores: [] } : {}),
    },
  };
}
