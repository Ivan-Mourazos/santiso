"use server";

import { schema } from "@santiso/db";
import { eq } from "drizzle-orm";
import { planDeImportacion, type PlanImportacion } from "@/lib/calendario/plan-importacion";
import { capturar, exito, fallo, type Resultado } from "@/lib/resultado";
import { grupoDeEnlace } from "@/lib/rfgf/enlace";
import { soloAdmin } from "@/lib/server/acceso/permisos";
import { obtenerDb } from "@/lib/server/db";
import {
  aplicarPlanCalendario,
  estadoDeCompeticion,
  leerCalendarioFederacion,
  type CalendarioAplicado,
} from "@/lib/server/rfgf/calendario";
import { crearDescargador } from "@/lib/server/rfgf/descargador";

export interface CalendarioLeido {
  competicion: string;
  temporada: string;
  /** Jornadas y cruces que trae el PDF, ya contrastados con la base de datos. */
  plan: PlanImportacion;
}

/** El parser rechaza por encima de esto; se comprueba antes para no leer el fichero en balde. */

/**
 * Lee el calendario oficial en PDF, que el Studio baja de la federación con el enlace guardado
 * de la competición (una sola descarga), y lo contrasta con la base de datos. No escribe nada:
 * devuelve el plan para que se revise antes de aplicarlo.
 */
export async function traerCalendarioRfgf(
  competicionId: string,
): Promise<Resultado<CalendarioLeido>> {
  const sinPermiso = await soloAdmin();
  if (sinPermiso) return sinPermiso;
  if (!competicionId) return fallo("Elige la competición de destino.");
  const { db } = await obtenerDb();
  const [enlazada] = await db
    .select({ enlace: schema.rfgfCompeticiones.enlace })
    .from(schema.rfgfCompeticiones)
    .where(eq(schema.rfgfCompeticiones.competicionId, competicionId));
  const grupo = enlazada ? grupoDeEnlace(enlazada.enlace) : null;
  if (!grupo) {
    return fallo(
      "Esta competición no tiene enlace de la federación. Ponlo en Federación o sube el PDF.",
    );
  }

  let calendario;
  try {
    calendario = await leerCalendarioFederacion(grupo, crearDescargador());
  } catch (error) {
    const detalle = error instanceof Error ? error.message : "motivo desconocido";
    return fallo(`No se pudo traer el calendario de la federación: ${detalle}`);
  }

  return capturar("No se pudo preparar la importación.", async () => ({
    competicion: calendario.competicion,
    temporada: calendario.temporada,
    plan: planDeImportacion(calendario, await estadoDeCompeticion(competicionId)),
  }));
}

/**
 * Crea lo que dice el plan: equipos que falten, sus inscripciones, jornadas y partidos.
 * **Nunca modifica un partido que ya existe**: puede llevar un marcador metido desde un acta.
 */
export async function guardarCalendario(entrada: {
  competicionId: string;
  plan: PlanImportacion;
}): Promise<Resultado<CalendarioAplicado>> {
  const sinPermiso = await soloAdmin();
  if (sinPermiso) return sinPermiso;
  const { competicionId, plan } = entrada;
  if (!competicionId) return fallo("Elige la competición de destino.");
  const { resumen } = plan;
  if (!resumen.equiposNuevos && !resumen.jornadasNuevas && !resumen.crucesNuevos) {
    return exito({ equipos: 0, jornadas: 0, partidos: 0 });
  }
  return capturar("No se pudo guardar el calendario.", () =>
    aplicarPlanCalendario(competicionId, plan),
  );
}
