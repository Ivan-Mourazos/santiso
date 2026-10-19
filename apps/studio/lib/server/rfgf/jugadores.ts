import { jugadoresDeActaHtml, parsearEstadisticasJugador } from "@santiso/actas";
import { schema } from "@santiso/db";
import { aliasedTable, and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";

import { jugadorSeguro } from "@/lib/actas/enlazar";
import { urlActaWeb, urlEstadisticasJugador, type GrupoRfgf } from "@/lib/rfgf/enlace";
import { obtenerDb } from "@/lib/server/db";
import type { DescargadorRfgf } from "@/lib/server/rfgf/descargador";

/**
 * Cuántas páginas de jugador se leen por pasada y competición. Pocas a propósito: la
 * federación deja de responder tras una ráfaga, y estas cifras no corren prisa. Con una pasada
 * al día, una plantilla de veinte se repasa en menos de una semana.
 */
export const JUGADORES_POR_PASADA = 4;

/** El último partido del club con acta en la federación, y de qué lado jugó. */
async function ultimaActaPropia(competicionId: string) {
  const { db } = await obtenerDb();
  const local = aliasedTable(schema.equipos, "local");
  const visitante = aliasedTable(schema.equipos, "visitante");
  const [fila] = await db
    .select({
      codActa: schema.rfgfActas.codActa,
      localPropio: local.esPropio,
    })
    .from(schema.rfgfActas)
    .innerJoin(schema.partidos, eq(schema.partidos.id, schema.rfgfActas.partidoId))
    .innerJoin(local, eq(local.id, schema.partidos.equipoLocalId))
    .innerJoin(visitante, eq(visitante.id, schema.partidos.equipoVisitanteId))
    .where(
      and(
        eq(schema.rfgfActas.competicionId, competicionId),
        isNotNull(schema.partidos.golesLocal),
        sql`(${local.esPropio} = 1 or ${visitante.esPropio} = 1)`,
      ),
    )
    .orderBy(desc(schema.partidos.fecha))
    .limit(1);
  return fila
    ? {
        codActa: fila.codActa,
        lado: fila.localPropio ? ("local" as const) : ("visitante" as const),
      }
    : null;
}

/** La plantilla de la categoría en la temporada activa, para reconocer los nombres. */
export async function plantillaDe(categoria: string) {
  const { db } = await obtenerDb();
  return db
    .select({
      id: schema.jugadores.id,
      nombre: schema.jugadores.nombre,
      apodo: schema.jugadores.apodo,
    })
    .from(schema.jugadoresTemporada)
    .innerJoin(schema.jugadores, eq(schema.jugadores.id, schema.jugadoresTemporada.jugadorId))
    .innerJoin(schema.temporadas, eq(schema.temporadas.id, schema.jugadoresTemporada.temporadaId))
    .where(
      and(
        eq(schema.temporadas.activa, true),
        sql`${schema.jugadoresTemporada.categoria} = ${categoria}`,
      ),
    );
}

/**
 * Lee la página web de un acta del club (una página) y apunta a sus jugadores con su código en
 * `rfgf_jugadores`, enlazados con la plantilla si el nombre se reconoce sin duda. Deja el acta
 * marcada para no volver a leerla con este fin.
 */
export async function apuntarJugadoresDeActa(
  competicionId: string,
  categoria: string,
  grupo: GrupoRfgf,
  acta: { codActa: string; lado: "local" | "visitante" },
  descargador: DescargadorRfgf,
  ahora: Date,
): Promise<number> {
  const { db } = await obtenerDb();
  const html = await descargador.html(urlActaWeb(grupo, acta.codActa));
  const propios = jugadoresDeActaHtml(html).filter((jugador) => jugador.lado === acta.lado);
  const plantilla = await plantillaDe(categoria);
  for (const jugador of propios) {
    const reconocido = jugadorSeguro(jugador.nombre, plantilla);
    await db
      .insert(schema.rfgfJugadores)
      .values({
        codigo: jugador.codigo,
        competicionId,
        jugadorId: reconocido?.id ?? null,
        nombre: jugador.nombre,
        codActa: acta.codActa,
      })
      .onConflictDoUpdate({
        target: [schema.rfgfJugadores.codigo, schema.rfgfJugadores.competicionId],
        set: {
          nombre: jugador.nombre,
          codActa: acta.codActa,
          // Un jugador ya enlazado no se desenlaza porque hoy el nombre no se reconozca.
          ...(reconocido ? { jugadorId: reconocido.id } : {}),
          actualizadoEn: ahora.toISOString(),
        },
      });
  }
  await db
    .update(schema.rfgfActas)
    .set({ jugadoresEn: ahora.toISOString() })
    .where(eq(schema.rfgfActas.codActa, acta.codActa));
  return propios.length;
}

/**
 * Trae de la federación las cifras oficiales de los jugadores del club en una competición.
 * Primero apunta quién jugó el último partido (una página, y solo si ese partido es nuevo);
 * después lee la página de unos pocos jugadores, empezando por los que llevan más sin leerse.
 * Devuelve cuántos jugadores se leyeron.
 */
export async function sincronizarJugadores(
  competicionId: string,
  categoria: string,
  grupo: GrupoRfgf,
  descargador: DescargadorRfgf,
  ahora: Date,
): Promise<number> {
  const { db } = await obtenerDb();
  const acta = await ultimaActaPropia(competicionId);
  if (!acta) return 0;

  const [yaVista] = await db
    .select({ codigo: schema.rfgfJugadores.codigo })
    .from(schema.rfgfJugadores)
    .where(
      and(
        eq(schema.rfgfJugadores.competicionId, competicionId),
        eq(schema.rfgfJugadores.codActa, acta.codActa),
      ),
    )
    .limit(1);
  const [repasada] = await db
    .select({ jugadoresEn: schema.rfgfActas.jugadoresEn })
    .from(schema.rfgfActas)
    .where(eq(schema.rfgfActas.codActa, acta.codActa));
  if (!yaVista && !repasada?.jugadoresEn)
    await apuntarJugadoresDeActa(competicionId, categoria, grupo, acta, descargador, ahora);

  // Los que nunca se leyeron van primero (en SQLite los nulos ordenan antes).
  const pendientes = await db
    .select({ codigo: schema.rfgfJugadores.codigo, codActa: schema.rfgfJugadores.codActa })
    .from(schema.rfgfJugadores)
    .where(eq(schema.rfgfJugadores.competicionId, competicionId))
    .orderBy(asc(schema.rfgfJugadores.leidoEn))
    .limit(JUGADORES_POR_PASADA);
  let leidos = 0;
  for (const pendiente of pendientes) {
    const cifras = parsearEstadisticasJugador(
      await descargador.html(urlEstadisticasJugador(pendiente.codigo, pendiente.codActa)),
    );
    await db
      .update(schema.rfgfJugadores)
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
          eq(schema.rfgfJugadores.codigo, pendiente.codigo),
          eq(schema.rfgfJugadores.competicionId, competicionId),
        ),
      );
    leidos++;
  }
  return leidos;
}
