import "server-only";
import { schema } from "@santiso/db";
import { asc, eq, sql } from "drizzle-orm";
import {
  convocatoriaInicial,
  type Convocatoria,
  type PantallaConvocatoria,
} from "@/lib/convocatoria/modelo";
import { partidosDelClub, plantilla } from "./alineacion";
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
    };
  const [partidos, jugadores] = await Promise.all([
    partidosDelClub(temporada, categoria, hoy, pedido),
    plantilla(temporada, categoria),
  ]);
  const elegido = partidos.find((p) => p.id === pedido) ?? partidos.find((p) => !p.finalizado);
  const guardada = elegido && disponible ? await convocatoriaDePartido(elegido.id) : null;
  const inscritos = new Set(jugadores.map((j) => j.id));
  const convocatoria = guardada
    ? { ...guardada, jugadores: guardada.jugadores.filter((id) => inscritos.has(id)) }
    : convocatoriaInicial(jugadores.map((j) => j.id));
  return {
    partidos,
    jugadores,
    partidoId: elegido?.id ?? null,
    convocatoria,
    guardada: Boolean(guardada && guardada.jugadores.length === convocatoria.jugadores.length),
    migracionPendiente: !disponible,
  };
}
