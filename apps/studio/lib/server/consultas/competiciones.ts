import "server-only";
import { schema } from "@santiso/db";
import {
  type Categoria,
  type ReglaClasificacion,
  reglasClasificacionSchema,
} from "@santiso/domain";
import { and, asc, eq } from "drizzle-orm";
import type { CompeticionDto } from "@/lib/dto";
import { temporadaActivaId } from "@/lib/server/consultas/temporadas";
import { obtenerDb } from "@/lib/server/db";

/**
 * Catálogo de competiciones vigentes: las de la temporada activa.
 * `activa` siempre es `true`; se conserva porque los helpers de `lib/competition.ts` lo leen.
 */
export async function listarCompeticiones(): Promise<CompeticionDto[]> {
  const temporadaId = await temporadaActivaId();
  if (!temporadaId) return [];
  const { db } = await obtenerDb();
  const filas = await db
    .select({
      id: schema.competiciones.id,
      categoria: schema.competiciones.categoria,
      nombre: schema.competiciones.nombre,
      orden: schema.competiciones.orden,
      formato: schema.competiciones.formato,
    })
    .from(schema.competiciones)
    .where(eq(schema.competiciones.temporadaId, temporadaId))
    .orderBy(asc(schema.competiciones.categoria), asc(schema.competiciones.orden));
  return filas.map((f) => ({ ...f, activa: true }));
}

/** Reglas de zona de la clasificación. Un JSON corrupto se trata como «sin reglas», no rompe la UI. */
export async function reglasDeCompeticion(competicionId: string): Promise<ReglaClasificacion[]> {
  const { db } = await obtenerDb();
  const [fila] = await db
    .select({ reglas: schema.competiciones.reglasClasificacion })
    .from(schema.competiciones)
    .where(eq(schema.competiciones.id, competicionId));
  const analizado = reglasClasificacionSchema.safeParse(fila?.reglas ?? []);
  return analizado.success ? analizado.data : [];
}

/**
 * Competiciones de una temporada y categoría concretas. `listarCompeticiones` solo trae las de
 * la temporada activa; las estadísticas se consultan también de temporadas pasadas.
 */
export async function listarCompeticionesDeTemporada(
  temporadaId: string,
  categoria: Categoria,
): Promise<CompeticionDto[]> {
  const { db } = await obtenerDb();
  const filas = await db
    .select({
      id: schema.competiciones.id,
      categoria: schema.competiciones.categoria,
      nombre: schema.competiciones.nombre,
      orden: schema.competiciones.orden,
      formato: schema.competiciones.formato,
    })
    .from(schema.competiciones)
    .where(
      and(
        eq(schema.competiciones.temporadaId, temporadaId),
        eq(schema.competiciones.categoria, categoria),
      ),
    )
    .orderBy(asc(schema.competiciones.orden), asc(schema.competiciones.nombre));
  return filas.map((f) => ({ ...f, activa: true }));
}
