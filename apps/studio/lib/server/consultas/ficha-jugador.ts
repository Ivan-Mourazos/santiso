import "server-only";
import { schema } from "@santiso/db";
import type { Categoria } from "@santiso/domain";
import { aliasedTable, and, eq, inArray, or } from "drizzle-orm";
import { construirPartidos, type FichaJugador, type PartidoBase } from "@/lib/estadisticas/ficha";
import { urlMedia } from "@/lib/media";
import { obtenerDb } from "@/lib/server/db";

export interface AmbitoFicha {
  jugadorId: string;
  temporadaId: string;
  categoria: Categoria;
  /** Sin ella, todas las competiciones de la categoría esa temporada. */
  competicionId?: string | null;
}

/**
 * La temporada de un jugador partido a partido, en el mismo ámbito que la tabla de
 * estadísticas. `null` si la persona no existe. Solo lee.
 */
export async function fichaDeJugador(ambito: AmbitoFicha): Promise<FichaJugador | null> {
  const { db } = await obtenerDb();
  const [persona] = await db
    .select({
      id: schema.jugadores.id,
      nombre: schema.jugadores.nombre,
      apodo: schema.jugadores.apodo,
    })
    .from(schema.jugadores)
    .where(eq(schema.jugadores.id, ambito.jugadorId));
  if (!persona) return null;
  const [inscripcion] = await db
    .select({
      dorsal: schema.jugadoresTemporada.dorsal,
      posicion: schema.jugadoresTemporada.posicion,
      foto: schema.jugadoresTemporada.foto,
    })
    .from(schema.jugadoresTemporada)
    .where(
      and(
        eq(schema.jugadoresTemporada.jugadorId, ambito.jugadorId),
        eq(schema.jugadoresTemporada.temporadaId, ambito.temporadaId),
        eq(schema.jugadoresTemporada.categoria, ambito.categoria),
      ),
    );

  const local = aliasedTable(schema.equipos, "local");
  const visitante = aliasedTable(schema.equipos, "visitante");
  const filas = await db
    .select({
      partidoId: schema.partidos.id,
      fecha: schema.partidos.fecha,
      competicion: schema.competiciones.nombre,
      jornada: schema.jornadas.numero,
      golesLocal: schema.partidos.golesLocal,
      golesVisitante: schema.partidos.golesVisitante,
      localNombre: local.nombre,
      localEscudo: local.escudo,
      localPropio: local.esPropio,
      visitanteNombre: visitante.nombre,
      visitanteEscudo: visitante.escudo,
      titular: schema.partidoParticipaciones.titular,
      jugo: schema.partidoParticipaciones.jugo,
    })
    .from(schema.partidoParticipaciones)
    .innerJoin(schema.partidos, eq(schema.partidos.id, schema.partidoParticipaciones.partidoId))
    .innerJoin(schema.jornadas, eq(schema.jornadas.id, schema.partidos.jornadaId))
    .innerJoin(schema.competiciones, eq(schema.competiciones.id, schema.jornadas.competicionId))
    .innerJoin(local, eq(local.id, schema.partidos.equipoLocalId))
    .innerJoin(visitante, eq(visitante.id, schema.partidos.equipoVisitanteId))
    .where(
      and(
        eq(schema.partidoParticipaciones.jugadorId, ambito.jugadorId),
        eq(schema.competiciones.temporadaId, ambito.temporadaId),
        eq(schema.competiciones.categoria, ambito.categoria),
        ambito.competicionId ? eq(schema.competiciones.id, ambito.competicionId) : undefined,
      ),
    );

  const partidos: PartidoBase[] = filas.map((f) => {
    const enCasa = f.localPropio;
    const escudoRival = enCasa ? f.visitanteEscudo : f.localEscudo;
    return {
      partidoId: f.partidoId,
      fecha: f.fecha,
      competicion: f.competicion,
      jornada: f.jornada,
      rival: enCasa ? f.visitanteNombre : f.localNombre,
      rivalEscudoUrl: escudoRival ? urlMedia(escudoRival) : null,
      local: enCasa,
      golesSantiso: enCasa ? f.golesLocal : f.golesVisitante,
      golesRival: enCasa ? f.golesVisitante : f.golesLocal,
    };
  });
  const ids = filas.map((f) => f.partidoId);
  const eventos = ids.length
    ? await db
        .select({
          id: schema.partidoEventos.id,
          partidoId: schema.partidoEventos.partidoId,
          jugadorId: schema.partidoEventos.jugadorId,
          jugadorSaleId: schema.partidoEventos.jugadorSaleId,
          tipo: schema.partidoEventos.tipo,
          lado: schema.partidoEventos.lado,
          propia: schema.partidoEventos.propia,
          minuto: schema.partidoEventos.minuto,
        })
        .from(schema.partidoEventos)
        .where(
          and(
            inArray(schema.partidoEventos.partidoId, ids),
            or(
              eq(schema.partidoEventos.jugadorId, ambito.jugadorId),
              eq(schema.partidoEventos.jugadorSaleId, ambito.jugadorId),
            ),
          ),
        )
    : [];

  return {
    jugador: {
      id: persona.id,
      nombre: persona.nombre,
      apodo: persona.apodo,
      dorsal: inscripcion?.dorsal ?? null,
      posicion: inscripcion?.posicion ?? null,
      fotoUrl: inscripcion?.foto ? urlMedia(inscripcion.foto) : null,
    },
    partidos: construirPartidos(
      ambito.jugadorId,
      partidos,
      filas.map((f) => ({
        partidoId: f.partidoId,
        jugadorId: ambito.jugadorId,
        titular: f.titular,
        jugo: f.jugo,
      })),
      eventos,
    ),
  };
}
