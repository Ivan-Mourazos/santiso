import "server-only";
import { schema } from "@santiso/db";
import { CATEGORIAS, type Categoria } from "@santiso/domain";
import { aliasedTable, and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { momentoLocal, trasPartido } from "@/lib/jornada/vestiario";
import { semanaDe, type Semana } from "@/lib/jornada/semana";
import { urlMedia } from "@/lib/media";
import { clasificacionDeCompeticion } from "@/lib/server/consultas/clasificacion";
import { temporadaActivaId } from "@/lib/server/consultas/temporadas";
import { obtenerDb } from "@/lib/server/db";

export interface ActaDeLaSemana {
  convocados: number;
  goleadores: { nombre: string; goles: number }[];
  /** Goles en propia del rival: cuentan para el Santiso pero no tienen goleador propio. */
  golesPropiaRival: number;
  amarillas: number;
  rojas: number;
}

export interface PartidoDeLaSemana {
  id: string;
  competicionId: string;
  competicion: string;
  jornadaId: string;
  jornadaNumero: number;
  fecha: string | null;
  estado: string;
  santisoLocal: boolean;
  santiso: string;
  santisoEscudoUrl: string | null;
  rival: { nombre: string; escudoUrl: string | null };
  golesSantiso: number | null;
  golesRival: number | null;
  campo: string | null;
  preparacion: { convocatoria: number | null; titulares: number; capitan: boolean };
  /** `null` = todavía sin acta guardada. */
  acta: ActaDeLaSemana | null;
  /** Solo en competiciones de liga y si el Santiso está en la tabla. */
  clasificacion: { posicion: number; puntos: number; jugados: number; equipos: number } | null;
}

export interface PantallaJornada {
  semana: Semana;
  momento: string;
  categorias: {
    categoria: Categoria;
    partidos: PartidoDeLaSemana[];
    proximo: PartidoDeLaSemana | null;
    ultimo: PartidoDeLaSemana | null;
  }[];
}

/** Nombre corto: el apodo si lo hay; si no, nombre y primer apellido. */
function nombreCorto(nombre: string | null, apodo: string | null) {
  if (apodo?.trim()) return apodo.trim();
  const partes = (nombre ?? "").trim().split(/\s+/);
  return partes.length > 1 ? `${partes[0]} ${partes[1]}` : (nombre ?? "");
}

/**
 * Los partidos del club en la semana del día pedido, por categoría, con el estado de su acta y
 * la posición del Santiso en la clasificación. Solo la temporada activa. No escribe nada.
 */
export async function pantallaJornada(
  dia: string,
  momento = momentoLocal(),
): Promise<PantallaJornada> {
  const semana = semanaDe(dia);
  const temporadaId = await temporadaActivaId();
  if (!temporadaId) return { semana, momento, categorias: [] };
  const { db } = await obtenerDb();

  const categoriasConCompeticion = await db
    .selectDistinct({ categoria: schema.competiciones.categoria })
    .from(schema.competiciones)
    .where(eq(schema.competiciones.temporadaId, temporadaId));
  const orden = new Map(CATEGORIAS.map((c, i) => [c, i]));
  const categorias = categoriasConCompeticion
    .map((c) => c.categoria)
    .sort((a, b) => (orden.get(a) ?? 9) - (orden.get(b) ?? 9));

  const local = aliasedTable(schema.equipos, "local");
  const visitante = aliasedTable(schema.equipos, "visitante");
  const filas = await db
    .select({
      id: schema.partidos.id,
      categoria: schema.competiciones.categoria,
      competicionId: schema.competiciones.id,
      competicion: schema.competiciones.nombre,
      formato: schema.competiciones.formato,
      jornadaId: schema.jornadas.id,
      jornadaNumero: schema.jornadas.numero,
      fecha: schema.partidos.fecha,
      estado: schema.partidos.estado,
      golesLocal: schema.partidos.golesLocal,
      golesVisitante: schema.partidos.golesVisitante,
      localId: local.id,
      localNombre: local.nombre,
      localEscudo: local.escudo,
      localPropio: local.esPropio,
      visitanteId: visitante.id,
      visitanteNombre: visitante.nombre,
      visitanteEscudo: visitante.escudo,
      visitantePropio: visitante.esPropio,
      campo: schema.campos.nombre,
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
        or(eq(local.esPropio, true), eq(visitante.esPropio, true)),
      ),
    )
    .orderBy(asc(schema.partidos.fecha));

  const ids = filas.map((f) => f.id);
  const [previas, seleccionados, alineaciones] = ids.length
    ? await Promise.all([
        db
          .select({ partidoId: schema.partidoConvocatorias.partidoId })
          .from(schema.partidoConvocatorias)
          .where(inArray(schema.partidoConvocatorias.partidoId, ids)),
        db
          .select({ partidoId: schema.partidoConvocados.partidoId, n: sql<number>`count(*)` })
          .from(schema.partidoConvocados)
          .where(inArray(schema.partidoConvocados.partidoId, ids))
          .groupBy(schema.partidoConvocados.partidoId),
        db
          .select({
            partidoId: schema.partidoAlineaciones.partidoId,
            titular: schema.partidoAlineaciones.titular,
            capitan: schema.partidoAlineaciones.capitan,
          })
          .from(schema.partidoAlineaciones)
          .where(inArray(schema.partidoAlineaciones.partidoId, ids)),
      ])
    : [[], [], []];
  const previasPor = new Set(previas.map((p) => p.partidoId));
  const seleccionadosPor = new Map(seleccionados.map((p) => [p.partidoId, Number(p.n)]));
  const convocatorias = ids.length
    ? await db
        .select({
          partidoId: schema.partidoParticipaciones.partidoId,
          n: sql<number>`count(*)`,
        })
        .from(schema.partidoParticipaciones)
        .where(inArray(schema.partidoParticipaciones.partidoId, ids))
        .groupBy(schema.partidoParticipaciones.partidoId)
    : [];
  const eventos = ids.length
    ? await db
        .select({
          partidoId: schema.partidoEventos.partidoId,
          tipo: schema.partidoEventos.tipo,
          lado: schema.partidoEventos.lado,
          propia: schema.partidoEventos.propia,
          nombre: schema.jugadores.nombre,
          apodo: schema.jugadores.apodo,
        })
        .from(schema.partidoEventos)
        .leftJoin(schema.jugadores, eq(schema.jugadores.id, schema.partidoEventos.jugadorId))
        .where(inArray(schema.partidoEventos.partidoId, ids))
        .orderBy(asc(schema.partidoEventos.minuto))
    : [];
  const convocadosPor = new Map(convocatorias.map((c) => [c.partidoId, Number(c.n)]));

  // Mismas reglas que las estadísticas (7A): gol propio = lado propio sin «propia»; gol en
  // propia del rival = lado propio con «propia»; tarjetas, solo las del lado propio.
  const actaDe = (partidoId: string): ActaDeLaSemana | null => {
    const convocados = convocadosPor.get(partidoId) ?? 0;
    if (convocados === 0) return null;
    const goles = new Map<string, number>();
    let golesPropiaRival = 0;
    let amarillas = 0;
    let rojas = 0;
    for (const e of eventos) {
      if (e.partidoId !== partidoId || e.lado !== "propio") continue;
      if (e.tipo === "gol") {
        if (e.propia) golesPropiaRival++;
        else if (e.nombre) {
          const nombre = nombreCorto(e.nombre, e.apodo);
          goles.set(nombre, (goles.get(nombre) ?? 0) + 1);
        }
      } else if (e.tipo === "tarjeta_amarilla") amarillas++;
      else if (e.tipo === "tarjeta_roja") rojas++;
    }
    return {
      convocados,
      goleadores: [...goles.entries()]
        .map(([nombre, n]) => ({ nombre, goles: n }))
        .sort((a, b) => b.goles - a.goles || a.nombre.localeCompare(b.nombre, "es")),
      golesPropiaRival,
      amarillas,
      rojas,
    };
  };

  // Una clasificación por competición de liga, aunque tenga dos partidos esa semana.
  const tablas = new Map<string, Awaited<ReturnType<typeof clasificacionDeCompeticion>>>();
  for (const f of filas) {
    if (f.formato === "liga" && !tablas.has(f.competicionId)) {
      tablas.set(f.competicionId, await clasificacionDeCompeticion(f.competicionId));
    }
  }

  const partidos = filas.map((f) => {
    const santisoLocal = Boolean(f.localPropio);
    const tabla = tablas.get(f.competicionId);
    const idSantiso = santisoLocal ? f.localId : f.visitanteId;
    const indice = tabla ? tabla.findIndex((fila) => fila.equipoId === idSantiso) : -1;
    const filaSantiso = tabla && indice >= 0 ? tabla[indice] : undefined;
    const partido: PartidoDeLaSemana = {
      id: f.id,
      competicionId: f.competicionId,
      competicion: f.competicion,
      jornadaId: f.jornadaId,
      jornadaNumero: f.jornadaNumero,
      fecha: f.fecha,
      estado: f.estado,
      santisoLocal,
      santiso: santisoLocal ? f.localNombre : f.visitanteNombre,
      santisoEscudoUrl: (() => {
        const clave = santisoLocal ? f.localEscudo : f.visitanteEscudo;
        return clave ? urlMedia(clave) : null;
      })(),
      rival: {
        nombre: santisoLocal ? f.visitanteNombre : f.localNombre,
        escudoUrl: (() => {
          const clave = santisoLocal ? f.visitanteEscudo : f.localEscudo;
          return clave ? urlMedia(clave) : null;
        })(),
      },
      golesSantiso: santisoLocal ? f.golesLocal : f.golesVisitante,
      golesRival: santisoLocal ? f.golesVisitante : f.golesLocal,
      campo: f.campo,
      preparacion: {
        convocatoria: previasPor.has(f.id) ? (seleccionadosPor.get(f.id) ?? 0) : null,
        titulares: alineaciones.filter((a) => a.partidoId === f.id && a.titular).length,
        capitan: alineaciones.some((a) => a.partidoId === f.id && a.titular && a.capitan),
      },
      acta: actaDe(f.id),
      clasificacion:
        tabla && filaSantiso
          ? {
              posicion: indice + 1,
              puntos: filaSantiso.puntos,
              jugados: filaSantiso.jugados,
              equipos: tabla.length,
            }
          : null,
    };
    return { categoria: f.categoria, partido };
  });

  return {
    semana,
    momento,
    categorias: categorias.map((categoria) => {
      const propios = partidos.filter((p) => p.categoria === categoria).map((p) => p.partido);
      const futuros = propios.filter(
        (p) =>
          p.estado !== "cancelado" &&
          !trasPartido(p, momento) &&
          (!p.fecha ||
            p.fecha >= momento.slice(0, 10) ||
            p.estado === "en_juego" ||
            p.estado === "aplazado"),
      );
      // Los que tienen fecha van primero; sin fecha, orden deportivo y no orden SQLite.
      futuros.sort((a, b) =>
        a.fecha && b.fecha
          ? a.fecha.localeCompare(b.fecha)
          : a.fecha
            ? -1
            : b.fecha
              ? 1
              : a.jornadaNumero - b.jornadaNumero,
      );
      const jugados = propios.filter((p) => trasPartido(p, momento));
      jugados.sort(
        (a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? "") || b.jornadaNumero - a.jornadaNumero,
      );
      return {
        categoria,
        partidos: propios.filter(
          (p) => p.fecha && p.fecha >= semana.desde && p.fecha <= `${semana.hasta}T99`,
        ),
        proximo: futuros[0] ?? null,
        ultimo: jugados[0] ?? null,
      };
    }),
  };
}
