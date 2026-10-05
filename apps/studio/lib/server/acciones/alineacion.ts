"use server";

import { schema } from "@santiso/db";
import { eq, inArray } from "drizzle-orm";
import {
  errorDeAlineacion,
  type Alineacion,
  type PantallaAlineacion,
} from "@/lib/alineacion/modelo";
import { hoyLocal } from "@/lib/jornada/semana";
import { capturar, fallo, type Resultado } from "@/lib/resultado";
import { pantallaAlineacion } from "@/lib/server/consultas/alineacion";
import { obtenerDb } from "@/lib/server/db";

/** Pantalla de alineación de una categoría; sin partido pedido, el próximo por jugar. */
export async function cargarPantallaAlineacion(
  categoria: string,
  partidoId?: string | null,
): Promise<Resultado<PantallaAlineacion>> {
  return capturar("No se pudo cargar la alineación.", () =>
    pantallaAlineacion(categoria, hoyLocal(), partidoId || null),
  );
}

/**
 * Guarda la alineación anunciada de un partido (sustituye la anterior). No toca el acta ni las
 * estadísticas: es una tabla aparte. Un partido ya finalizado no se cambia.
 */
export async function guardarAlineacion(
  partidoId: string,
  alineacion: Alineacion,
): Promise<Resultado<null>> {
  const error = errorDeAlineacion(alineacion);
  if (error) return fallo(error);

  const { db } = await obtenerDb();
  const partido = await db
    .select({ estado: schema.partidos.estado })
    .from(schema.partidos)
    .where(eq(schema.partidos.id, partidoId))
    .get();
  if (!partido) return fallo("El partido ya no existe.");
  if (partido.estado === "finalizado") {
    return fallo("El partido ya se jugó: su alineación no se cambia.");
  }

  const ids = [...alineacion.titulares, ...alineacion.suplentes];
  if (ids.length > 0) {
    const existentes = await db
      .select({ id: schema.jugadores.id })
      .from(schema.jugadores)
      .where(inArray(schema.jugadores.id, ids));
    if (existentes.length !== ids.length) return fallo("Algún jugador ya no existe.");
  }

  return capturar("No se pudo guardar la alineación.", async () => {
    await db.transaction(async (tx) => {
      await tx
        .delete(schema.partidoAlineaciones)
        .where(eq(schema.partidoAlineaciones.partidoId, partidoId));
      if (ids.length > 0) {
        await tx.insert(schema.partidoAlineaciones).values(
          ids.map((jugadorId, orden) => ({
            partidoId,
            jugadorId,
            titular: alineacion.titulares.includes(jugadorId),
            capitan: alineacion.capitanId === jugadorId,
            orden,
          })),
        );
      }
    });
    return null;
  });
}
