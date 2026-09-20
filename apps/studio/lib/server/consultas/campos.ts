import "server-only";
import { schema } from "@santiso/db";
import { claveNombre } from "@santiso/domain";
import { asc, eq } from "drizzle-orm";
import type { CampoDto } from "@/lib/dto";
import { obtenerDb } from "@/lib/server/db";

export async function listarCampos(): Promise<CampoDto[]> {
  const { db } = await obtenerDb();
  return db
    .select({
      id: schema.campos.id,
      nombre: schema.campos.nombre,
      poblacion: schema.campos.poblacion,
    })
    .from(schema.campos)
    .orderBy(asc(schema.campos.nombre));
}

/** Busca por `clave`, de modo que «A Carballeira» y «a carballeira» son el mismo campo. */
export async function buscarCampoPorNombre(nombre: string): Promise<CampoDto | null> {
  const { db } = await obtenerDb();
  const [fila] = await db
    .select({
      id: schema.campos.id,
      nombre: schema.campos.nombre,
      poblacion: schema.campos.poblacion,
    })
    .from(schema.campos)
    .where(eq(schema.campos.clave, claveNombre(nombre)));
  return fila ?? null;
}
