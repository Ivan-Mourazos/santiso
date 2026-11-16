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

/**
 * Plantilla técnica de cada paso y formatos que se generan a la vez al pulsar «Generar».
 * `retirado`: ya no se hace (Cronoloxía es ahora el Resultado, 15/11/2026), pero sus carteles
 * guardados se siguen leyendo.
 */
export const PASOS: Record<
  PasoCartel,
  { plantilla: Plantilla; formatos: readonly FormatoCartel[]; nombre: string; retirado?: true }
> = {
  partido: {
    plantilla: "partido",
    formatos: ["publicacion", "historia"],
    nombre: "Cartel de partido",
  },
  convocatoria: { plantilla: "convocatoria", formatos: ["publicacion"], nombre: "Convocatoria" },
  once: { plantilla: "campo", formatos: ["historia"], nombre: "Once inicial" },
  resultado: { plantilla: "cronoloxia", formatos: ["publicacion"], nombre: "Resultado" },
  cronoloxia: {
    plantilla: "cronoloxia",
    formatos: ["publicacion"],
    nombre: "Cronoloxía",
    retirado: true,
  },
  noso11: { plantilla: "campo", formatos: ["publicacion"], nombre: "O Noso 11" },
};

/** Los pasos que se hacen hoy, sin los retirados. */
export const PASOS_VISIBLES: readonly PasoCartel[] = PASOS_CARTEL.filter((p) => !PASOS[p].retirado);

/** Lo de después del partido: se publica junto, en un carrusel (Resultado y O Noso 11). */
export const PASOS_DESPUES = ["resultado", "noso11"] as const satisfies readonly PasoCartel[];

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

