import "server-only";
import { schema } from "@santiso/db";
import { desc, eq } from "drizzle-orm";
import type { TemporadaDto } from "@/lib/dto";
import { obtenerDb } from "@/lib/server/db";

/** Temporadas para el selector: la activa primero, el resto de más reciente a más antigua. */
export async function listarTemporadas(): Promise<TemporadaDto[]> {
  const { db } = await obtenerDb();
  const filas = await db
    .select({
      id: schema.temporadas.id,
      nombre: schema.temporadas.nombre,
      activa: schema.temporadas.activa,
      creadoEn: schema.temporadas.creadoEn,
    })
    .from(schema.temporadas)
    .orderBy(desc(schema.temporadas.activa), desc(schema.temporadas.nombre));
  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    activa: f.activa,
    created_at: f.creadoEn,
  }));
}

/** Id de la temporada vigente, o `null` si todavía no hay ninguna. */
export async function temporadaActivaId(): Promise<string | null> {
  const { db } = await obtenerDb();
  const [fila] = await db
    .select({ id: schema.temporadas.id })
    .from(schema.temporadas)
    .where(eq(schema.temporadas.activa, true));
  return fila?.id ?? null;
}
