import "server-only";
import { schema } from "@santiso/db";
import { and, eq, isNotNull } from "drizzle-orm";
import {
  disciplina,
  goleadores,
  type Disciplina,
  type EventoLiga,
  type Goleador,
} from "@/lib/liga/tablas";
import { obtenerDb } from "@/lib/server/db";

export interface PantallaLiga {
  /** Amarillas que suman un partido de sanción en esta competición. */
  ciclo: number;
  goleadores: Goleador[];
  disciplina: Disciplina[];
  /** Partidos jugados y cuántos tienen ya sus goles y tarjetas cargados. */
  partidosJugados: number;
  partidosCargados: number;
  /** Partidos cuya acta se bajó pero no se supo leer: sus goles y tarjetas faltan en las tablas. */
  partidosSinLeer: number;
  /** Jornadas jugadas con algún partido todavía sin traer, de la más reciente a la más antigua. */
  jornadasPorTraer: number[];
  /** Equipos del club en la competición, para destacarlos. */
  propios: string[];
}

/** Goleadores y tarjetas de toda una competición, a partir de las actas ya cargadas. */
export async function pantallaLiga(competicionId: string): Promise<PantallaLiga> {
  const { db } = await obtenerDb();
  const [competicion] = await db
    .select({ ciclo: schema.competiciones.amarillasCiclo })
    .from(schema.competiciones)
    .where(eq(schema.competiciones.id, competicionId));
  const ciclo = competicion?.ciclo ?? 5;

  const filas = await db
    .select({
      equipoId: schema.ligaEventos.equipoId,
      equipo: schema.equipos.nombre,
      propio: schema.equipos.esPropio,
      persona: schema.ligaEventos.persona,
      personaClave: schema.ligaEventos.personaClave,
      tipo: schema.ligaEventos.tipo,
      tecnico: schema.ligaEventos.tecnico,
      jornada: schema.jornadas.numero,
    })
    .from(schema.ligaEventos)
    .innerJoin(schema.partidos, eq(schema.partidos.id, schema.ligaEventos.partidoId))
    .innerJoin(schema.jornadas, eq(schema.jornadas.id, schema.partidos.jornadaId))
    .innerJoin(schema.equipos, eq(schema.equipos.id, schema.ligaEventos.equipoId))
    .where(eq(schema.jornadas.competicionId, competicionId));
  const eventos: EventoLiga[] = filas;

  // La última jornada jugada por cada equipo sale de los partidos, no de los eventos.
  const jugados = await db
    .select({
      jornada: schema.jornadas.numero,
      local: schema.partidos.equipoLocalId,
      visitante: schema.partidos.equipoVisitanteId,
      id: schema.partidos.id,
      golesLocal: schema.partidos.golesLocal,
      golesVisitante: schema.partidos.golesVisitante,
    })
    .from(schema.partidos)
    .innerJoin(schema.jornadas, eq(schema.jornadas.id, schema.partidos.jornadaId))
    .where(
      and(eq(schema.jornadas.competicionId, competicionId), isNotNull(schema.partidos.golesLocal)),
    );
  const ultimaJornada = new Map<string, number>();
  for (const p of jugados) {
    for (const equipo of [p.local, p.visitante]) {
      ultimaJornada.set(equipo, Math.max(ultimaJornada.get(equipo) ?? 0, p.jornada));
    }
  }
  // Un acta «cargada» de un partido con goles pero sin ningún evento es un acta que no se leyó.
  const conEventos = new Set(
    (
      await db
        .selectDistinct({ id: schema.ligaEventos.partidoId })
        .from(schema.ligaEventos)
        .innerJoin(schema.partidos, eq(schema.partidos.id, schema.ligaEventos.partidoId))
        .innerJoin(schema.jornadas, eq(schema.jornadas.id, schema.partidos.jornadaId))
        .where(eq(schema.jornadas.competicionId, competicionId))
    ).map((f) => f.id),
  );
  // Partidos cuya acta ya se bajó (se supiera leer o no).
  const bajados = new Set(
    (
      await db
        .selectDistinct({ id: schema.rfgfActas.partidoId })
        .from(schema.rfgfActas)
        .where(
          and(eq(schema.rfgfActas.competicionId, competicionId), eq(schema.rfgfActas.eventos, true)),
        )
    ).map((f) => f.id),
  );
  const sinLeer = jugados.filter(
    (p) =>
      bajados.has(p.id) &&
      (p.golesLocal ?? 0) + (p.golesVisitante ?? 0) > 0 &&
      !conEventos.has(p.id),
  ).length;
  const cargados = jugados.filter((p) => bajados.has(p.id)).length - sinLeer;

  return {
    ciclo,
    goleadores: goleadores(eventos),
    disciplina: disciplina(eventos, ciclo, ultimaJornada),
    partidosJugados: jugados.length,
    partidosCargados: cargados,
    partidosSinLeer: sinLeer,
    jornadasPorTraer: [
      ...new Set(jugados.filter((p) => !bajados.has(p.id)).map((p) => p.jornada)),
    ].sort((a, b) => b - a),
    propios: [...new Set(filas.filter((f) => f.propio).map((f) => f.equipoId))],
  };
}

/** Solo quien tiene algo que contar (apercibido, sancionado o expulsado) en una competición. */
export async function avisosDeLiga(competicionId: string): Promise<Disciplina[]> {
  return (await pantallaLiga(competicionId)).disciplina.filter((d) => d.situacion !== null);
}
