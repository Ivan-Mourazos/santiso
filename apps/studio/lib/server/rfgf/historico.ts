import {
  codigoDeTemporada,
  gruposDeEquipoHtml,
  parsearEstadisticasJugador,
  partidosConCodigos,
} from "@santiso/actas";
import { schema } from "@santiso/db";
import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import {
  grupoDeEnlace,
  urlCompeticionesDeEquipo,
  urlEstadisticasJugador,
  urlJornada,
} from "@/lib/rfgf/enlace";
import { filasDeHistorial, normalizarTemporada, textoDeHistorial } from "@/lib/plantilla/historial";
import { obtenerDb } from "@/lib/server/db";
import type { DescargadorRfgf } from "@/lib/server/rfgf/descargador";

/** Cuántas temporadas atrás se traen (decisión del usuario, 13/10/2026). */
export const TEMPORADAS_ATRAS = 5;
/** Jornadas que se miran buscando un partido del club antes de dar el grupo por perdido. */
const INTENTOS_GRUPO = 3;

/** «2026-2027» → 2026. */
const inicioDe = (temporada: string) => Number(temporada.slice(0, 4));

/**
 * Apunta los grupos de las temporadas pasadas de cada equipo del club. Una sola vez por
 * categoría: dos páginas (la jornada actual, para saber el código del equipo, y su lista de
 * competiciones). Devuelve cuántas páginas pidió.
 */
async function descubrirGrupos(descargador: DescargadorRfgf): Promise<number> {
  const { db } = await obtenerDb();
  const enlazadas = await db
    .select({
      competicionId: schema.rfgfCompeticiones.competicionId,
      enlace: schema.rfgfCompeticiones.enlace,
      categoria: schema.competiciones.categoria,
    })
    .from(schema.rfgfCompeticiones)
    .innerJoin(
      schema.competiciones,
      eq(schema.competiciones.id, schema.rfgfCompeticiones.competicionId),
    );
  const hechas = new Set(
    (
      await db
        .selectDistinct({ categoria: schema.rfgfGruposHistoricos.categoria })
        .from(schema.rfgfGruposHistoricos)
    ).map((fila) => fila.categoria),
  );
  for (const enlazada of enlazadas) {
    const grupo = grupoDeEnlace(enlazada.enlace);
    if (!grupo || hechas.has(enlazada.categoria)) continue;
    // El código del equipo del club: el que juega un partido propio en la jornada 1.
    const propios = await db
      .select({ nombre: schema.equipos.nombre })
      .from(schema.equipos)
      .where(
        and(
          eq(schema.equipos.esPropio, true),
          sql`${schema.equipos.categoria} = ${enlazada.categoria}`,
        ),
      );
    const clave = (nombre: string) => nombre.toUpperCase().replace(/[^A-Z0-9]/gu, "");
    const nombres = new Set(propios.map((equipo) => clave(equipo.nombre)));
    const jornada = partidosConCodigos(await descargador.html(urlJornada(grupo, 1)));
    const partido = jornada.find(
      (p) => nombres.has(clave(p.local)) || nombres.has(clave(p.visitante)),
    );
    if (!partido) {
      await db
        .insert(schema.rfgfGruposHistoricos)
        .values({
          codGrupo: `sin-equipo-${enlazada.categoria}`,
          categoria: enlazada.categoria,
          temporada: "",
          competicion: "",
          grupo: "",
          codCompeticion: "",
          codEquipo: "",
          estado: "sin_acta",
        })
        .onConflictDoNothing();
      return 1;
    }
    const codEquipo = nombres.has(clave(partido.local)) ? partido.codLocal : partido.codVisitante;
    const todos = gruposDeEquipoHtml(
      await descargador.html(urlCompeticionesDeEquipo(codEquipo, grupo.codTemporada)),
    );
    const actual = Math.max(...todos.map((g) => inicioDe(g.temporada)));
    const pasados = todos.filter((g) => {
      const inicio = inicioDe(g.temporada);
      return inicio < actual && inicio >= actual - TEMPORADAS_ATRAS;
    });
    for (const pasado of pasados) {
      await db
        .insert(schema.rfgfGruposHistoricos)
        .values({
          codGrupo: pasado.codGrupo,
          categoria: enlazada.categoria,
          temporada: pasado.temporada,
          competicion: pasado.competicion,
          grupo: pasado.grupo,
          codCompeticion: pasado.codCompeticion,
          codEquipo,
        })
        .onConflictDoNothing();
    }
    // Sin temporadas pasadas, una fila centinela evita volver a preguntar cada vez.
    if (pasados.length === 0) {
      await db
        .insert(schema.rfgfGruposHistoricos)
        .values({
          codGrupo: `sin-pasado-${enlazada.categoria}`,
          categoria: enlazada.categoria,
          temporada: "",
          competicion: "",
          grupo: "",
          codCompeticion: "",
          codEquipo,
          estado: "sin_acta",
        })
        .onConflictDoNothing();
    }
    return 2;
  }
  return 0;
}

/** Busca un partido del club en el grupo y, con él, apunta a qué jugadores hay que mirar. */
async function prepararGrupo(descargador: DescargadorRfgf, ahora: Date): Promise<number> {
  const { db } = await obtenerDb();
  const [grupo] = await db
    .select()
    .from(schema.rfgfGruposHistoricos)
    .where(eq(schema.rfgfGruposHistoricos.estado, "pendiente"))
    .orderBy(sql`${schema.rfgfGruposHistoricos.temporada} desc`)
    .limit(1);
  if (!grupo) return 0;
  // Solo los jugadores de hoy que la federación ya tiene identificados, y de esa categoría.
  const jugadores = await db
    .selectDistinct({
      jugadorId: schema.rfgfJugadores.jugadorId,
      codigo: schema.rfgfJugadores.codigo,
    })
    .from(schema.rfgfJugadores)
    .innerJoin(
      schema.competiciones,
      eq(schema.competiciones.id, schema.rfgfJugadores.competicionId),
    )
    .where(
      and(
        isNotNull(schema.rfgfJugadores.jugadorId),
        sql`${schema.competiciones.categoria} = ${grupo.categoria}`,
      ),
    );
  // Sin jugadores identificados todavía, el grupo espera (sin gastar consultas): llegarán con
  // la comprobación diaria.
  if (jugadores.length === 0) return 0;
  const codTemporada = codigoDeTemporada(grupo.temporada);
  const jornada = grupo.intentos + 1;
  const partidos = codTemporada
    ? partidosConCodigos(
        await descargador.html(
          urlJornada(
            {
              codPrimaria: "1000120",
              codTemporada,
              codCompeticion: grupo.codCompeticion,
              codGrupo: grupo.codGrupo,
            },
            jornada,
          ),
        ),
      )
    : [];
  const partido = partidos.find(
    (p) => p.codLocal === grupo.codEquipo || p.codVisitante === grupo.codEquipo,
  );
  if (!partido) {
    await db
      .update(schema.rfgfGruposHistoricos)
      .set({
        intentos: jornada,
        estado: jornada >= INTENTOS_GRUPO || !codTemporada ? "sin_acta" : "pendiente",
        actualizadoEn: ahora.toISOString(),
      })
      .where(eq(schema.rfgfGruposHistoricos.codGrupo, grupo.codGrupo));
    return 1;
  }
  for (const jugador of jugadores) {
    await db
      .insert(schema.rfgfHistorico)
      .values({ jugadorId: jugador.jugadorId!, codGrupo: grupo.codGrupo, codigo: jugador.codigo })
      .onConflictDoNothing();
  }
  await db
    .update(schema.rfgfGruposHistoricos)
    .set({ codActa: partido.codActa, estado: "listo", actualizadoEn: ahora.toISOString() })
    .where(eq(schema.rfgfGruposHistoricos.codGrupo, grupo.codGrupo));
  return 1;
}

/** «2025-2026» → «25/26». */
const temporadaCorta = (temporada: string) => normalizarTemporada(temporada.replace("-", "/"));

/**
 * Si el jugador estuvo convocado esa temporada y su historial no la tiene, se le añade la
 * fila «25/26: (club)». Nunca se toca una temporada que ya esté escrita.
 */
async function anotarEnHistorial(jugadorId: string, temporada: string, club: string) {
  const corta = temporadaCorta(temporada);
  if (!corta) return;
  const { db } = await obtenerDb();
  const [persona] = await db
    .select({ historial: schema.jugadores.historial })
    .from(schema.jugadores)
    .where(eq(schema.jugadores.id, jugadorId));
  if (!persona) return;
  const filas = filasDeHistorial((persona.historial ?? []).join("\n"));
  if (filas.some((fila) => fila.temporada === corta)) return;
  const nuevas = [...filas, { temporada: corta, equipo: club }].sort((a, b) => {
    // De la más reciente a la más antigua; las líneas sin temporada, al final.
    const anio = (t: string) => (t ? (Number(t.slice(0, 2)) + 50) % 100 : -1);
    return anio(b.temporada) - anio(a.temporada);
  });
  await db
    .update(schema.jugadores)
    .set({ historial: textoDeHistorial(nuevas).split("\n") })
    .where(eq(schema.jugadores.id, jugadorId));
}

/** Lee la página de un jugador en un grupo pasado. */
async function leerUno(descargador: DescargadorRfgf, ahora: Date): Promise<number> {
  const { db } = await obtenerDb();
  const [pendiente] = await db
    .select({
      jugadorId: schema.rfgfHistorico.jugadorId,
      codGrupo: schema.rfgfHistorico.codGrupo,
      codigo: schema.rfgfHistorico.codigo,
      codActa: schema.rfgfGruposHistoricos.codActa,
      temporada: schema.rfgfGruposHistoricos.temporada,
      categoria: schema.rfgfGruposHistoricos.categoria,
    })
    .from(schema.rfgfHistorico)
    .innerJoin(
      schema.rfgfGruposHistoricos,
      eq(schema.rfgfGruposHistoricos.codGrupo, schema.rfgfHistorico.codGrupo),
    )
    .where(and(isNull(schema.rfgfHistorico.leidoEn), isNotNull(schema.rfgfGruposHistoricos.codActa)))
    .orderBy(sql`${schema.rfgfGruposHistoricos.temporada} desc`, asc(schema.rfgfHistorico.codigo))
    .limit(1);
  if (!pendiente?.codActa) return 0;
  const cifras = parsearEstadisticasJugador(
    await descargador.html(urlEstadisticasJugador(pendiente.codigo, pendiente.codActa)),
  );
  await db
    .update(schema.rfgfHistorico)
    .set({
      cifras: {
        convocados: cifras.convocados,
        titular: cifras.titular,
        suplente: cifras.suplente,
        jugados: cifras.jugados,
        amarillas: cifras.amarillas,
        doblesAmarillas: cifras.doblesAmarillas,
        rojas: cifras.rojas,
        goles: cifras.goles,
      },
      leidoEn: ahora.toISOString(),
      actualizadoEn: ahora.toISOString(),
    })
    .where(
      and(
        eq(schema.rfgfHistorico.jugadorId, pendiente.jugadorId),
        eq(schema.rfgfHistorico.codGrupo, pendiente.codGrupo),
      ),
    );
  if (cifras.convocados > 0) {
    const [propio] = await db
      .select({ nombre: schema.equipos.nombre })
      .from(schema.equipos)
      .where(
        and(
          eq(schema.equipos.esPropio, true),
          sql`${schema.equipos.categoria} = ${pendiente.categoria}`,
        ),
      )
      .limit(1);
    await anotarEnHistorial(pendiente.jugadorId, pendiente.temporada, propio?.nombre ?? "Santiso");
  }
  return 1;
}

/**
 * Un paso del repaso de temporadas pasadas: como mucho `maximo` páginas de la federación.
 * Va poco a poco y en segundo plano: son cientos de páginas y una ráfaga haría que la web
 * dejase de responder. Devuelve cuántas pidió; 0 cuando ya no queda nada.
 */
export async function avanzarHistorico(
  descargador: DescargadorRfgf,
  ahora = new Date(),
  maximo = 2,
): Promise<number> {
  let pedidas = 0;
  while (pedidas < maximo) {
    const paso =
      (await leerUno(descargador, ahora)) ||
      (await prepararGrupo(descargador, ahora)) ||
      (await descubrirGrupos(descargador));
    if (!paso) break;
    pedidas += paso;
  }
  return pedidas;
}
