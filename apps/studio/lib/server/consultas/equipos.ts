import type { EquipoCatalogo } from "@/lib/equipos/modelo";
import "server-only";
import { schema } from "@santiso/db";
import { normalizarCategoria } from "@santiso/domain";
import { asc, desc, countDistinct, eq, inArray, or } from "drizzle-orm";
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

/** Biblioteca completa, inscripciones históricas y partidos en una sola consulta agrupada. */
export async function catalogoEquipos(): Promise<EquipoCatalogo[]> {
  const { db } = await obtenerDb();
  const filas = await db
    .select({
      ...columnas,
      competicionId: schema.competiciones.id,
      competicionNombre: schema.competiciones.nombre,
      temporadaId: schema.temporadas.id,
      temporadaNombre: schema.temporadas.nombre,
      numeroPartidos: countDistinct(schema.partidos.id),
    })
    .from(schema.equipos)
    .leftJoin(schema.competicionEquipos, eq(schema.competicionEquipos.equipoId, schema.equipos.id))
    .leftJoin(
      schema.competiciones,
      eq(schema.competiciones.id, schema.competicionEquipos.competicionId),
    )
    .leftJoin(schema.temporadas, eq(schema.temporadas.id, schema.competiciones.temporadaId))
    .leftJoin(
      schema.partidos,
      or(
        eq(schema.partidos.equipoLocalId, schema.equipos.id),
        eq(schema.partidos.equipoVisitanteId, schema.equipos.id),
      ),
    )
    .groupBy(schema.equipos.id, schema.competiciones.id, schema.temporadas.id)
    .orderBy(
      asc(schema.equipos.nombre),
      asc(schema.equipos.categoria),
      desc(schema.temporadas.nombre),
      asc(schema.competiciones.nombre),
    );
  const equipos = new Map<string, EquipoCatalogo>();
  for (const fila of filas) {
    let equipo = equipos.get(fila.id);
    if (!equipo) {
      equipo = { ...aDto(fila), numeroPartidos: fila.numeroPartidos, competiciones: [] };
      equipos.set(fila.id, equipo);
    }
    // El recuento es global para el equipo en cada grupo; no sumarlo por inscripción.
    if (fila.competicionId && fila.competicionNombre && fila.temporadaId && fila.temporadaNombre) {
      equipo.competiciones.push({
        id: fila.competicionId,
        nombre: fila.competicionNombre,
        temporadaId: fila.temporadaId,
        temporadaNombre: fila.temporadaNombre,
      });
    }
  }
  return [...equipos.values()];
}
