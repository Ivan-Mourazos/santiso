import "server-only";
import { schema } from "@santiso/db";
import { normalizarCategoria } from "@santiso/domain";
import { aliasedTable, and, asc, eq, or, sql } from "drizzle-orm";
import {
  ALINEACION_VACIA,
  type Alineacion,
  type JugadorAlineacion,
  type PantallaAlineacion,
  type PartidoAlineacion,
} from "@/lib/alineacion/modelo";
import { urlMedia } from "@/lib/media";
import { temporadaActivaId } from "@/lib/server/consultas/temporadas";
import { obtenerDb } from "@/lib/server/db";

/** Cuántos partidos por jugar se ofrecen para elegir. */
const PROXIMOS = 6;

/**
 * Partidos del club en una categoría de la temporada activa: los que quedan por jugar desde
 * `desde` (día `AAAA-MM-DD`), por fecha, más `incluir` aunque ya se haya jugado.
 */
async function partidosDelClub(
  temporadaId: string,
  categoria: string,
  desde: string,
  incluir: string | null,
): Promise<PartidoAlineacion[]> {
  const { db } = await obtenerDb();
  const local = aliasedTable(schema.equipos, "local");
  const visitante = aliasedTable(schema.equipos, "visitante");
  const filas = await db
    .select({
      id: schema.partidos.id,
      competicion: schema.competiciones.nombre,
      jornada: schema.jornadas.numero,
      fecha: schema.partidos.fecha,
      estado: schema.partidos.estado,
      campo: schema.campos.nombre,
      localNombre: local.nombre,
      localEscudo: local.escudo,
      localEscudo3d: local.escudo3d,
      localColor: local.color,
      localPropio: local.esPropio,
      visitanteNombre: visitante.nombre,
      visitanteEscudo: visitante.escudo,
      visitanteEscudo3d: visitante.escudo3d,
      visitanteColor: visitante.color,
    })
    .from(schema.partidos)
    .innerJoin(schema.jornadas, eq(schema.jornadas.id, schema.partidos.jornadaId))
    .innerJoin(schema.competiciones, eq(schema.competiciones.id, schema.jornadas.competicionId))
    .innerJoin(local, eq(local.id, schema.partidos.equipoLocalId))
    .innerJoin(visitante, eq(visitante.id, schema.partidos.equipoVisitanteId))
    .leftJoin(schema.campos, eq(schema.campos.id, schema.partidos.campoId))
    .where(
      and(
        eq(schema.competiciones.temporadaId, temporadaId),
        eq(schema.competiciones.categoria, normalizarCategoria(categoria)),
        or(eq(local.esPropio, true), eq(visitante.esPropio, true)),
      ),
    )
    // Sin fecha, al final: `fecha` es hora de pared en texto y se ordena tal cual.
    .orderBy(sql`${schema.partidos.fecha} is null`, asc(schema.partidos.fecha));

  const escudo = (clave: string | null) => (clave ? urlMedia(clave) : null);
  const todos = filas.map((f): PartidoAlineacion => {
    const santisoLocal = f.localPropio;
    return {
      id: f.id,
      competicion: f.competicion,
      jornada: f.jornada,
      fecha: f.fecha,
      campo: f.campo,
      santisoLocal,
      santiso: santisoLocal
        ? { nombre: f.localNombre, escudoUrl: escudo(f.localEscudo), escudo3d: f.localEscudo3d }
        : {
            nombre: f.visitanteNombre,
            escudoUrl: escudo(f.visitanteEscudo),
            escudo3d: f.visitanteEscudo3d,
          },
      rival: santisoLocal
        ? {
            nombre: f.visitanteNombre,
            escudoUrl: escudo(f.visitanteEscudo),
            escudo3d: f.visitanteEscudo3d,
            color: f.visitanteColor,
          }
        : {
            nombre: f.localNombre,
            escudoUrl: escudo(f.localEscudo),
            escudo3d: f.localEscudo3d,
            color: f.localColor,
          },
      finalizado: f.estado === "finalizado",
    };
  });
  const porJugar = todos
    .filter((p) => !p.finalizado && (p.fecha === null || p.fecha >= desde))
    .slice(0, PROXIMOS);
  const pedido = incluir ? todos.find((p) => p.id === incluir) : undefined;
  return pedido && !porJugar.some((p) => p.id === pedido.id) ? [pedido, ...porJugar] : porJugar;
}

async function plantilla(temporadaId: string, categoria: string): Promise<JugadorAlineacion[]> {
  const { db } = await obtenerDb();
  const filas = await db
    .select({
      id: schema.jugadores.id,
      nombre: schema.jugadores.nombre,
      apodo: schema.jugadores.apodo,
      dorsal: schema.jugadoresTemporada.dorsal,
      foto: schema.jugadoresTemporada.foto,
      capitania: schema.jugadoresTemporada.capitania,
    })
    .from(schema.jugadoresTemporada)
    .innerJoin(schema.jugadores, eq(schema.jugadores.id, schema.jugadoresTemporada.jugadorId))
    .where(
      and(
        eq(schema.jugadoresTemporada.temporadaId, temporadaId),
        eq(schema.jugadoresTemporada.categoria, normalizarCategoria(categoria)),
      ),
    )
    .orderBy(
      sql`${schema.jugadoresTemporada.dorsal} is null`,
      asc(schema.jugadoresTemporada.dorsal),
      asc(schema.jugadores.nombre),
    );
  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    apodo: f.apodo,
    dorsal: f.dorsal,
    fotoUrl: f.foto ? urlMedia(f.foto) : null,
    capitan: f.capitania === 1,
  }));
}

export async function alineacionDePartido(partidoId: string): Promise<Alineacion> {
  const { db } = await obtenerDb();
  const filas = await db
    .select({
      jugadorId: schema.partidoAlineaciones.jugadorId,
      titular: schema.partidoAlineaciones.titular,
      capitan: schema.partidoAlineaciones.capitan,
    })
    .from(schema.partidoAlineaciones)
    .where(eq(schema.partidoAlineaciones.partidoId, partidoId))
    .orderBy(asc(schema.partidoAlineaciones.orden));
  if (filas.length === 0) return ALINEACION_VACIA;
  return {
    titulares: filas.filter((f) => f.titular).map((f) => f.jugadorId),
    suplentes: filas.filter((f) => !f.titular).map((f) => f.jugadorId),
    capitanId: filas.find((f) => f.capitan)?.jugadorId ?? null,
  };
}

/**
 * Todo lo que pinta la pantalla de alineación: próximos partidos de la categoría, el elegido
 * (el pedido o el primero por jugar), la plantilla y lo que ya hubiera guardado.
 */
export async function pantallaAlineacion(
  categoria: string,
  hoy: string,
  partidoPedido: string | null,
): Promise<PantallaAlineacion> {
  const temporadaId = await temporadaActivaId();
  if (!temporadaId) {
    return { partidos: [], partidoId: null, jugadores: [], alineacion: ALINEACION_VACIA };
  }
  const [partidos, jugadores] = await Promise.all([
    partidosDelClub(temporadaId, categoria, hoy, partidoPedido),
    plantilla(temporadaId, categoria),
  ]);
  const elegido =
    partidos.find((p) => p.id === partidoPedido) ?? partidos.find((p) => !p.finalizado) ?? null;
  return {
    partidos,
    partidoId: elegido?.id ?? null,
    jugadores,
    alineacion: elegido ? await alineacionDePartido(elegido.id) : ALINEACION_VACIA,
  };
}
