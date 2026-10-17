"use server";

import { schema } from "@santiso/db";
import { eq } from "drizzle-orm";
import { capturar, fallo, type Resultado } from "@/lib/resultado";
import { soloAdmin } from "@/lib/server/acceso/permisos";
import { pantallaLiga, type PantallaLiga } from "@/lib/server/consultas/liga";
import {
  fichaEquipo,
  partidosDeLiga,
  type FichaEquipo,
  type PartidosDeLiga,
} from "@/lib/server/consultas/partidos-liga";
import { obtenerDb } from "@/lib/server/db";

export async function cargarLiga(competicionId: string): Promise<Resultado<PantallaLiga>> {
  return capturar("No se pudieron cargar los goleadores y las tarjetas.", () =>
    pantallaLiga(competicionId),
  );
}

/** Cuántas amarillas suman un partido de sanción en una competición. Lo fija su reglamento. */
export async function guardarCicloAmarillas(
  competicionId: string,
  ciclo: number,
): Promise<Resultado<null>> {
  const sinPermiso = await soloAdmin();
  if (sinPermiso) return sinPermiso;
  if (!Number.isInteger(ciclo) || ciclo < 2 || ciclo > 20) {
    return fallo("El ciclo de amarillas debe ser un número entre 2 y 20.");
  }
  return capturar("No se pudo guardar el ciclo de amarillas.", async () => {
    const { db } = await obtenerDb();
    await db
      .update(schema.competiciones)
      .set({ amarillasCiclo: ciclo })
      .where(eq(schema.competiciones.id, competicionId));
    return null;
  });
}

/** Los partidos de una jornada de la competición; sin número, la que toca ahora. Solo lee. */
export async function cargarPartidosLiga(
  competicionId: string,
  numero: number | null,
): Promise<Resultado<PartidosDeLiga | null>> {
  return capturar("No se pudieron cargar los partidos.", () =>
    partidosDeLiga(competicionId, numero),
  );
}

/** Resultados, lo que le queda y goleadores de un equipo en la competición. Solo lee. */
export async function cargarFichaEquipo(
  competicionId: string,
  equipoId: string,
): Promise<Resultado<FichaEquipo | null>> {
  return capturar("No se pudo cargar la ficha del equipo.", () =>
    fichaEquipo(competicionId, equipoId),
  );
}
