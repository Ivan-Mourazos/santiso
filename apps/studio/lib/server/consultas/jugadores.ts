import "server-only";
import { schema } from "@santiso/db";
import { claveNombre, normalizarCategoria, similitudTokens } from "@santiso/domain";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { JugadorDto } from "@/lib/dto";
import { urlMedia } from "@/lib/media";
import { obtenerDb } from "@/lib/server/db";
import { resolverTemporada, temporadaAnterior } from "@/lib/server/temporada";

/** Columnas de persona + inscripción que componen un `JugadorDto`. */
const columnas = {
  id: schema.jugadores.id,
  inscripcionId: schema.jugadoresTemporada.id,
  temporadaId: schema.jugadoresTemporada.temporadaId,
  nombre: schema.jugadores.nombre,
  apodo: schema.jugadores.apodo,
  dorsal: schema.jugadoresTemporada.dorsal,
  posicion: schema.jugadoresTemporada.posicion,
  foto: schema.jugadoresTemporada.foto,
  categoria: schema.jugadoresTemporada.categoria,
  fechaNacimiento: schema.jugadores.fechaNacimiento,
  historial: schema.jugadores.historial,
};

type Fila = {
  id: string;
  inscripcionId: string;
  temporadaId: string;
  nombre: string;
  apodo: string | null;
  dorsal: number | null;
  posicion: string | null;
  foto: string | null;
  categoria: string;
  fechaNacimiento: string | null;
  historial: string[];
};

export const aJugadorDto = (f: Fila): JugadorDto => ({
  id: f.id,
  inscripcion_id: f.inscripcionId,
  temporada_id: f.temporadaId,
  nombre: f.nombre,
  apodo: f.apodo,
  dorsal: f.dorsal,
  posicion: f.posicion,
  foto_url: f.foto ? urlMedia(f.foto) : null,
  categoria: f.categoria,
  fecha_nacimiento: f.fechaNacimiento,
  historial_deportivo: f.historial,
});

/**
 * Plantilla de una temporada (la activa si no se pide otra), por dorsal; quien no tiene dorsal
 * va al final. Sin `categoria` devuelve las tres, que es lo que necesita el importador en lote.
 */
export async function listarJugadores(
  categoria?: string,
  temporadaId?: string | null,
): Promise<JugadorDto[]> {
  const temporada = await resolverTemporada(temporadaId);
  if (!temporada) return [];

  const { db } = await obtenerDb();
  const filas = await db
    .select(columnas)
    .from(schema.jugadoresTemporada)
    .innerJoin(schema.jugadores, eq(schema.jugadores.id, schema.jugadoresTemporada.jugadorId))
    .where(
      and(
        eq(schema.jugadoresTemporada.temporadaId, temporada.id),
        categoria
          ? eq(schema.jugadoresTemporada.categoria, normalizarCategoria(categoria))
          : undefined,
      ),
    )
    .orderBy(
      sql`${schema.jugadoresTemporada.dorsal} is null`,
      asc(schema.jugadoresTemporada.dorsal),
      asc(schema.jugadores.nombre),
    );
  return filas.map(aJugadorDto);
}

export interface CandidatosJugador {
  /** De qué temporada vienen; `null` si no hay temporada anterior. */
  origen: { id: string; nombre: string } | null;
  jugadores: JugadorDto[];
}

/**
 * Jugadores de la temporada anterior que todavía no están en esta, para traerlos. Con
 * `categoria` solo los de esa categoría el año pasado; sin ella, todos (el que sube de juvenil
 * o baja a veteranos).
 */
export async function candidatosDeTemporadaAnterior(
  categoriaDestino: string,
  temporadaId?: string | null,
  soloMismaCategoria = true,
): Promise<CandidatosJugador> {
  const destino = await resolverTemporada(temporadaId);
  if (!destino) return { origen: null, jugadores: [] };
  const origen = await temporadaAnterior(destino);
  if (!origen) return { origen: null, jugadores: [] };

  const categoria = normalizarCategoria(categoriaDestino);
  const yaEstan = new Set(
    (await listarJugadores(categoria, destino.id)).map((jugador) => jugador.id),
  );
  const delAnterior = await listarJugadores(soloMismaCategoria ? categoria : undefined, origen.id);

  // Si alguien jugó en dos categorías el año pasado, basta con proponerlo una vez.
  const vistos = new Set<string>();
  const jugadores = delAnterior.filter((jugador) => {
    if (yaEstan.has(jugador.id) || vistos.has(jugador.id)) return false;
    vistos.add(jugador.id);
    return true;
  });
  return { origen, jugadores };
}

export interface ParecidoJugador {
  id: string;
  nombre: string;
  apodo: string | null;
  /** Última temporada en la que estuvo inscrito, para que el aviso diga «de 2025/26». */
  ultimaTemporada: string | null;
}

/** Por debajo de esto no se avisa: ruido. Mismo umbral que el emparejado de equipos. */
const PARECIDO_MINIMO = 0.6;

/**
 * Personas que ya existen con un nombre parecido. Sirve para avisar antes de dar de alta a
 * alguien que en realidad ya estaba: si se duplica, sus goles de cada año quedan partidos.
 */
export async function jugadoresParecidos(nombre: string): Promise<ParecidoJugador[]> {
  const buscado = claveNombre(nombre);
  if (!buscado) return [];

  const { db } = await obtenerDb();
  const personas = await db
    .select({
      id: schema.jugadores.id,
      nombre: schema.jugadores.nombre,
      apodo: schema.jugadores.apodo,
    })
    .from(schema.jugadores);

  const parecidos = personas.filter(
    (persona) =>
      claveNombre(persona.nombre) === buscado ||
      similitudTokens(persona.nombre, nombre) >= PARECIDO_MINIMO ||
      (persona.apodo !== null && claveNombre(persona.apodo) === buscado),
  );
  if (parecidos.length === 0) return [];

  const resultado: ParecidoJugador[] = [];
  for (const persona of parecidos) {
    const [ultima] = await db
      .select({ nombre: schema.temporadas.nombre })
      .from(schema.jugadoresTemporada)
      .innerJoin(
        schema.temporadas,
        eq(schema.temporadas.id, schema.jugadoresTemporada.temporadaId),
      )
      .where(eq(schema.jugadoresTemporada.jugadorId, persona.id))
      .orderBy(desc(schema.temporadas.nombre))
      .limit(1);
    resultado.push({ ...persona, ultimaTemporada: ultima?.nombre ?? null });
  }
  return resultado;
}
