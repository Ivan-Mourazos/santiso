import "server-only";
import { schema } from "@santiso/db";
import { aliasedTable, and, asc, eq, inArray } from "drizzle-orm";
import { momentoLocal } from "@/lib/jornada/vestiario";
import { urlMedia } from "@/lib/media";
import { grupoDeEnlace, urlActaWeb } from "@/lib/rfgf/enlace";
import { obtenerDb } from "@/lib/server/db";

type TipoEvento = schema.TipoEventoLiga;

export interface EquipoDePartido {
  id: string;
  nombre: string;
  escudoUrl: string | null;
  propio: boolean;
}

export interface PartidoDeLiga {
  id: string;
  fecha: string | null;
  estado: string;
  local: EquipoDePartido;
  visitante: EquipoDePartido;
  golesLocal: number | null;
  golesVisitante: number | null;
  campo: string | null;
  arbitro: string | null;
  /** Goles y tarjetas del acta de la federación, en orden de minuto. Vacío si no hay acta. */
  eventos: { tipo: TipoEvento; persona: string; minuto: string; lado: "local" | "visitante" }[];
  /** La página del partido en futgal.es, si ya se leyó su acta. */
  enlaceActa: string | null;
}

export interface PartidosDeLiga {
  competicion: { id: string; nombre: string; categoria: string; enlazada: boolean };
  /** Todas las jornadas, con su primera fecha para el selector. */
  jornadas: { numero: number; fecha: string | null }[];
  /** La que toca ahora: la del partido del Santiso que está en la mesa. */
  actual: number | null;
  /** La que se enseña. */
  numero: number | null;
  partidos: PartidoDeLiga[];
}

/** Minuto del acta («45+2») como número para ordenar; sin minuto, al final. */
const minutoOrden = (minuto: string) => {
  const [base = "", extra = "0"] = minuto.split("+");
  const n = Number(base);
  return Number.isFinite(n) && base ? n + Number(extra) / 100 : 999;
};

/**
 * La jornada que toca: el día de un partido del Santiso, la de ese partido (aunque ya se haya
 * jugado, para cerrarlo); si no, la del próximo partido del Santiso; si no queda ninguno, la
 * última jugada. Igual que la mesa de la jornada (`partidoEnMesa`).
 */
export function jornadaActual(
  propios: readonly { jornada: number; fecha: string | null; jugado: boolean }[],
  ahora: string,
): number | null {
  const hoy = ahora.slice(0, 10);
  const deHoy = propios.find((p) => p.fecha?.slice(0, 10) === hoy);
  if (deHoy) return deHoy.jornada;
  const proximo = propios
    .filter((p) => !p.jugado && (p.fecha ?? "9999") >= hoy)
    .sort((a, b) => (a.fecha ?? "9999").localeCompare(b.fecha ?? "9999"))[0];
  if (proximo) return proximo.jornada;
  return propios.filter((p) => p.jugado).sort((a, b) => b.jornada - a.jornada)[0]?.jornada ?? null;
}

/** Todos los partidos de la competición con sus equipos, por jornada y fecha. */
async function filasDeCompeticion(competicionId: string) {
  const { db } = await obtenerDb();
  const local = aliasedTable(schema.equipos, "local");
  const visitante = aliasedTable(schema.equipos, "visitante");
  return db
    .select({
      id: schema.partidos.id,
      jornada: schema.jornadas.numero,
      fecha: schema.partidos.fecha,
      estado: schema.partidos.estado,
      golesLocal: schema.partidos.golesLocal,
      golesVisitante: schema.partidos.golesVisitante,
      campo: schema.campos.nombre,
      arbitro: schema.partidos.arbitro,
      localId: local.id,
      localNombre: local.nombre,
      localEscudo: local.escudo,
      localPropio: local.esPropio,
      visitanteId: visitante.id,
      visitanteNombre: visitante.nombre,
      visitanteEscudo: visitante.escudo,
      visitantePropio: visitante.esPropio,
    })
    .from(schema.partidos)
    .innerJoin(schema.jornadas, eq(schema.jornadas.id, schema.partidos.jornadaId))
    .innerJoin(local, eq(local.id, schema.partidos.equipoLocalId))
    .innerJoin(visitante, eq(visitante.id, schema.partidos.equipoVisitanteId))
    .leftJoin(schema.campos, eq(schema.campos.id, schema.partidos.campoId))
    .where(eq(schema.jornadas.competicionId, competicionId))
    .orderBy(asc(schema.jornadas.numero), asc(schema.partidos.fecha));
}

const escudo = (clave: string | null) => (clave ? urlMedia(clave) : null);

/**
 * Los partidos de una jornada de la competición, con los goles y tarjetas que se leyeron de su
 * acta. Sin número, la jornada que toca ahora. Solo lee.
 */
export async function partidosDeLiga(
  competicionId: string,
  numero: number | null,
  ahora = momentoLocal(),
): Promise<PartidosDeLiga | null> {
  const { db } = await obtenerDb();
  const [competicion] = await db
    .select({
      id: schema.competiciones.id,
      nombre: schema.competiciones.nombre,
      categoria: schema.competiciones.categoria,
      enlace: schema.rfgfCompeticiones.enlace,
    })
    .from(schema.competiciones)
    .leftJoin(
      schema.rfgfCompeticiones,
      eq(schema.rfgfCompeticiones.competicionId, schema.competiciones.id),
    )
    .where(eq(schema.competiciones.id, competicionId));
  if (!competicion) return null;

  const filas = await filasDeCompeticion(competicionId);

  const numeros = await db
    .select({ numero: schema.jornadas.numero })
    .from(schema.jornadas)
    .where(eq(schema.jornadas.competicionId, competicionId))
    .orderBy(asc(schema.jornadas.numero));
  const jornadas = numeros.map(({ numero: n }) => ({
    numero: n,
    fecha:
      filas
        .filter((f) => f.jornada === n && f.fecha)
        .map((f) => f.fecha!)
        .sort()[0] ?? null,
  }));
  const actual = jornadaActual(
    filas
      .filter((f) => f.localPropio || f.visitantePropio)
      .map((f) => ({
        jornada: f.jornada,
        fecha: f.fecha,
        jugado: f.golesLocal !== null || f.estado === "finalizado",
      })),
    ahora,
  );
  const elegida =
    numero !== null && jornadas.some((j) => j.numero === numero)
      ? numero
      : (actual ?? jornadas[0]?.numero ?? null);
  const deLaJornada = filas.filter((f) => f.jornada === elegida);
  const ids = deLaJornada.map((f) => f.id);

  const eventos = ids.length
    ? await db
        .select({
          partidoId: schema.ligaEventos.partidoId,
          equipoId: schema.ligaEventos.equipoId,
          tipo: schema.ligaEventos.tipo,
          persona: schema.ligaEventos.persona,
          minuto: schema.ligaEventos.minuto,
        })
        .from(schema.ligaEventos)
        .where(inArray(schema.ligaEventos.partidoId, ids))
    : [];
  const actas = ids.length
    ? await db
        .select({ partidoId: schema.rfgfActas.partidoId, codActa: schema.rfgfActas.codActa })
        .from(schema.rfgfActas)
        .where(inArray(schema.rfgfActas.partidoId, ids))
    : [];
  const grupo = competicion.enlace ? grupoDeEnlace(competicion.enlace) : null;

  return {
    competicion: {
      id: competicion.id,
      nombre: competicion.nombre,
      categoria: competicion.categoria,
      enlazada: grupo !== null,
    },
    jornadas,
    actual,
    numero: elegida,
    partidos: deLaJornada.map((f) => {
      const acta = actas.find((a) => a.partidoId === f.id);
      return {
        id: f.id,
        fecha: f.fecha,
        estado: f.estado,
        local: {
          id: f.localId,
          nombre: f.localNombre,
          escudoUrl: escudo(f.localEscudo),
          propio: f.localPropio,
        },
        visitante: {
          id: f.visitanteId,
          nombre: f.visitanteNombre,
          escudoUrl: escudo(f.visitanteEscudo),
          propio: f.visitantePropio,
        },
        golesLocal: f.golesLocal,
        golesVisitante: f.golesVisitante,
        campo: f.campo,
        arbitro: f.arbitro,
        eventos: eventos
          .filter((e) => e.partidoId === f.id)
          .sort((a, b) => minutoOrden(a.minuto) - minutoOrden(b.minuto))
          .map((e) => ({
            tipo: e.tipo,
            persona: e.persona,
            minuto: e.minuto,
            // Un gol en propia lleva el equipo de quien lo marcó: suma al otro lado.
            lado:
              (e.equipoId === f.localId) !== (e.tipo === "gol_propia") ? "local" : "visitante",
          })),
        enlaceActa: acta && grupo ? urlActaWeb(grupo, acta.codActa) : null,
      };
    }),
  };
}

export interface FichaEquipo {
  equipo: { id: string; nombre: string; escudoUrl: string | null; propio: boolean };
  /** Los jugados, del más reciente al más antiguo. */
  jugados: {
    id: string;
    jornada: number;
    fecha: string | null;
    rival: string;
    casa: boolean;
    goles: number;
    golesRival: number;
  }[];
  /** Los que quedan, por orden. */
  pendientes: { id: string; jornada: number; fecha: string | null; rival: string; casa: boolean }[];
  /** Goleadores del equipo según las actas de la federación (sin goles en propia). */
  goleadores: { persona: string; goles: number }[];
  tarjetas: { amarillas: number; rojas: number };
}

/** La ficha de un equipo en una competición: resultados, lo que le queda y sus goleadores. */
export async function fichaEquipo(
  competicionId: string,
  equipoId: string,
): Promise<FichaEquipo | null> {
  const filas = await filasDeCompeticion(competicionId);
  const suyas = filas.filter((f) => f.localId === equipoId || f.visitanteId === equipoId);
  const una = suyas[0];
  if (!una) return null;
  const casa = (f: (typeof filas)[number]) => f.localId === equipoId;
  const jugado = (f: (typeof filas)[number]) => f.golesLocal !== null && f.golesVisitante !== null;
  const { db } = await obtenerDb();
  const eventos = await db
    .select({ tipo: schema.ligaEventos.tipo, persona: schema.ligaEventos.persona })
    .from(schema.ligaEventos)
    .where(
      and(
        inArray(
          schema.ligaEventos.partidoId,
          suyas.map((f) => f.id),
        ),
        eq(schema.ligaEventos.equipoId, equipoId),
      ),
    );
  const goles = new Map<string, number>();
  for (const e of eventos)
    if (e.tipo === "gol") goles.set(e.persona, (goles.get(e.persona) ?? 0) + 1);
  return {
    equipo: {
      id: equipoId,
      nombre: casa(una) ? una.localNombre : una.visitanteNombre,
      escudoUrl: escudo(casa(una) ? una.localEscudo : una.visitanteEscudo),
      propio: casa(una) ? una.localPropio : una.visitantePropio,
    },
    jugados: suyas
      .filter(jugado)
      .reverse()
      .map((f) => ({
        id: f.id,
        jornada: f.jornada,
        fecha: f.fecha,
        rival: casa(f) ? f.visitanteNombre : f.localNombre,
        casa: casa(f),
        goles: (casa(f) ? f.golesLocal : f.golesVisitante)!,
        golesRival: (casa(f) ? f.golesVisitante : f.golesLocal)!,
      })),
    pendientes: suyas
      .filter((f) => !jugado(f) && f.estado !== "cancelado")
      .map((f) => ({
        id: f.id,
        jornada: f.jornada,
        fecha: f.fecha,
        rival: casa(f) ? f.visitanteNombre : f.localNombre,
        casa: casa(f),
      })),
    goleadores: [...goles]
      .map(([persona, n]) => ({ persona, goles: n }))
      .sort((a, b) => b.goles - a.goles || a.persona.localeCompare(b.persona, "es")),
    tarjetas: {
      amarillas: eventos.filter((e) => e.tipo === "amarilla").length,
      rojas: eventos.filter((e) => e.tipo === "roja" || e.tipo === "doble_amarilla").length,
    },
  };
}
