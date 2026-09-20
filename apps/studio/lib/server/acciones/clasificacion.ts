"use server";

import type { PantallaClasificacion } from "@/lib/dto";
import { capturar, type Resultado } from "@/lib/resultado";
import { clasificacionDeCompeticion } from "@/lib/server/consultas/clasificacion";
import { reglasDeCompeticion } from "@/lib/server/consultas/competiciones";

/**
 * Todo lo que pinta la pantalla de clasificación, en una sola acción: Next despacha las acciones
 * del cliente de una en una, así que dos llamadas serían dos viajes en serie.
 */
export async function cargarPantallaClasificacion(
  competicionId: string,
): Promise<Resultado<PantallaClasificacion>> {
  return capturar("No se pudo cargar la clasificación.", async () => {
    const [filas, reglas] = await Promise.all([
      clasificacionDeCompeticion(competicionId),
      reglasDeCompeticion(competicionId),
    ]);
    return { filas, reglas };
  });
}
