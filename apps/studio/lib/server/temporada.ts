import "server-only";
import { schema } from "@santiso/db";
import { desc, eq, lt } from "drizzle-orm";
import { obtenerDb } from "@/lib/server/db";

export interface TemporadaRef {
  id: string;
  nombre: string;
}

/** La temporada activa, o `null` si todavía no se ha creado ninguna. */
export async function temporadaActiva(): Promise<TemporadaRef | null> {
  const { db } = await obtenerDb();
  const [fila] = await db
    .select({ id: schema.temporadas.id, nombre: schema.temporadas.nombre })
    .from(schema.temporadas)
    .where(eq(schema.temporadas.activa, true));
  return fila ?? null;
}

/** La temporada pedida si existe; sin pedir ninguna, la activa. */
export async function resolverTemporada(id?: string | null): Promise<TemporadaRef | null> {
  if (!id) return temporadaActiva();
  const { db } = await obtenerDb();
  const [fila] = await db
    .select({ id: schema.temporadas.id, nombre: schema.temporadas.nombre })
    .from(schema.temporadas)
    .where(eq(schema.temporadas.id, id));
  return fila ?? null;
}

/**
 * La temporada inmediatamente anterior. Se ordena por nombre, que tiene la forma "2025/26" y por
 * tanto ordena bien como texto; es la misma regla que usa la migración 0001.
 */
export async function temporadaAnterior(temporada: TemporadaRef): Promise<TemporadaRef | null> {
  const { db } = await obtenerDb();
  const [fila] = await db
    .select({ id: schema.temporadas.id, nombre: schema.temporadas.nombre })
    .from(schema.temporadas)
    .where(lt(schema.temporadas.nombre, temporada.nombre))
    .orderBy(desc(schema.temporadas.nombre))
    .limit(1);
  return fila ?? null;
}
