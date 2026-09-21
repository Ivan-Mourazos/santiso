import "server-only";
import { schema } from "@santiso/db";
import { normalizarCategoria } from "@santiso/domain";
import { aliasedTable, and, asc, desc, eq, sql } from "drizzle-orm";
import type { PartidoActaDto } from "@/lib/dto";
import { temporadaActivaId } from "@/lib/server/consultas/temporadas";
import { obtenerDb } from "@/lib/server/db";

/**
 * Partidos de una categoría con lo que los importadores necesitan mostrar: nombres de los dos
 * equipos, número de jornada y campo. La categoría la determina la competición de la jornada.
 * Solo los de la temporada activa: es el filtro que hacían antes las pantallas en el cliente.
 * Sin `categoria` devuelve las tres, que es lo que necesita el importador en lote.
 */
export async function partidosParaActa(categoria?: string): Promise<PartidoActaDto[]> {
  const temporadaId = await temporadaActivaId();
  if (!temporadaId) return [];
  const filtroCategoria = categoria
    ? eq(schema.competiciones.categoria, normalizarCategoria(categoria))
    : undefined;
  const local = aliasedTable(schema.equipos, "equipo_local");
  const visitante = aliasedTable(schema.equipos, "equipo_visitante");

  const { db } = await obtenerDb();
  const filas = await db
    .select({
      id: schema.partidos.id,
      categoria: schema.competiciones.categoria,
      competicionId: schema.competiciones.id,
      competicionNombre: schema.competiciones.nombre,
      equipoLocalId: schema.partidos.equipoLocalId,
      equipoVisitanteId: schema.partidos.equipoVisitanteId,
      golesLocal: schema.partidos.golesLocal,
      golesVisitante: schema.partidos.golesVisitante,
      estado: schema.partidos.estado,
      fecha: schema.partidos.fecha,
      campoId: schema.partidos.campoId,
      nombreLocal: local.nombre,
      nombreVisitante: visitante.nombre,
      jornadaNumero: schema.jornadas.numero,
      campoNombre: schema.campos.nombre,
      campoPoblacion: schema.campos.poblacion,
    })
    .from(schema.partidos)
    .innerJoin(schema.jornadas, eq(schema.jornadas.id, schema.partidos.jornadaId))
    .innerJoin(schema.competiciones, eq(schema.competiciones.id, schema.jornadas.competicionId))
    .innerJoin(local, eq(local.id, schema.partidos.equipoLocalId))
    .innerJoin(visitante, eq(visitante.id, schema.partidos.equipoVisitanteId))
    .leftJoin(schema.campos, eq(schema.campos.id, schema.partidos.campoId))
    .where(and(eq(schema.competiciones.temporadaId, temporadaId), filtroCategoria))
    .orderBy(desc(schema.partidos.fecha));

  return filas.map((f) => ({
    id: f.id,
    categoria: f.categoria,
    competicion_id: f.competicionId,
    competicion: f.competicionNombre,
    equipo_local_id: f.equipoLocalId,
    equipo_visitante_id: f.equipoVisitanteId,
    goles_local: f.golesLocal,
    goles_visitante: f.golesVisitante,
    estado: f.estado,
    fecha: f.fecha,
    campo_id: f.campoId,
    equipo_local: { nombre: f.nombreLocal },
    equipo_visitante: { nombre: f.nombreVisitante },
    jornada: { numero: f.jornadaNumero, competicion_id: f.competicionId },
    campo: f.campoNombre ? { nombre: f.campoNombre, poblacion: f.campoPoblacion } : null,
  }));
}

/** Eventos de un partido con los nombres ya resueltos, para la cronología del cartel. */
export async function eventosDePartido(partidoId: string) {
  const entra = aliasedTable(schema.jugadores, "jugador_entra");
  const sale = aliasedTable(schema.jugadores, "jugador_sale");

  const { db } = await obtenerDb();
  return db
    .select({
      id: schema.partidoEventos.id,
      tipo: schema.partidoEventos.tipo,
      lado: schema.partidoEventos.lado,
      propia: schema.partidoEventos.propia,
      minuto: schema.partidoEventos.minuto,
      nombreRival: schema.partidoEventos.nombreRival,
      jugadorNombre: entra.nombre,
      jugadorApodo: entra.apodo,
      saleNombre: sale.nombre,
      saleApodo: sale.apodo,
    })
    .from(schema.partidoEventos)
    .leftJoin(entra, eq(entra.id, schema.partidoEventos.jugadorId))
    .leftJoin(sale, eq(sale.id, schema.partidoEventos.jugadorSaleId))
    .where(eq(schema.partidoEventos.partidoId, partidoId))
    .orderBy(asc(schema.partidoEventos.minuto));
}

/**
 * Convocatoria de un partido con dorsal y nombre, para el once del cartel.
 *
 * El dorsal es el de **la temporada y la categoría del partido**, no el de hoy: el cartel de un
 * partido de 2025/26 tiene que salir con los números de 2025/26. Si el jugador jugó en una
 * categoría en la que no estaba inscrito (un sénior que ayuda a los veteranos), se toma su dorsal
 * de cualquier otra inscripción de esa misma temporada.
 */
export async function participacionesDePartido(partidoId: string) {
  const { db } = await obtenerDb();
  const [contexto] = await db
    .select({
      temporadaId: schema.competiciones.temporadaId,
      categoria: schema.competiciones.categoria,
    })
    .from(schema.partidos)
    .innerJoin(schema.jornadas, eq(schema.jornadas.id, schema.partidos.jornadaId))
    .innerJoin(schema.competiciones, eq(schema.competiciones.id, schema.jornadas.competicionId))
    .where(eq(schema.partidos.id, partidoId));
  if (!contexto) return [];

  const enSuCategoria = aliasedTable(schema.jugadoresTemporada, "en_su_categoria");
  // Subconsulta correlacionada con la fila de fuera; va sin alias y no choca con `enSuCategoria`.
  const enOtraCategoria = db
    .select({ dorsal: schema.jugadoresTemporada.dorsal })
    .from(schema.jugadoresTemporada)
    .where(
      and(
        eq(schema.jugadoresTemporada.jugadorId, schema.jugadores.id),
        eq(schema.jugadoresTemporada.temporadaId, contexto.temporadaId),
      ),
    )
    .orderBy(sql`${schema.jugadoresTemporada.dorsal} is null`)
    .limit(1);
  const dorsal = sql<number | null>`coalesce(${enSuCategoria.dorsal}, (${enOtraCategoria}))`;

  return db
    .select({
      titular: schema.partidoParticipaciones.titular,
      jugo: schema.partidoParticipaciones.jugo,
      id: schema.jugadores.id,
      nombre: schema.jugadores.nombre,
      apodo: schema.jugadores.apodo,
      dorsal,
      categoria: sql<string>`${contexto.categoria}`,
    })
    .from(schema.partidoParticipaciones)
    .innerJoin(schema.jugadores, eq(schema.jugadores.id, schema.partidoParticipaciones.jugadorId))
    .leftJoin(
      enSuCategoria,
      and(
        eq(enSuCategoria.jugadorId, schema.jugadores.id),
        eq(enSuCategoria.temporadaId, contexto.temporadaId),
        eq(enSuCategoria.categoria, contexto.categoria),
      ),
    )
    .where(eq(schema.partidoParticipaciones.partidoId, partidoId))
    .orderBy(desc(schema.partidoParticipaciones.titular), sql`${dorsal} is null`, asc(dorsal));
}
