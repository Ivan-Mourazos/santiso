import "server-only";
import { schema } from "@santiso/db";
import { normalizarCategoria } from "@santiso/domain";
import { and, asc, desc, eq, lt, ne, sql } from "drizzle-orm";
import {
  convocatoriaInicial,
  convocatoriaPropuesta,
  type Convocatoria,
  type PantallaConvocatoria,
} from "@/lib/convocatoria/modelo";
import { partidosDelClub, plantilla } from "./alineacion";
import { avisosDelPartido } from "./liga";
import { temporadaActivaId } from "./temporadas";
import { obtenerDb } from "@/lib/server/db";

/** Permite consultar la pantalla antes de que el dueño aplique la migración. Solo lectura. */
export async function tablasConvocatoriaDisponibles(): Promise<boolean> {
  const { db } = await obtenerDb();
  const filas = await db.all<{ name: string }>(
    sql`select name from sqlite_master where type = 'table' and name in ('partido_convocatorias', 'partido_convocados')`,
  );
  return filas.length === 2;
}
export async function convocatoriaDePartido(partidoId: string): Promise<Convocatoria | null> {
  if (!(await tablasConvocatoriaDisponibles())) return null;
  const { db } = await obtenerDb();
  const cabecera = await db
    .select()
    .from(schema.partidoConvocatorias)
    .where(eq(schema.partidoConvocatorias.partidoId, partidoId))
    .get();
  if (!cabecera) return null;
  const filas = await db
    .select({ jugadorId: schema.partidoConvocados.jugadorId })
    .from(schema.partidoConvocados)
    .where(eq(schema.partidoConvocados.partidoId, partidoId))
    .orderBy(asc(schema.partidoConvocados.jugadorId));
  return {
    jugadores: filas.map((f) => f.jugadorId),
    horaQuedada: cabecera.horaQuedada,
    lugarQuedada: cabecera.lugarQuedada,
    equipacion: cabecera.equipacion,
    nota: cabecera.nota,
  };
}
/**
 * La convocatoria guardada más reciente de la categoría antes del partido (por fecha), de la que
 * se heredan la quedada y la equipación. `null` si no hay ninguna.
 */
export async function convocatoriaAnterior(
  temporadaId: string,
  categoria: string,
  partido: { id: string; fecha: string | null },
): Promise<Convocatoria | null> {
  const { db } = await obtenerDb();
  const cabecera = await db
    .select({
      horaQuedada: schema.partidoConvocatorias.horaQuedada,
      lugarQuedada: schema.partidoConvocatorias.lugarQuedada,
      equipacion: schema.partidoConvocatorias.equipacion,
    })
    .from(schema.partidoConvocatorias)
    .innerJoin(schema.partidos, eq(schema.partidos.id, schema.partidoConvocatorias.partidoId))
    .innerJoin(schema.jornadas, eq(schema.jornadas.id, schema.partidos.jornadaId))
    .innerJoin(schema.competiciones, eq(schema.competiciones.id, schema.jornadas.competicionId))
    .where(
      and(
        eq(schema.competiciones.temporadaId, temporadaId),
        eq(schema.competiciones.categoria, normalizarCategoria(categoria)),
        ne(schema.partidos.id, partido.id),
        partido.fecha ? lt(schema.partidos.fecha, partido.fecha) : undefined,
      ),
    )
    .orderBy(desc(schema.partidos.fecha), desc(schema.partidoConvocatorias.actualizadoEn))
    .limit(1)
    .get();
  return cabecera ? { ...cabecera, jugadores: [], nota: "" } : null;
}
export async function pantallaConvocatoria(
  categoria: string,
  hoy: string,
  pedido: string | null,
): Promise<PantallaConvocatoria> {
  const temporada = await temporadaActivaId();
  const disponible = await tablasConvocatoriaDisponibles();
  if (!temporada)
    return {
      partidos: [],
      partidoId: null,
      jugadores: [],
      convocatoria: convocatoriaInicial([]),
      guardada: false,
      migracionPendiente: !disponible,
      avisos: [],
    };
  const [partidos, jugadores] = await Promise.all([
    partidosDelClub(temporada, categoria, hoy, pedido),
    plantilla(temporada, categoria),
  ]);
  const elegido = partidos.find((p) => p.id === pedido) ?? partidos.find((p) => !p.finalizado);
  const guardada = elegido && disponible ? await convocatoriaDePartido(elegido.id) : null;
  const inscritos = new Set(jugadores.map((j) => j.id));
  const avisos = elegido ? await avisosDelPartido(elegido.id, jugadores) : [];
  // Sin guardar: se proponen los 16 primeros sin sancionados y la quedada de la anterior.
  const convocatoria = guardada
    ? { ...guardada, jugadores: guardada.jugadores.filter((id) => inscritos.has(id)) }
    : convocatoriaPropuesta(
        jugadores.map((j) => j.id),
        avisos,
        elegido && disponible ? await convocatoriaAnterior(temporada, categoria, elegido) : null,
      );
  return {
    partidos,
    jugadores,
    partidoId: elegido?.id ?? null,
    convocatoria,
    guardada: Boolean(guardada && guardada.jugadores.length === convocatoria.jugadores.length),
    migracionPendiente: !disponible,
    avisos,
  };
}
