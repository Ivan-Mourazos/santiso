"use server";

import { schema } from "@santiso/db";
import { asc, desc } from "drizzle-orm";
import { capturar } from "@/lib/resultado";
import { obtenerDb } from "@/lib/server/db";

/** Consultar otra temporada no cambia la temporada activa ni escribe datos. */
export async function cargarContextoStudio() {
  return capturar("No se pudo cargar el contexto de temporadas.", async () => {
    const { db } = await obtenerDb();
    const temporadas = await db
      .select({
        id: schema.temporadas.id,
        nombre: schema.temporadas.nombre,
        activa: schema.temporadas.activa,
      })
      .from(schema.temporadas)
      .orderBy(desc(schema.temporadas.nombre));
    const filas = await db
      .select({
        id: schema.competiciones.id,
        temporadaId: schema.competiciones.temporadaId,
        categoria: schema.competiciones.categoria,
        nombre: schema.competiciones.nombre,
        orden: schema.competiciones.orden,
        formato: schema.competiciones.formato,
      })
      .from(schema.competiciones)
      .orderBy(asc(schema.competiciones.categoria), asc(schema.competiciones.orden));
    return { temporadas, competiciones: filas.map((fila) => ({ ...fila, activa: true })) };
  });
}
