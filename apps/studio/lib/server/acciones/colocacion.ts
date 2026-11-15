"use server";

import { schema } from "@santiso/db";
import { eq, inArray } from "drizzle-orm";
import {
  errorDeColocacion,
  type Colocacion,
  type MomentoColocacion,
} from "@/lib/cartel2/tactica";
import { capturar, fallo, type Resultado } from "@/lib/resultado";
import { colocacionDePartido } from "@/lib/server/consultas/alineacion";
import { obtenerDb } from "@/lib/server/db";

const MOMENTOS: readonly MomentoColocacion[] = ["previa", "final"];

/** La colocación guardada de un partido en ese momento, o `null` si no hay. */
export async function cargarColocacion(
  partidoId: string,
  momento: MomentoColocacion,
): Promise<Resultado<Colocacion | null>> {
  if (!MOMENTOS.includes(momento)) return fallo("Momento desconocido.");
  return capturar("No se pudo cargar la colocación.", () =>
    colocacionDePartido(partidoId, momento),
  );
}

/**
 * Guarda dónde va cada titular en el dibujo táctico (sustituye la anterior del mismo momento).
 * La previa es la del once anunciado y no cambia con el partido jugado; la final (O Noso 11)
 * sí. Ninguna toca la alineación anunciada ni el acta.
 */
export async function guardarColocacion(
  partidoId: string,
  momento: MomentoColocacion,
  colocacion: Colocacion,
): Promise<Resultado<null>> {
  if (!MOMENTOS.includes(momento)) return fallo("Momento desconocido.");
  const error = errorDeColocacion(colocacion);
  if (error) return fallo(error);

  const { db } = await obtenerDb();
  const partido = await db
    .select({ estado: schema.partidos.estado })
    .from(schema.partidos)
    .where(eq(schema.partidos.id, partidoId))
    .get();
  if (!partido) return fallo("El partido ya no existe.");
  if (momento === "previa" && partido.estado === "finalizado")
    return fallo("El partido ya se jugó: su alineación no se cambia.");

  const ids = colocacion.huecos.filter((id): id is string => id !== null);
  if (ids.length > 0) {
    const existentes = await db
      .select({ id: schema.jugadores.id })
      .from(schema.jugadores)
      .where(inArray(schema.jugadores.id, ids));
    if (existentes.length !== ids.length) return fallo("Algún jugador ya no existe.");
  }

  return capturar("No se pudo guardar la colocación.", async () => {
    const fila = { sistema: colocacion.sistema, huecos: [...colocacion.huecos] };
    await db
      .insert(schema.partidoColocaciones)
      .values({ partidoId, momento, ...fila })
      .onConflictDoUpdate({
        target: [schema.partidoColocaciones.partidoId, schema.partidoColocaciones.momento],
        set: fila,
      });
    return null;
  });
}
