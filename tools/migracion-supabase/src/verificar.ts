import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Client } from "@libsql/client";
import { type Db, schema as s } from "@santiso/db";
import { and, count, eq, isNotNull } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { sha256 } from "./hash";
import type { Manifiesto, Snapshot } from "./snapshot/tipos";
import type { ModeloNuevo } from "./transformar/tipos";

export interface Comprobacion {
  nombre: string;
  ok: boolean;
  detalle: string;
}

export interface ResultadoVerificacion {
  ok: boolean;
  comprobaciones: Comprobacion[];
}

export interface EntradaVerificacion {
  db: Db;
  cliente: Client;
  origen: Snapshot;
  modelo: ModeloNuevo;
  dirMedia: string;
  manifiesto: Manifiesto;
}

const AJUSTES_CON_MEDIA = new Set(["club.escudo", "cartel.logo_xunta", "cartel.logo_rfgf"]);

const contar = (valores: string[]) => {
  const mapa = new Map<string, number>();
  for (const valor of valores) mapa.set(valor, (mapa.get(valor) ?? 0) + 1);
  return mapa;
};
const mapasIguales = (a: Map<string, number>, b: Map<string, number>) =>
  a.size === b.size && [...a].every(([clave, valor]) => b.get(clave) === valor);
const conjuntosIguales = (a: Set<string>, b: Set<string>) =>
  a.size === b.size && [...a].every((valor) => b.has(valor));
const sumar = (mapa: Map<string, number>) => [...mapa.values()].reduce((t, n) => t + n, 0);

/** Compara la BD importada con el snapshot de origen. Solo lectura. */
export async function verificarImportacion({
  db,
  cliente,
  origen,
  modelo,
  dirMedia,
  manifiesto,
}: EntradaVerificacion): Promise<ResultadoVerificacion> {
  const comprobaciones: Comprobacion[] = [];
  const anotar = (nombre: string, ok: boolean, detalle: string) =>
    comprobaciones.push({ nombre, ok, detalle });

  const integridad = String(
    (await cliente.execute("PRAGMA integrity_check")).rows[0]?.["integrity_check"],
  );
  anotar("Integridad SQLite", integridad === "ok", integridad);
  const violaciones = (await cliente.execute("PRAGMA foreign_key_check")).rows.length;
  anotar("Claves foráneas", violaciones === 0, `${violaciones} violaciones`);

  const recuentos: [string, SQLiteTable, number][] = [
    ["temporadas", s.temporadas, modelo.temporadas.length],
    ["competiciones", s.competiciones, modelo.competiciones.length],
    ["competicionAlias", s.competicionAlias, modelo.competicionAlias.length],
    ["equipos", s.equipos, modelo.equipos.length],
    ["competicionEquipos", s.competicionEquipos, modelo.competicionEquipos.length],
    ["jugadores", s.jugadores, modelo.jugadores.length],
    ["jugadoresTemporada", s.jugadoresTemporada, modelo.jugadoresTemporada.length],
    ["staff", s.staff, modelo.staff.length],
    ["staffTemporada", s.staffTemporada, modelo.staffTemporada.length],
    ["campos", s.campos, modelo.campos.length],
    ["jornadas", s.jornadas, modelo.jornadas.length],
    ["jornadaDescansos", s.jornadaDescansos, modelo.jornadaDescansos.length],
    ["partidos", s.partidos, modelo.partidos.length],
    ["partidoParticipaciones", s.partidoParticipaciones, modelo.partidoParticipaciones.length],
    ["partidoEventos", s.partidoEventos, modelo.partidoEventos.length],
    ["patrocinadores", s.patrocinadores, modelo.patrocinadores.length],
    ["ajustes", s.ajustes, modelo.ajustes.length],
  ];
  for (const [nombre, tabla, esperado] of recuentos) {
    const [fila] = await db.select({ total: count() }).from(tabla);
    const total = fila?.total ?? 0;
    anotar(`Filas en ${nombre}`, total === esperado, `${total} de ${esperado}`);
  }

  const marcadores = new Map(
    (
      await db
        .select({
          id: s.partidos.id,
          golesLocal: s.partidos.golesLocal,
          golesVisitante: s.partidos.golesVisitante,
        })
        .from(s.partidos)
    ).map((partido) => [partido.id, partido]),
  );
  const discrepancias = origen.partidos_liga.filter((partido) => {
    const enBd = marcadores.get(partido.id);
    const disputado = partido.estado === "finalizado" || partido.estado === "en_juego";
    return (
      !enBd ||
      enBd.golesLocal !== (disputado ? partido.goles_local : null) ||
      enBd.golesVisitante !== (disputado ? partido.goles_visitante : null)
    );
  });
  anotar(
    "Marcadores de partidos",
    discrepancias.length === 0,
    discrepancias.length === 0
      ? `${origen.partidos_liga.length} partidos coinciden`
      : `Discrepancias: ${discrepancias
          .slice(0, 10)
          .map((p) => p.id)
          .join(", ")}`,
  );

  const eventosPropiosPorJugador = async (tipo: "gol" | "tarjeta_amarilla" | "tarjeta_roja") => {
    const filtros = [
      eq(s.partidoEventos.tipo, tipo),
      eq(s.partidoEventos.lado, "propio"),
      eq(s.partidoEventos.propia, false),
      isNotNull(s.partidoEventos.jugadorId),
    ];
    const filas = await db
      .select({ jugadorId: s.partidoEventos.jugadorId, total: count() })
      .from(s.partidoEventos)
      .where(and(...filtros))
      .groupBy(s.partidoEventos.jugadorId);
    return new Map(filas.map((fila) => [fila.jugadorId ?? "", fila.total]));
  };
  const eventosOrigenPorJugador = (tipo: string) =>
    contar(
      origen.partido_eventos_santiso
        .filter((evento) => evento.tipo === tipo && !evento.es_rival && evento.jugador_id)
        .map((evento) => evento.jugador_id ?? ""),
    );

  const golesOrigen = eventosOrigenPorJugador("gol");
  anotar(
    "Goles por jugador",
    mapasIguales(golesOrigen, await eventosPropiosPorJugador("gol")),
    `${sumar(golesOrigen)} goles de ${golesOrigen.size} jugadores`,
  );
  for (const tipo of ["tarjeta_amarilla", "tarjeta_roja"] as const) {
    const enOrigen = eventosOrigenPorJugador(tipo);
    anotar(
      `Tarjetas por jugador (${tipo})`,
      mapasIguales(enOrigen, await eventosPropiosPorJugador(tipo)),
      `${sumar(enOrigen)} tarjetas`,
    );
  }

  const titularesOrigen = new Set(
    origen.jugador_partido_stats
      .filter((fila) => fila.titular)
      .map((fila) => `${fila.partido_id}|${fila.jugador_id}`),
  );
  const titularesBd = new Set(
    (
      await db
        .select({
          partidoId: s.partidoParticipaciones.partidoId,
          jugadorId: s.partidoParticipaciones.jugadorId,
        })
        .from(s.partidoParticipaciones)
        .where(eq(s.partidoParticipaciones.titular, true))
    ).map((fila) => `${fila.partidoId}|${fila.jugadorId}`),
  );
  anotar(
    "Titularidades",
    conjuntosIguales(titularesOrigen, titularesBd),
    `${titularesBd.size} titularidades`,
  );

  const clavesUsadas = new Set<string>();
  const anadir = (clave: unknown) => {
    if (typeof clave === "string" && clave) clavesUsadas.add(clave);
  };
  for (const fila of await db.select({ clave: s.equipos.escudo }).from(s.equipos))
    anadir(fila.clave);
  for (const fila of await db
    .select({ clave: s.jugadoresTemporada.foto })
    .from(s.jugadoresTemporada))
    anadir(fila.clave);
  for (const fila of await db.select({ clave: s.staffTemporada.foto }).from(s.staffTemporada))
    anadir(fila.clave);
  for (const fila of await db.select({ clave: s.patrocinadores.logo }).from(s.patrocinadores)) {
    anadir(fila.clave);
  }
  for (const fila of await db.select().from(s.ajustes)) {
    if (AJUSTES_CON_MEDIA.has(fila.id)) anadir(fila.valor);
  }
  const problemas = [...clavesUsadas].filter((clave) => {
    const ruta = path.join(dirMedia, ...clave.split("/"));
    const esperado = manifiesto.media[clave];
    return !esperado || !existsSync(ruta) || sha256(readFileSync(ruta)) !== esperado.sha256;
  });
  anotar(
    "Ficheros de media",
    problemas.length === 0,
    problemas.length === 0
      ? `${clavesUsadas.size} ficheros verificados`
      : `Faltan o no coinciden: ${problemas.join(", ")}`,
  );

  return { ok: comprobaciones.every((comprobacion) => comprobacion.ok), comprobaciones };
}
