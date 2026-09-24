"use server";

import type { PantallaClasificacion, PartidoDto } from "@/lib/dto";
import { capturar, type Resultado } from "@/lib/resultado";
import {
  listarPartidosDeCompeticion,
  listarPartidosPropiosDeCompeticion,
} from "@/lib/server/consultas/calendario";
import { clasificacionDeCompeticion } from "@/lib/server/consultas/clasificacion";
import { reglasDeCompeticion } from "@/lib/server/consultas/competiciones";

/** Partidos de una competición para el cliente; `consultas/` lleva `server-only`. */
export async function cargarPartidosDeCompeticion(competicionId: string): Promise<PartidoDto[]> {
  return competicionId ? listarPartidosDeCompeticion(competicionId) : [];
}

/** Los partidos del club en una competición, para la vista «Partidos del Santiso». */
export async function cargarPartidosPropiosDeCompeticion(
  competicionId: string,
): Promise<PartidoDto[]> {
  return competicionId ? listarPartidosPropiosDeCompeticion(competicionId) : [];
}

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
