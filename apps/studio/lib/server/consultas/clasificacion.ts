import "server-only";
import { schema } from "@santiso/db";
import { calcularClasificacion, type PartidoClasificacion } from "@santiso/domain";
import { eq } from "drizzle-orm";
import type { FilaClasificacion } from "@/lib/dto";
import { equiposDeCompeticion } from "@/lib/server/consultas/equipos";
import { obtenerDb } from "@/lib/server/db";

/** Tabla de una competición, calculada desde sus partidos finalizados. */
export async function clasificacionDeCompeticion(
  competicionId: string,
): Promise<FilaClasificacion[]> {
  const equipos = await equiposDeCompeticion(competicionId);
  if (equipos.length === 0) return [];

  const { db } = await obtenerDb();
  const partidos: PartidoClasificacion[] = await db
    .select({
      equipoLocalId: schema.partidos.equipoLocalId,
      equipoVisitanteId: schema.partidos.equipoVisitanteId,
      golesLocal: schema.partidos.golesLocal,
      golesVisitante: schema.partidos.golesVisitante,
      estado: schema.partidos.estado,
    })
    .from(schema.partidos)
    .innerJoin(schema.jornadas, eq(schema.jornadas.id, schema.partidos.jornadaId))
    .where(eq(schema.jornadas.competicionId, competicionId));

  const porId = new Map(equipos.map((e) => [e.id, e]));
  return calcularClasificacion(
    equipos.map((e) => e.id),
    partidos,
  ).map((linea) => ({
    ...linea,
    nombre: porId.get(linea.equipoId)?.nombre ?? "",
    escudoUrl: porId.get(linea.equipoId)?.escudo_url ?? null,
  }));
}
