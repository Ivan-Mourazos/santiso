import "server-only";
import { schema } from "@santiso/db";
import { normalizarCategoria } from "@santiso/domain";
import { asc, eq, inArray } from "drizzle-orm";
import type { EquipoDto } from "@/lib/dto";
import { urlMedia } from "@/lib/media";
import { obtenerDb } from "@/lib/server/db";

const columnas = {
  id: schema.equipos.id,
  nombre: schema.equipos.nombre,
  categoria: schema.equipos.categoria,
  escudo: schema.equipos.escudo,
  esPropio: schema.equipos.esPropio,
};

const aDto = (fila: {
  id: string;
  nombre: string;
  categoria: string;
  escudo: string | null;
  esPropio: boolean;
}): EquipoDto => ({
  id: fila.id,
  nombre: fila.nombre,
  categoria: fila.categoria,
  escudo_url: fila.escudo ? urlMedia(fila.escudo) : null,
  es_propio: fila.esPropio,
});

/** Equipos inscritos en una competición, por nombre. */
export async function equiposDeCompeticion(competicionId: string): Promise<EquipoDto[]> {
  const { db } = await obtenerDb();
  const filas = await db
    .select(columnas)
    .from(schema.competicionEquipos)
    .innerJoin(schema.equipos, eq(schema.equipos.id, schema.competicionEquipos.equipoId))
    .where(eq(schema.competicionEquipos.competicionId, competicionId))
    .orderBy(asc(schema.equipos.nombre));
  return filas.map(aDto);
}

export async function equiposPorIds(ids: readonly string[]): Promise<EquipoDto[]> {
  const unicos = [...new Set(ids.filter(Boolean))];
  if (unicos.length === 0) return [];
  const { db } = await obtenerDb();
  const filas = await db
    .select(columnas)
    .from(schema.equipos)
    .where(inArray(schema.equipos.id, unicos))
    .orderBy(asc(schema.equipos.nombre));
  return filas.map(aDto);
}

/** Todos los equipos de una categoría, inscritos o no: la «librería» de la pantalla. */
export async function listarEquiposDeCategoria(categoria: string): Promise<EquipoDto[]> {
  const { db } = await obtenerDb();
  const filas = await db
    .select(columnas)
    .from(schema.equipos)
    .where(eq(schema.equipos.categoria, normalizarCategoria(categoria)))
    .orderBy(asc(schema.equipos.nombre));
  return filas.map(aDto);
}
