import "server-only";
import { schema, type Db, type TransaccionDb } from "@santiso/db";
import {
  calcularEstadisticasJugadores,
  CATEGORIAS,
  type Categoria,
  type EstadisticaJugador,
} from "@santiso/domain";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { urlMedia } from "../../media";
import { obtenerDb } from "../db";

export interface AmbitoEstadisticas {
  temporadaId: string;
  categoria: Categoria;
  competicionId?: string;
}

export interface EstadisticasTemporada {
  filas: (EstadisticaJugador & {
    nombre: string;
    apodo: string | null;
    dorsal: number | null;
    fotoUrl: string | null;
    inscripcionAusente: boolean;
  })[];
  ambito: AmbitoEstadisticas;
  disponibilidadPenaltis: false;
}

/** Solo SELECT; el llamante puede inyectar su propia transacción de lectura consistente. */
export async function leerEstadisticasJugadores(
  db: Db | TransaccionDb,
  ambito: AmbitoEstadisticas,
): Promise<EstadisticasTemporada> {
  const { temporadaId, categoria, competicionId } = ambito;
  if (typeof temporadaId !== "string" || !temporadaId.trim()) {
    throw new Error("La temporada es obligatoria.");
  }
  if (!CATEGORIAS.includes(categoria)) throw new Error("Categoría desconocida.");
  const [temporada] = await db
    .select({ id: schema.temporadas.id })
    .from(schema.temporadas)
    .where(eq(schema.temporadas.id, temporadaId));
  if (!temporada) throw new Error("La temporada no existe.");

  const filtro = and(
    eq(schema.competiciones.temporadaId, temporadaId),
    eq(schema.competiciones.categoria, categoria),
    competicionId !== undefined ? eq(schema.competiciones.id, competicionId) : undefined,
  );
  if (competicionId !== undefined) {
    const [competicion] = await db
      .select({ id: schema.competiciones.id })
      .from(schema.competiciones)
      .where(filtro);
    if (!competicion)
      throw new Error("La competición no existe o no pertenece a la temporada y categoría.");
  }

  // Consultas independientes: unir eventos y participaciones multiplicaría sus recuentos.
  const participaciones = await db
    .select({
      partidoId: schema.partidoParticipaciones.partidoId,
      jugadorId: schema.partidoParticipaciones.jugadorId,
      titular: schema.partidoParticipaciones.titular,
      jugo: schema.partidoParticipaciones.jugo,
    })
    .from(schema.partidoParticipaciones)
    .innerJoin(schema.partidos, eq(schema.partidos.id, schema.partidoParticipaciones.partidoId))
    .innerJoin(schema.jornadas, eq(schema.jornadas.id, schema.partidos.jornadaId))
    .innerJoin(schema.competiciones, eq(schema.competiciones.id, schema.jornadas.competicionId))
    .where(filtro);
  const eventos = await db
    .select({
      id: schema.partidoEventos.id,
      partidoId: schema.partidoEventos.partidoId,
      jugadorId: schema.partidoEventos.jugadorId,
      tipo: schema.partidoEventos.tipo,
      lado: schema.partidoEventos.lado,
      propia: schema.partidoEventos.propia,
    })
    .from(schema.partidoEventos)
    .innerJoin(schema.partidos, eq(schema.partidos.id, schema.partidoEventos.partidoId))
    .innerJoin(schema.jornadas, eq(schema.jornadas.id, schema.partidos.jornadaId))
    .innerJoin(schema.competiciones, eq(schema.competiciones.id, schema.jornadas.competicionId))
    .where(filtro);
  const inscripciones = await db
    .select({
      jugadorId: schema.jugadoresTemporada.jugadorId,
      dorsal: schema.jugadoresTemporada.dorsal,
      foto: schema.jugadoresTemporada.foto,
    })
    .from(schema.jugadoresTemporada)
    .where(
      and(
        eq(schema.jugadoresTemporada.temporadaId, temporadaId),
        eq(schema.jugadoresTemporada.categoria, categoria),
      ),
    );
  const estadisticas = new Map(
    calcularEstadisticasJugadores(participaciones, eventos).map((fila) => [fila.jugadorId, fila]),
  );
  const porJugador = new Map(inscripciones.map((fila) => [fila.jugadorId, fila]));
  for (const { jugadorId } of inscripciones) {
    if (!estadisticas.has(jugadorId)) {
      estadisticas.set(jugadorId, {
        jugadorId,
        convocados: 0,
        titularidades: 0,
        partidosJugados: 0,
        goles: 0,
        golesPropia: 0,
        amarillas: 0,
        rojas: 0,
        golesPenalti: null,
      });
    }
  }
  const ids = [...estadisticas.keys()];
  const personas = ids.length
    ? await db
        .select({
          id: schema.jugadores.id,
          nombre: schema.jugadores.nombre,
          apodo: schema.jugadores.apodo,
        })
        .from(schema.jugadores)
        .where(inArray(schema.jugadores.id, ids))
    : [];
  const porId = new Map(personas.map((persona) => [persona.id, persona]));
  const filas = [...estadisticas.values()].map((fila) => {
    const persona = porId.get(fila.jugadorId);
    if (!persona) throw new Error(`Jugador inexistente en estadísticas: ${fila.jugadorId}`);
    const inscripcion = porJugador.get(fila.jugadorId);
    return {
      ...fila,
      nombre: persona.nombre,
      apodo: persona.apodo,
      dorsal: inscripcion?.dorsal ?? null,
      fotoUrl: inscripcion?.foto ? urlMedia(inscripcion.foto) : null,
      inscripcionAusente: !inscripcion,
    };
  });
  filas.sort(
    (a, b) =>
      Number(a.dorsal === null) - Number(b.dorsal === null) ||
      (a.dorsal ?? 0) - (b.dorsal ?? 0) ||
      a.nombre.localeCompare(b.nombre, "es") ||
      a.jugadorId.localeCompare(b.jugadorId),
  );
  return { filas, ambito: { ...ambito }, disponibilidadPenaltis: false };
}

export async function listarEstadisticasJugadores(
  ambito: AmbitoEstadisticas,
): Promise<EstadisticasTemporada> {
  const { cliente } = await obtenerDb();
  let tx: Awaited<ReturnType<typeof cliente.transaction>> | undefined;
  // Drizzle elige el modo por cliente.transaction(), no por su configuración.
  const clienteLectura = new Proxy(cliente, {
    get(target, propiedad) {
      if (propiedad === "transaction") {
        return async () => {
          tx = await target.transaction("read");
          return tx;
        };
      }
      const valor = Reflect.get(target, propiedad, target);
      return typeof valor === "function" ? valor.bind(target) : valor;
    },
  });
  try {
    return await drizzle(clienteLectura, { schema }).transaction((lectura) =>
      leerEstadisticasJugadores(lectura, ambito),
    );
  } finally {
    tx?.close();
  }
}
