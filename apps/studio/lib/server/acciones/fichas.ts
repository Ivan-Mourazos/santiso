"use server";

import { parsearFichaPdf } from "@santiso/actas";
import { actaDeFicha } from "@/lib/actas/ficha-a-acta";
import type { ParsedActa } from "@/lib/actas/types";
import { exito, fallo, type Resultado } from "@/lib/resultado";

/**
 * La ficha ya trae jornada, equipos, competición y fecha: para un PDF no hace falta llamar a
 * `/api/admin/acta-detect`, que es otra ida a la nube. Viaja junto al acta.
 */
export interface DeteccionFicha {
  jornada: number;
  localTeam: string;
  visitorTeam: string;
  competicion: string;
  fecha: string;
}

export interface FichaLeida {
  acta: ParsedActa;
  deteccion: DeteccionFicha;
}

/** El parser rechaza por encima de esto; se comprueba antes para no leer el fichero en balde. */
const MAXIMO_BYTES = 15 * 1024 * 1024;

/**
 * Lee la ficha federativa en PDF **en local**: sin OCR, sin IA y sin tocar la base de datos.
 * Devuelve un borrador para revisar; el guardado sigue siendo `guardarActa`.
 */
export async function leerFichaPdf(formulario: FormData): Promise<Resultado<FichaLeida>> {
  const fichero = formulario.get("ficha");
  if (!(fichero instanceof File)) return fallo("No se recibió ningún PDF.");
  if (fichero.size === 0) return fallo("El PDF está vacío.");
  if (fichero.size > MAXIMO_BYTES) return fallo("El PDF supera los 15 MiB.");

  const santisoEsLocal = formulario.get("santisoEsLocal") === "1";

  try {
    const ficha = await parsearFichaPdf(new Uint8Array(await fichero.arrayBuffer()));
    return exito({
      acta: actaDeFicha(ficha, santisoEsLocal),
      deteccion: {
        jornada: ficha.jornada,
        localTeam: ficha.local.nombre,
        visitorTeam: ficha.visitante.nombre,
        competicion: ficha.competicion,
        fecha: ficha.fecha,
      },
    });
  } catch (error) {
    // El parser rechaza explícitamente lo que no entiende; su mensaje dice qué pasó.
    const detalle = error instanceof Error ? error.message : "motivo desconocido";
    return fallo(`No se pudo leer la ficha: ${detalle}`);
  }
}
