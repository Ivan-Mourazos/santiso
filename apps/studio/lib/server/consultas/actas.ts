import "server-only";
import { schema } from "@santiso/db";
import { normalizarCategoria } from "@santiso/domain";
import { aliasedTable, and, asc, desc, eq, sql } from "drizzle-orm";
import type { PartidoActaDto } from "@/lib/dto";
import { urlMedia } from "@/lib/media";
import { tablasConvocatoriaDisponibles } from "@/lib/server/consultas/convocatoria";
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
      escudoLocal: local.escudo,
      escudoVisitante: visitante.escudo,
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
    // Con escudo: los carteles («Próximos encuentros», «Partido») lo toman de aquí.
    equipo_local: {
      nombre: f.nombreLocal,
      escudo_url: f.escudoLocal ? urlMedia(f.escudoLocal) : null,
    },
    equipo_visitante: {
      nombre: f.nombreVisitante,
      escudo_url: f.escudoVisitante ? urlMedia(f.escudoVisitante) : null,
    },
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

/** Temporada y categoría de un partido, que deciden con qué dorsal sale cada jugador. */
async function contextoDePartido(partidoId: string) {
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
  return contexto ?? null;
}

/**
 * Dorsal de cada jugador en la temporada y la categoría del partido. Si no estaba inscrito en esa
 * categoría (un sénior que ayuda a los veteranos), el de cualquier otra inscripción de ese año.
 * La consulta que lo use une `enSuCategoria` con la condición `union`.
 */
function dorsalDelPartido(
  db: Awaited<ReturnType<typeof obtenerDb>>["db"],
  contexto: NonNullable<Awaited<ReturnType<typeof contextoDePartido>>>,
) {
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
  const union = and(
    eq(enSuCategoria.jugadorId, schema.jugadores.id),
    eq(enSuCategoria.temporadaId, contexto.temporadaId),
    eq(enSuCategoria.categoria, contexto.categoria),
  );
  return { enSuCategoria, dorsal, union };
}

/**
 * Convocatoria de un partido con dorsal y nombre, para el once del cartel.
 *
 * El dorsal es el de **la temporada y la categoría del partido**, no el de hoy: el cartel de un
 * partido de 2025/26 tiene que salir con los números de 2025/26. El acta no dice quién fue el
 * capitán: se toma del once guardado, si lo hay.
 */
export async function participacionesDePartido(partidoId: string) {
  const { db } = await obtenerDb();
  const contexto = await contextoDePartido(partidoId);
  if (!contexto) return [];
  const { enSuCategoria, dorsal, union } = dorsalDelPartido(db, contexto);

  return db
    .select({
      titular: schema.partidoParticipaciones.titular,
      jugo: schema.partidoParticipaciones.jugo,
      capitan: sql<boolean>`coalesce(${schema.partidoAlineaciones.capitan}, 0)`.mapWith(Boolean),
      id: schema.jugadores.id,
      nombre: schema.jugadores.nombre,
      apodo: schema.jugadores.apodo,
      dorsal,
      categoria: sql<string>`${contexto.categoria}`,
    })
    .from(schema.partidoParticipaciones)
    .innerJoin(schema.jugadores, eq(schema.jugadores.id, schema.partidoParticipaciones.jugadorId))
    .leftJoin(enSuCategoria, union)
    .leftJoin(
      schema.partidoAlineaciones,
      and(
        eq(schema.partidoAlineaciones.partidoId, schema.partidoParticipaciones.partidoId),
        eq(schema.partidoAlineaciones.jugadorId, schema.partidoParticipaciones.jugadorId),
      ),
    )
    .where(eq(schema.partidoParticipaciones.partidoId, partidoId))
    .orderBy(desc(schema.partidoParticipaciones.titular), sql`${dorsal} is null`, asc(dorsal));
}

export type JugadorDeActa = Awaited<ReturnType<typeof participacionesDePartido>>[number];

/**
 * Lo previsto antes del acta, con la misma forma que `participacionesDePartido`: el once guardado
 * (titulares y capitán, en su orden) y de suplentes los del once más los convocados que no son
 * titulares. Sin once guardado no hay nada que proponer: los convocados solos no dicen quién sale.
 */
export async function alineacionPrevistaDePartido(partidoId: string): Promise<JugadorDeActa[]> {
  const { db } = await obtenerDb();
  const contexto = await contextoDePartido(partidoId);
  if (!contexto) return [];
  const { enSuCategoria, dorsal, union } = dorsalDelPartido(db, contexto);
  const columnas = {
    id: schema.jugadores.id,
    nombre: schema.jugadores.nombre,
    apodo: schema.jugadores.apodo,
    dorsal,
  };

  const once = await db
    .select({
      ...columnas,
      titular: schema.partidoAlineaciones.titular,
      capitan: schema.partidoAlineaciones.capitan,
    })
    .from(schema.partidoAlineaciones)
    .innerJoin(schema.jugadores, eq(schema.jugadores.id, schema.partidoAlineaciones.jugadorId))
    .leftJoin(enSuCategoria, union)
    .where(eq(schema.partidoAlineaciones.partidoId, partidoId))
    .orderBy(asc(schema.partidoAlineaciones.orden));
  if (!once.some((f) => f.titular)) return [];

  // La convocatoria es de una migración posterior: sin sus tablas, solo el once.
  const convocados = (await tablasConvocatoriaDisponibles())
    ? await db
        .select(columnas)
        .from(schema.partidoConvocados)
        .innerJoin(schema.jugadores, eq(schema.jugadores.id, schema.partidoConvocados.jugadorId))
        .leftJoin(enSuCategoria, union)
        .where(eq(schema.partidoConvocados.partidoId, partidoId))
        .orderBy(sql`${dorsal} is null`, asc(dorsal))
    : [];
  const enElOnce = new Set(once.map((f) => f.id));

  const fila = (f: (typeof convocados)[number], titular: boolean, capitan: boolean) => ({
    ...f,
    titular,
    jugo: titular,
    capitan,
    categoria: contexto.categoria,
  });
  return [
    ...once.filter((f) => f.titular).map((f) => fila(f, true, f.capitan)),
    ...once.filter((f) => !f.titular).map((f) => fila(f, false, false)),
    ...convocados.filter((f) => !enElOnce.has(f.id)).map((f) => fila(f, false, false)),
  ];
}

/** Los jugadores del partido: los del acta o, mientras no la haya, lo previsto. */
export async function jugadoresDePartido(partidoId: string): Promise<JugadorDeActa[]> {
  const acta = await participacionesDePartido(partidoId);
  return acta.length > 0 ? acta : alineacionPrevistaDePartido(partidoId);
}
