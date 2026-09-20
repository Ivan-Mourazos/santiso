import "server-only";
import { schema } from "@santiso/db";
import { asc, eq } from "drizzle-orm";
import type { DescansoDto, JornadaDto, PartidoDto } from "@/lib/dto";
import { obtenerDb } from "@/lib/server/db";

/** Se exportan para que las acciones usen exactamente las mismas columnas en sus `returning`. */
export const COLUMNAS_JORNADA = {
  id: schema.jornadas.id,
  numero: schema.jornadas.numero,
  nombreFase: schema.jornadas.nombreFase,
  fechaInicio: schema.jornadas.fechaInicio,
  fechaFin: schema.jornadas.fechaFin,
  competicionId: schema.jornadas.competicionId,
};

export const COLUMNAS_PARTIDO = {
  id: schema.partidos.id,
  jornadaId: schema.partidos.jornadaId,
  equipoLocalId: schema.partidos.equipoLocalId,
  equipoVisitanteId: schema.partidos.equipoVisitanteId,
  golesLocal: schema.partidos.golesLocal,
  golesVisitante: schema.partidos.golesVisitante,
  estado: schema.partidos.estado,
  fecha: schema.partidos.fecha,
  campoId: schema.partidos.campoId,
};

export const aJornadaDto = (f: {
  id: string;
  numero: number;
  nombreFase: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  competicionId: string;
}): JornadaDto => ({
  id: f.id,
  numero: f.numero,
  nombre_fase: f.nombreFase,
  fecha_inicio: f.fechaInicio,
  fecha_fin: f.fechaFin,
  competicion_id: f.competicionId,
});

export const aPartidoDto = (f: {
  id: string;
  jornadaId: string;
  equipoLocalId: string;
  equipoVisitanteId: string;
  golesLocal: number | null;
  golesVisitante: number | null;
  estado: string;
  fecha: string | null;
  campoId: string | null;
}): PartidoDto => ({
  id: f.id,
  jornada_id: f.jornadaId,
  equipo_local_id: f.equipoLocalId,
  equipo_visitante_id: f.equipoVisitanteId,
  goles_local: f.golesLocal,
  goles_visitante: f.golesVisitante,
  estado: f.estado,
  fecha: f.fecha,
  campo_id: f.campoId,
});

/** Jornadas de una competición, por número. */
export async function listarJornadas(competicionId: string): Promise<JornadaDto[]> {
  const { db } = await obtenerDb();
  const filas = await db
    .select(COLUMNAS_JORNADA)
    .from(schema.jornadas)
    .where(eq(schema.jornadas.competicionId, competicionId))
    .orderBy(asc(schema.jornadas.numero));
  return filas.map(aJornadaDto);
}

/** Partidos de una jornada, por fecha. */
export async function listarPartidos(jornadaId: string): Promise<PartidoDto[]> {
  const { db } = await obtenerDb();
  const filas = await db
    .select(COLUMNAS_PARTIDO)
    .from(schema.partidos)
    .where(eq(schema.partidos.jornadaId, jornadaId))
    .orderBy(asc(schema.partidos.fecha));
  return filas.map(aPartidoDto);
}

/** Todos los partidos de una competición: lo que necesita la clasificación. */
export async function listarPartidosDeCompeticion(competicionId: string): Promise<PartidoDto[]> {
  const { db } = await obtenerDb();
  const filas = await db
    .select(COLUMNAS_PARTIDO)
    .from(schema.partidos)
    .innerJoin(schema.jornadas, eq(schema.jornadas.id, schema.partidos.jornadaId))
    .where(eq(schema.jornadas.competicionId, competicionId))
    .orderBy(asc(schema.partidos.fecha));
  return filas.map(aPartidoDto);
}

export async function listarDescansos(jornadaId: string): Promise<DescansoDto[]> {
  const { db } = await obtenerDb();
  const filas = await db
    .select({
      jornadaId: schema.jornadaDescansos.jornadaId,
      equipoId: schema.jornadaDescansos.equipoId,
    })
    .from(schema.jornadaDescansos)
    .where(eq(schema.jornadaDescansos.jornadaId, jornadaId));
  return filas.map((f) => ({ jornada_id: f.jornadaId, equipo_id: f.equipoId }));
}
