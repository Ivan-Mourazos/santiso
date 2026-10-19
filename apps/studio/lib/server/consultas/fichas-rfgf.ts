import "server-only";

import { schema } from "@santiso/db";
import { claveEquipo, claveNombre, normalizarNombreEquipo, type Categoria } from "@santiso/domain";
import { aliasedTable, and, asc, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import type { FichaJugador } from "@/lib/estadisticas/ficha";
import { personaDeActa } from "@/lib/liga/eventos";
import { urlMedia } from "@/lib/media";
import { coloresDeEquipacion } from "@/lib/rfgf/colores";
import { urlActaPdf } from "@/lib/rfgf/enlace";
import { codigoDeTemporada } from "@santiso/actas";
import { fichaDeJugador } from "@/lib/server/consultas/ficha-jugador";
import { fichaEquipo, type FichaEquipo } from "@/lib/server/consultas/partidos-liga";
import { obtenerDb } from "@/lib/server/db";
import { resumenPartidosHistoricos } from "@/lib/server/rfgf/historico-partidos";

/* ───────────────────────────── Comunes ───────────────────────────── */

/** Las cifras oficiales completas de un jugador en un grupo, como las da la federación. */
export interface CifrasRfgf {
  convocados: number;
  titular: number;
  suplente: number;
  jugados: number;
  amarillas: number;
  doblesAmarillas: number;
  rojas: number;
  goles: number;
}

const CERO: CifrasRfgf = {
  convocados: 0,
  titular: 0,
  suplente: 0,
  jugados: 0,
  amarillas: 0,
  doblesAmarillas: 0,
  rojas: 0,
  goles: 0,
};

/** Suma de cifras: para los totales por temporada y de toda la carrera. */
export function sumarCifras(lista: readonly CifrasRfgf[]): CifrasRfgf {
  const total = { ...CERO };
  for (const cifras of lista)
    for (const clave of Object.keys(CERO) as (keyof CifrasRfgf)[]) total[clave] += cifras[clave];
  return total;
}

/** «2026/27» (Studio) → «2026-2027» (federación). `null` si no tiene esa forma. */
export function temporadaDeFederacion(nombre: string): string | null {
  const m = /^(\d{4})\/(\d{2})$/u.exec(nombre.trim());
  return m ? `${m[1]}-${Number(m[1]) + 1}` : null;
}

export type ResultadoSantiso = "G" | "E" | "P";

/** El resultado visto desde el Santiso; `null` sin marcador. */
export function resultadoSantiso(
  santisoLocal: boolean,
  golesLocal: number | null,
  golesVisitante: number | null,
): ResultadoSantiso | null {
  if (golesLocal === null || golesVisitante === null) return null;
  const [nuestros, suyos] = santisoLocal
    ? [golesLocal, golesVisitante]
    : [golesVisitante, golesLocal];
  return nuestros > suyos ? "G" : nuestros < suyos ? "P" : "E";
}

const escudoUrl = (clave: string | null) => (clave ? urlMedia(clave) : null);

/* ───────────────────────────── Ficha de equipo ───────────────────────────── */

export interface ClubDeEquipo {
  codigo: string;
  nombre: string;
  direccion: string | null;
  localidad: string | null;
  codigoPostal: string | null;
  provincia: string | null;
  delegacion: string | null;
  /** `AAAA-MM-DD`. */
  fechaFundacion: string | null;
  fechaInscripcionFederacion: string | null;
  numeroEquipos: number | null;
  /** Las palabras de la federación y los colores que salen de ellas (`null` si no se conocen). */
  equipacion: {
    camiseta: string | null;
    pantalon: string | null;
    medias: string | null;
    color: string | null;
    color2: string | null;
  };
  /** El enlace lo eligió una persona. */
  manual: boolean;
  /** Cuándo se leyó del listado de la federación, ISO. */
  leidoEn: string;
}

/** Un partido contra el Santiso, de esta temporada o del archivo de temporadas pasadas. */
export interface PartidoCaraACara {
  origen: "temporada" | "archivo";
  /** `partidos.id` o `rfgf_historico_partidos.id`, según el origen. */
  id: string;
  /** «2026-2027». */
  temporada: string;
  competicion: string;
  jornada: number;
  /** `AAAA-MM-DD` o `AAAA-MM-DDTHH:mm`; `null` si no se sabe. */
  fecha: string | null;
  local: string;
  visitante: string;
  santisoLocal: boolean;
  golesLocal: number | null;
  golesVisitante: number | null;
  resultado: ResultadoSantiso | null;
}

export interface TotalesCaraACara {
  jugados: number;
  /** Desde el Santiso: ganados por el Santiso. */
  ganados: number;
  empatados: number;
  perdidos: number;
  golesFavor: number;
  golesContra: number;
}

export interface FichaDeEquipo {
  equipo: {
    id: string;
    nombre: string;
    categoria: Categoria;
    escudoUrl: string | null;
    propio: boolean;
    color: string | null;
    color2: string | null;
    /** Los colores salieron de la federación (no se pusieron a mano). */
    colorFederacion: boolean;
  };
  club: ClubDeEquipo | null;
  /** El campo en el que más veces jugó de local; `null` si no hay ninguno apuntado. */
  campoHabitual: { id: string; nombre: string; poblacion: string | null; partidos: number } | null;
  /** Esta temporada, por competición (la ficha de siempre de la liga). */
  temporada: { competicionId: string; competicion: string; ficha: FichaEquipo }[];
  /** Contra el Santiso: de lo más reciente a lo más antiguo, con totales desde el Santiso. */
  contraSantiso: { partidos: PartidoCaraACara[]; totales: TotalesCaraACara };
}

/** Totales desde el Santiso de una lista de partidos (solo los que tienen marcador). */
export function totalesCaraACara(partidos: readonly PartidoCaraACara[]): TotalesCaraACara {
  const totales: TotalesCaraACara = {
    jugados: 0,
    ganados: 0,
    empatados: 0,
    perdidos: 0,
    golesFavor: 0,
    golesContra: 0,
  };
  for (const p of partidos) {
    if (!p.resultado || p.golesLocal === null || p.golesVisitante === null) continue;
    totales.jugados++;
    if (p.resultado === "G") totales.ganados++;
    else if (p.resultado === "E") totales.empatados++;
    else totales.perdidos++;
    totales.golesFavor += p.santisoLocal ? p.golesLocal : p.golesVisitante;
    totales.golesContra += p.santisoLocal ? p.golesVisitante : p.golesLocal;
  }
  return totales;
}

/**
 * Todo lo que se sabe de un equipo: su club en la federación (dirección, fundación, colores),
 * el campo donde suele jugar, cómo va esta temporada y su historial contra el Santiso, de esta
 * temporada y del archivo. `null` si el equipo no existe. Solo lee.
 */
export async function fichaDeEquipo(equipoId: string): Promise<FichaDeEquipo | null> {
  const { db } = await obtenerDb();
  const [equipo] = await db
    .select({
      id: schema.equipos.id,
      nombre: schema.equipos.nombre,
      categoria: schema.equipos.categoria,
      escudo: schema.equipos.escudo,
      propio: schema.equipos.esPropio,
      color: schema.equipos.color,
      color2: schema.equipos.color2,
      colorFederacion: schema.equipos.colorFederacion,
      clubManual: schema.equipos.clubManual,
      club: schema.rfgfClubes,
    })
    .from(schema.equipos)
    .leftJoin(schema.rfgfClubes, eq(schema.rfgfClubes.codigo, schema.equipos.clubCodigo))
    .where(eq(schema.equipos.id, equipoId));
  if (!equipo) return null;

  const club: ClubDeEquipo | null = equipo.club
    ? {
        codigo: equipo.club.codigo,
        nombre: equipo.club.nombre,
        direccion: equipo.club.direccion,
        localidad: equipo.club.localidad,
        codigoPostal: equipo.club.codigoPostal,
        provincia: equipo.club.provincia,
        delegacion: equipo.club.delegacion,
        fechaFundacion: equipo.club.fechaFundacion,
        fechaInscripcionFederacion: equipo.club.fechaInscripcionFederacion,
        numeroEquipos: equipo.club.numeroEquipos,
        equipacion: {
          camiseta: equipo.club.camiseta,
          pantalon: equipo.club.pantalon,
          medias: equipo.club.medias,
          color: null,
          color2: null,
          ...coloresDeEquipacion(equipo.club),
        },
        manual: equipo.clubManual,
        leidoEn: equipo.club.leidoEn,
      }
    : null;

  // El campo habitual: el más repetido en sus partidos de local, de cualquier temporada guardada.
  const [campo] = await db
    .select({
      id: schema.campos.id,
      nombre: schema.campos.nombre,
      poblacion: schema.campos.poblacion,
      partidos: sql<number>`count(*)`,
    })
    .from(schema.partidos)
    .innerJoin(schema.campos, eq(schema.campos.id, schema.partidos.campoId))
    .where(eq(schema.partidos.equipoLocalId, equipoId))
    .groupBy(schema.campos.id)
    .orderBy(desc(sql`count(*)`), desc(sql`max(${schema.partidos.fecha})`))
    .limit(1);

  // Esta temporada: las competiciones activas en las que está inscrito o tiene partidos.
  const local = aliasedTable(schema.equipos, "local");
  const visitante = aliasedTable(schema.equipos, "visitante");
  const competiciones = await db
    .selectDistinct({
      id: schema.competiciones.id,
      nombre: schema.competiciones.nombre,
      orden: schema.competiciones.orden,
    })
    .from(schema.competiciones)
    .innerJoin(schema.temporadas, eq(schema.temporadas.id, schema.competiciones.temporadaId))
    .where(
      and(
        eq(schema.temporadas.activa, true),
        sql`(exists (select 1 from ${schema.competicionEquipos} ce where ce.competicion_id = ${schema.competiciones.id} and ce.equipo_id = ${equipoId}) or exists (select 1 from ${schema.partidos} p join ${schema.jornadas} j on j.id = p.jornada_id where j.competicion_id = ${schema.competiciones.id} and (p.equipo_local_id = ${equipoId} or p.equipo_visitante_id = ${equipoId})))`,
      ),
    )
    .orderBy(asc(schema.competiciones.orden), asc(schema.competiciones.nombre));
  const temporada: FichaDeEquipo["temporada"] = [];
  for (const competicion of competiciones) {
    const ficha = await fichaEquipo(competicion.id, equipoId);
    if (ficha)
      temporada.push({ competicionId: competicion.id, competicion: competicion.nombre, ficha });
  }

  // Contra el Santiso en el calendario guardado (la temporada activa; la base no guarda otras).
  const actuales = await db
    .select({
      id: schema.partidos.id,
      temporada: schema.temporadas.nombre,
      competicion: schema.competiciones.nombre,
      jornada: schema.jornadas.numero,
      fecha: schema.partidos.fecha,
      local: local.nombre,
      localPropio: local.esPropio,
      visitante: visitante.nombre,
      golesLocal: schema.partidos.golesLocal,
      golesVisitante: schema.partidos.golesVisitante,
    })
    .from(schema.partidos)
    .innerJoin(schema.jornadas, eq(schema.jornadas.id, schema.partidos.jornadaId))
    .innerJoin(schema.competiciones, eq(schema.competiciones.id, schema.jornadas.competicionId))
    .innerJoin(schema.temporadas, eq(schema.temporadas.id, schema.competiciones.temporadaId))
    .innerJoin(local, eq(local.id, schema.partidos.equipoLocalId))
    .innerJoin(visitante, eq(visitante.id, schema.partidos.equipoVisitanteId))
    .where(
      or(
        and(eq(schema.partidos.equipoLocalId, equipoId), eq(visitante.esPropio, true)),
        and(eq(schema.partidos.equipoVisitanteId, equipoId), eq(local.esPropio, true)),
      ),
    );
  const partidos: PartidoCaraACara[] = actuales.map((p) => ({
    origen: "temporada",
    id: p.id,
    temporada: temporadaDeFederacion(p.temporada) ?? p.temporada,
    competicion: p.competicion,
    jornada: p.jornada,
    fecha: p.fecha,
    local: p.local,
    visitante: p.visitante,
    santisoLocal: p.localPropio,
    golesLocal: p.golesLocal,
    golesVisitante: p.golesVisitante,
    resultado: resultadoSantiso(p.localPropio, p.golesLocal, p.golesVisitante),
  }));

  // Y en el archivo de temporadas pasadas, por el nombre del rival (de la misma categoría).
  if (!equipo.propio) {
    const archivo = await db
      .select({
        id: schema.rfgfHistoricoPartidos.id,
        temporada: schema.rfgfGruposHistoricos.temporada,
        competicion: schema.rfgfGruposHistoricos.competicion,
        jornada: schema.rfgfHistoricoPartidos.jornada,
        fecha: schema.rfgfHistoricoPartidos.fecha,
        fechaNominal: schema.rfgfHistoricoPartidos.fechaNominal,
        local: schema.rfgfHistoricoPartidos.local,
        visitante: schema.rfgfHistoricoPartidos.visitante,
        santisoLocal: schema.rfgfHistoricoPartidos.santisoLocal,
        golesLocal: schema.rfgfHistoricoPartidos.golesLocal,
        golesVisitante: schema.rfgfHistoricoPartidos.golesVisitante,
      })
      .from(schema.rfgfHistoricoPartidos)
      .innerJoin(
        schema.rfgfGruposHistoricos,
        eq(schema.rfgfGruposHistoricos.codGrupo, schema.rfgfHistoricoPartidos.codGrupo),
      )
      .where(sql`${schema.rfgfGruposHistoricos.categoria} = ${equipo.categoria}`);
    const clave = claveEquipo(equipo.nombre);
    const esEste = (nombre: string) =>
      claveEquipo(normalizarNombreEquipo(nombre, equipo.categoria)) === clave;
    for (const p of archivo) {
      if (!esEste(p.santisoLocal ? p.visitante : p.local)) continue;
      partidos.push({
        origen: "archivo",
        id: p.id,
        temporada: p.temporada,
        competicion: p.competicion,
        jornada: p.jornada,
        fecha: p.fecha ?? p.fechaNominal,
        local: p.local,
        visitante: p.visitante,
        santisoLocal: p.santisoLocal,
        golesLocal: p.golesLocal,
        golesVisitante: p.golesVisitante,
        resultado: resultadoSantiso(p.santisoLocal, p.golesLocal, p.golesVisitante),
      });
    }
  }
  partidos.sort(
    (a, b) =>
      b.temporada.localeCompare(a.temporada) ||
      (b.fecha ?? "").localeCompare(a.fecha ?? "") ||
      b.jornada - a.jornada,
  );

  return {
    equipo: {
      id: equipo.id,
      nombre: equipo.nombre,
      categoria: equipo.categoria,
      escudoUrl: escudoUrl(equipo.escudo),
      propio: equipo.propio,
      color: equipo.color,
      color2: equipo.color2,
      colorFederacion: equipo.colorFederacion,
    },
    club,
    campoHabitual: campo ? { ...campo, partidos: Number(campo.partidos) } : null,
    temporada,
    contraSantiso: { partidos, totales: totalesCaraACara(partidos) },
  };
}

/* ───────────────────────────── Ficha de jugador ───────────────────────────── */

/** Las cifras oficiales de un jugador en un grupo de una temporada. */
export interface TemporadaOficial {
  /** «2025-2026». */
  temporada: string;
  categoria: Categoria;
  competicion: string;
  /** Vacío en la temporada activa (la competición ya dice el grupo). */
  grupo: string;
  origen: "actual" | "archivo";
  /** `null` hasta leer su página en la federación. */
  cifras: CifrasRfgf | null;
  leidoEn: string | null;
}

/** Un equipo (que no es el Santiso) en el que aparece un jugador del club en alguna acta. */
export interface ClubVisto {
  /** «2025-2026». */
  temporada: string;
  competicion: string;
  equipo: string;
  /** El equipo del catálogo, si es de la temporada activa. */
  equipoId: string | null;
  /** Actas en las que sale en la alineación (titular o suplente). */
  alineaciones: number;
  /** Goles y tarjetas en actas, aunque no se tenga su alineación. */
  eventos: number;
}

export interface FichaCompletaDeJugador {
  jugador: {
    id: string;
    nombre: string;
    apodo: string | null;
    fechaNacimiento: string | null;
    posicionesConocidas: string[];
    /** Una línea por temporada: «25/26: Club». */
    historial: string[];
    /** La foto más reciente. */
    fotoUrl: string | null;
    /** Sus temporadas en el Studio, de la más reciente a la más antigua. */
    inscripciones: {
      temporada: string;
      categoria: Categoria;
      dorsal: number | null;
      posicion: string | null;
    }[];
    /** Sus códigos en la federación (uno por competición en la que se le vio). */
    codigosRfgf: string[];
  };
  /** La temporada activa partido a partido, una por categoría en la que está inscrito. */
  actual: { temporadaId: string; categoria: Categoria; ficha: FichaJugador }[];
  /** Todas las temporadas según la federación, de la más reciente a la más antigua. */
  temporadas: {
    temporada: string;
    grupos: TemporadaOficial[];
    /** Suma de los grupos ya leídos. */
    total: CifrasRfgf;
  }[];
  /** Suma de todo lo leído. */
  total: CifrasRfgf;
  /** Grupos con su página todavía por leer. */
  porLeer: number;
  /** Otros equipos en los que se le ha visto en actas, de lo más reciente a lo más antiguo. */
  clubesVistos: ClubVisto[];
}

/**
 * Las claves de nombre con las que puede salir un jugador en las actas: su nombre en el Studio
 * y el que le da la federación («APELLIDOS, NOMBRE» → «Nombre Apellidos»).
 */
export function clavesDeJugador(nombre: string, nombresRfgf: readonly string[]): string[] {
  const claves = new Set<string>();
  const propia = claveNombre(nombre);
  // Un nombre de una sola palabra («Rubén») casaría con cualquiera: no vale para buscar.
  if (propia.split(" ").length >= 2) claves.add(propia);
  for (const oficial of nombresRfgf) {
    const clave = claveNombre(personaDeActa(oficial));
    if (clave.split(" ").length >= 2) claves.add(clave);
  }
  return [...claves];
}

/**
 * La ficha completa de un jugador: datos personales, la temporada activa partido a partido,
 * todas sus temporadas con las cifras oficiales y los otros equipos en los que se le ha visto
 * en actas. `null` si no existe. Solo lee.
 */
export async function fichaCompletaDeJugador(
  jugadorId: string,
): Promise<FichaCompletaDeJugador | null> {
  const { db } = await obtenerDb();
  const [persona] = await db
    .select()
    .from(schema.jugadores)
    .where(eq(schema.jugadores.id, jugadorId));
  if (!persona) return null;

  const inscripciones = await db
    .select({
      temporadaId: schema.temporadas.id,
      temporada: schema.temporadas.nombre,
      activa: schema.temporadas.activa,
      categoria: schema.jugadoresTemporada.categoria,
      dorsal: schema.jugadoresTemporada.dorsal,
      posicion: schema.jugadoresTemporada.posicion,
      foto: schema.jugadoresTemporada.foto,
    })
    .from(schema.jugadoresTemporada)
    .innerJoin(schema.temporadas, eq(schema.temporadas.id, schema.jugadoresTemporada.temporadaId))
    .where(eq(schema.jugadoresTemporada.jugadorId, jugadorId))
    .orderBy(desc(schema.temporadas.nombre), asc(schema.jugadoresTemporada.categoria));

  const actual: FichaCompletaDeJugador["actual"] = [];
  for (const inscripcion of inscripciones.filter((i) => i.activa)) {
    const ficha = await fichaDeJugador({
      jugadorId,
      temporadaId: inscripcion.temporadaId,
      categoria: inscripcion.categoria,
    });
    if (ficha)
      actual.push({
        temporadaId: inscripcion.temporadaId,
        categoria: inscripcion.categoria,
        ficha,
      });
  }

  // La temporada activa según la federación: una fila por competición en la que se le vio.
  const oficiales = await db
    .select({
      codigo: schema.rfgfJugadores.codigo,
      nombre: schema.rfgfJugadores.nombre,
      temporada: schema.temporadas.nombre,
      categoria: schema.competiciones.categoria,
      competicion: schema.competiciones.nombre,
      cifras: schema.rfgfJugadores.cifras,
      leidoEn: schema.rfgfJugadores.leidoEn,
    })
    .from(schema.rfgfJugadores)
    .innerJoin(
      schema.competiciones,
      eq(schema.competiciones.id, schema.rfgfJugadores.competicionId),
    )
    .innerJoin(schema.temporadas, eq(schema.temporadas.id, schema.competiciones.temporadaId))
    .where(eq(schema.rfgfJugadores.jugadorId, jugadorId));
  // Las pasadas: una fila por grupo del archivo.
  const pasadas = await db
    .select({
      temporada: schema.rfgfGruposHistoricos.temporada,
      categoria: schema.rfgfGruposHistoricos.categoria,
      competicion: schema.rfgfGruposHistoricos.competicion,
      grupo: schema.rfgfGruposHistoricos.grupo,
      cifras: schema.rfgfHistorico.cifras,
      leidoEn: schema.rfgfHistorico.leidoEn,
    })
    .from(schema.rfgfHistorico)
    .innerJoin(
      schema.rfgfGruposHistoricos,
      eq(schema.rfgfGruposHistoricos.codGrupo, schema.rfgfHistorico.codGrupo),
    )
    .where(eq(schema.rfgfHistorico.jugadorId, jugadorId));

  const grupos: TemporadaOficial[] = [
    ...oficiales.map((o) => ({
      temporada: temporadaDeFederacion(o.temporada) ?? o.temporada,
      categoria: o.categoria,
      competicion: o.competicion,
      grupo: "",
      origen: "actual" as const,
      cifras: o.cifras ?? null,
      leidoEn: o.leidoEn,
    })),
    // Un grupo leído sin convocatorias no es una temporada suya: se queda fuera.
    ...pasadas
      .filter((p) => !p.cifras || p.cifras.convocados > 0)
      .map((p) => ({
        temporada: p.temporada,
        categoria: p.categoria as Categoria,
        competicion: p.competicion,
        grupo: p.grupo,
        origen: "archivo" as const,
        cifras: p.cifras ?? null,
        leidoEn: p.leidoEn,
      })),
  ];
  const porTemporada = new Map<string, TemporadaOficial[]>();
  for (const g of grupos)
    porTemporada.set(g.temporada, [...(porTemporada.get(g.temporada) ?? []), g]);
  const temporadas = [...porTemporada]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([temporada, lista]) => ({
      temporada,
      grupos: lista.sort((a, b) => a.competicion.localeCompare(b.competicion, "es")),
      total: sumarCifras(lista.flatMap((g) => (g.cifras ? [g.cifras] : []))),
    }));

  const claves = clavesDeJugador(
    persona.nombre,
    oficiales.map((o) => o.nombre),
  );
  const clubesVistos = claves.length ? await clubesVistosDe(claves) : [];
  const conFoto = inscripciones.find((i) => i.foto);

  return {
    jugador: {
      id: persona.id,
      nombre: persona.nombre,
      apodo: persona.apodo,
      fechaNacimiento: persona.fechaNacimiento,
      posicionesConocidas: persona.posicionesConocidas,
      historial: persona.historial ?? [],
      fotoUrl: conFoto?.foto ? urlMedia(conFoto.foto) : null,
      inscripciones: inscripciones.map((i) => ({
        temporada: i.temporada,
        categoria: i.categoria,
        dorsal: i.dorsal,
        posicion: i.posicion,
      })),
      codigosRfgf: [...new Set(oficiales.map((o) => o.codigo))],
    },
    actual,
    temporadas,
    total: sumarCifras(grupos.flatMap((g) => (g.cifras ? [g.cifras] : []))),
    porLeer: grupos.filter((g) => !g.leidoEn).length,
    clubesVistos,
  };
}

/**
 * Los otros equipos en cuyas actas sale alguien con esas claves de nombre: alineaciones y
 * goles o tarjetas de la liga actual y del archivo. Del Santiso no: eso ya es su ficha.
 */
async function clubesVistosDe(claves: readonly string[]): Promise<ClubVisto[]> {
  const { db } = await obtenerDb();
  const vistos = new Map<string, ClubVisto & { actas: Set<string> }>();
  const apuntar = (
    fila: { temporada: string; competicion: string; equipo: string; equipoId: string | null },
    partidoId: string,
    tipo: "alineacion" | "evento",
  ) => {
    const clave = `${fila.temporada}|${fila.competicion}|${claveEquipo(fila.equipo)}`;
    const visto = vistos.get(clave) ?? {
      ...fila,
      alineaciones: 0,
      eventos: 0,
      actas: new Set<string>(),
    };
    if (tipo === "alineacion") {
      if (!visto.actas.has(partidoId)) visto.alineaciones++;
      visto.actas.add(partidoId);
    } else visto.eventos++;
    vistos.set(clave, visto);
  };

  // Liga del Studio: alineaciones y eventos de equipos ajenos.
  for (const [tabla, tipo] of [
    [schema.ligaAlineaciones, "alineacion"],
    [schema.ligaEventos, "evento"],
  ] as const) {
    const filas = await db
      .select({
        partidoId: tabla.partidoId,
        equipoId: schema.equipos.id,
        equipo: schema.equipos.nombre,
        competicion: schema.competiciones.nombre,
        temporada: schema.temporadas.nombre,
      })
      .from(tabla)
      .innerJoin(schema.equipos, eq(schema.equipos.id, tabla.equipoId))
      .innerJoin(schema.partidos, eq(schema.partidos.id, tabla.partidoId))
      .innerJoin(schema.jornadas, eq(schema.jornadas.id, schema.partidos.jornadaId))
      .innerJoin(schema.competiciones, eq(schema.competiciones.id, schema.jornadas.competicionId))
      .innerJoin(schema.temporadas, eq(schema.temporadas.id, schema.competiciones.temporadaId))
      .where(and(inArray(tabla.personaClave, [...claves]), eq(schema.equipos.esPropio, false)));
    for (const f of filas)
      apuntar(
        {
          temporada: temporadaDeFederacion(f.temporada) ?? f.temporada,
          competicion: f.competicion,
          equipo: f.equipo,
          equipoId: f.equipoId,
        },
        f.partidoId,
        tipo,
      );
  }

  // Archivo: el lado que no es el Santiso.
  for (const [tabla, tipo] of [
    [schema.rfgfHistoricoAlineaciones, "alineacion"],
    [schema.rfgfHistoricoEventos, "evento"],
  ] as const) {
    const filas = await db
      .select({
        partidoId: tabla.partidoId,
        lado: tabla.lado,
        local: schema.rfgfHistoricoPartidos.local,
        visitante: schema.rfgfHistoricoPartidos.visitante,
        santisoLocal: schema.rfgfHistoricoPartidos.santisoLocal,
        competicion: schema.rfgfGruposHistoricos.competicion,
        temporada: schema.rfgfGruposHistoricos.temporada,
      })
      .from(tabla)
      .innerJoin(schema.rfgfHistoricoPartidos, eq(schema.rfgfHistoricoPartidos.id, tabla.partidoId))
      .innerJoin(
        schema.rfgfGruposHistoricos,
        eq(schema.rfgfGruposHistoricos.codGrupo, schema.rfgfHistoricoPartidos.codGrupo),
      )
      .where(
        and(
          inArray(tabla.personaClave, [...claves]),
          sql`(${tabla.lado} = 'local') <> ${schema.rfgfHistoricoPartidos.santisoLocal}`,
        ),
      );
    for (const f of filas)
      apuntar(
        {
          temporada: f.temporada,
          competicion: f.competicion,
          equipo: f.lado === "local" ? f.local : f.visitante,
          equipoId: null,
        },
        f.partidoId,
        tipo,
      );
  }

  return [...vistos.values()]
    .map(({ actas: _actas, ...visto }) => visto)
    .sort(
      (a, b) =>
        b.temporada.localeCompare(a.temporada) ||
        a.competicion.localeCompare(b.competicion, "es") ||
        a.equipo.localeCompare(b.equipo, "es"),
    );
}

/* ───────────────────────────── Archivo ───────────────────────────── */

export interface PartidoDeArchivo {
  id: string;
  jornada: number;
  fechaNominal: string;
  fecha: string | null;
  local: string;
  visitante: string;
  santisoLocal: boolean;
  golesLocal: number | null;
  golesVisitante: number | null;
  resultado: ResultadoSantiso | null;
  estado: (typeof schema.ESTADOS_PARTIDO_HISTORICO)[number];
  aviso: string;
  /** El PDF del acta en la federación, si se conoce su código. */
  enlaceActa: string | null;
}

export interface GrupoDeArchivo {
  codGrupo: string;
  categoria: Categoria;
  competicion: string;
  grupo: string;
  /** El repaso de cifras de jugadores: «pendiente», «listo» o «sin_acta». */
  estado: (typeof schema.ESTADOS_GRUPO_HISTORICO)[number];
  /** Jugadores del club apuntados en el grupo y cuántos con cifras ya leídas. */
  jugadores: number;
  conCifras: number;
  /** El archivo de partidos: si se pidió y cómo va. */
  archivo: ReturnType<typeof resumenPartidosHistoricos>;
  partidos: PartidoDeArchivo[];
}

export interface TemporadaDeArchivo {
  /** «2025-2026». */
  temporada: string;
  grupos: GrupoDeArchivo[];
}

export type ArchivoHistorico = TemporadaDeArchivo[];

/**
 * El archivo de temporadas pasadas: temporada → grupos del club → sus partidos guardados, con
 * el estado de cada cosa. Sin las filas de control internas. Solo lee.
 */
export async function archivoHistorico(): Promise<ArchivoHistorico> {
  const { db } = await obtenerDb();
  const grupos = await db
    .select()
    .from(schema.rfgfGruposHistoricos)
    .where(ne(schema.rfgfGruposHistoricos.temporada, ""))
    .orderBy(
      desc(schema.rfgfGruposHistoricos.temporada),
      asc(schema.rfgfGruposHistoricos.categoria),
      asc(schema.rfgfGruposHistoricos.competicion),
      asc(schema.rfgfGruposHistoricos.codGrupo),
    );
  const cuentas = await db
    .select({
      codGrupo: schema.rfgfHistorico.codGrupo,
      jugadores: sql<number>`count(*)`,
      conCifras: sql<number>`sum(case when ${schema.rfgfHistorico.cifras} is not null then 1 else 0 end)`,
    })
    .from(schema.rfgfHistorico)
    .groupBy(schema.rfgfHistorico.codGrupo);
  const partidos = await db
    .select()
    .from(schema.rfgfHistoricoPartidos)
    .orderBy(
      asc(schema.rfgfHistoricoPartidos.jornada),
      asc(schema.rfgfHistoricoPartidos.fechaNominal),
    );

  const porTemporada = new Map<string, GrupoDeArchivo[]>();
  for (const grupo of grupos) {
    const suyos = partidos.filter((p) => p.codGrupo === grupo.codGrupo);
    const cuenta = cuentas.find((c) => c.codGrupo === grupo.codGrupo);
    const codTemporada = codigoDeTemporada(grupo.temporada);
    const enlace = (codActa: string | null) =>
      codActa && codTemporada
        ? urlActaPdf(
            {
              codPrimaria: "1000120",
              codTemporada,
              codCompeticion: grupo.codCompeticion,
              codGrupo: grupo.codGrupo,
            },
            codActa,
          )
        : null;
    const fila: GrupoDeArchivo = {
      codGrupo: grupo.codGrupo,
      categoria: grupo.categoria as Categoria,
      competicion: grupo.competicion,
      grupo: grupo.grupo,
      estado: grupo.estado,
      jugadores: Number(cuenta?.jugadores ?? 0),
      conCifras: Number(cuenta?.conCifras ?? 0),
      archivo: resumenPartidosHistoricos(grupo, suyos),
      partidos: suyos.map((p) => ({
        id: p.id,
        jornada: p.jornada,
        fechaNominal: p.fechaNominal,
        fecha: p.fecha,
        local: p.local,
        visitante: p.visitante,
        santisoLocal: p.santisoLocal,
        golesLocal: p.golesLocal,
        golesVisitante: p.golesVisitante,
        resultado: resultadoSantiso(p.santisoLocal, p.golesLocal, p.golesVisitante),
        estado: p.estado,
        aviso: p.aviso,
        enlaceActa: enlace(p.codActa),
      })),
    };
    porTemporada.set(grupo.temporada, [...(porTemporada.get(grupo.temporada) ?? []), fila]);
  }
  return [...porTemporada].map(([temporada, lista]) => ({ temporada, grupos: lista }));
}
