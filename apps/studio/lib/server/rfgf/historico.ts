import {
  codigoDeTemporada,
  gruposDeEquipoHtml,
  parsearEstadisticasJugador,
  partidosConCodigos,
} from "@santiso/actas";
import { schema } from "@santiso/db";
import { and, asc, eq, isNotNull, isNull, ne, notInArray, sql } from "drizzle-orm";

import {
  grupoDeEnlace,
  urlCompeticionesDeEquipo,
  urlEstadisticasJugador,
  urlJornada,
} from "@/lib/rfgf/enlace";
import { filasDeHistorial, normalizarTemporada, textoDeHistorial } from "@/lib/plantilla/historial";
import { obtenerDb } from "@/lib/server/db";
import type { DescargadorRfgf } from "@/lib/server/rfgf/descargador";
import { AVISO_RFGF_OCUPADA, conCandadoRfgf } from "./candado";
import {
  avanzarPartidosHistoricosSinCandado,
  resumenPartidosHistoricos,
} from "./historico-partidos";

/** Jornadas que se miran buscando un partido del club antes de dar el grupo por perdido. */
const INTENTOS_GRUPO = 3;

/** «2026-2027» → 2026. */
const inicioDe = (temporada: string) => Number(temporada.slice(0, 4));

/**
 * Apunta los grupos de todas las temporadas pasadas de cada equipo del club: la página
 * «competiciones del equipo» las trae todas de una vez (el Senior, desde 2014-2015). Una sola
 * vez por categoría, y queda anotado en `rfgf_equipos_club`. Si el código del equipo ya se
 * conoce (de un repaso anterior) basta esa página; si no, antes la jornada 1 para sacarlo.
 * Devuelve cuántas páginas pidió.
 */
async function descubrirGrupos(descargador: DescargadorRfgf, ahora: Date): Promise<number> {
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
      await db.select({ categoria: schema.rfgfEquiposClub.categoria }).from(schema.rfgfEquiposClub)
    ).map((fila) => fila.categoria),
  );
  for (const enlazada of enlazadas) {
    const grupo = grupoDeEnlace(enlazada.enlace);
    if (!grupo || hechas.has(enlazada.categoria)) continue;
    const anotar = (codEquipo: string) =>
      db
        .insert(schema.rfgfEquiposClub)
        .values({ categoria: enlazada.categoria, codEquipo, temporadasEn: ahora.toISOString() })
        .onConflictDoUpdate({
          target: schema.rfgfEquiposClub.categoria,
          set: { codEquipo, temporadasEn: ahora.toISOString() },
        });
    let paginas = 0;
    // El código del equipo, si un repaso anterior (el de cinco temporadas) ya lo apuntó.
    const [conocido] = await db
      .select({ codEquipo: schema.rfgfGruposHistoricos.codEquipo })
      .from(schema.rfgfGruposHistoricos)
      .where(
        and(
          sql`${schema.rfgfGruposHistoricos.categoria} = ${enlazada.categoria}`,
          ne(schema.rfgfGruposHistoricos.codEquipo, ""),
        ),
      )
      .limit(1);
    let codEquipo = conocido?.codEquipo ?? "";
    if (!codEquipo) {
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
      paginas++;
      const partido = jornada.find(
        (p) => nombres.has(clave(p.local)) || nombres.has(clave(p.visitante)),
      );
      // Sin el equipo en la jornada 1 no hay a quién preguntar: queda anotado para no repetir.
      if (!partido) {
        await anotar("");
        return paginas;
      }
      codEquipo = nombres.has(clave(partido.local)) ? partido.codLocal : partido.codVisitante;
    }
    const todos = gruposDeEquipoHtml(
      await descargador.html(urlCompeticionesDeEquipo(codEquipo, grupo.codTemporada)),
    );
    paginas++;
    const actual = Math.max(...todos.map((g) => inicioDe(g.temporada)));
    // Todas las pasadas, por antiguas que sean: el ritmo lo marca el repaso, no el plazo.
    for (const pasado of todos.filter((g) => inicioDe(g.temporada) < actual)) {
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
    await anotar(codEquipo);
    return paginas;
  }
  return 0;
}

/** Busca un partido del club en el grupo y, con él, apunta a qué jugadores hay que mirar. */
async function prepararGrupo(
  descargador: DescargadorRfgf,
  ahora: Date,
  opciones: OpcionesPaso,
): Promise<number> {
  const { db } = await obtenerDb();
  const [grupo] = await db
    .select()
    .from(schema.rfgfGruposHistoricos)
    .where(
      and(
        eq(schema.rfgfGruposHistoricos.estado, "pendiente"),
        opciones.codGrupo ? eq(schema.rfgfGruposHistoricos.codGrupo, opciones.codGrupo) : undefined,
        opciones.gruposVistos.length
          ? notInArray(schema.rfgfGruposHistoricos.codGrupo, opciones.gruposVistos)
          : undefined,
        // Una categoría sin jugadores identificados no bloquea las demás.
        sql`exists (select 1 from ${schema.rfgfJugadores} r join ${schema.competiciones} c on c.id = r.competicion_id where r.jugador_id is not null and c.categoria = ${schema.rfgfGruposHistoricos.categoria})`,
      ),
    )
    .orderBy(
      asc(schema.rfgfGruposHistoricos.actualizadoEn),
      sql`${schema.rfgfGruposHistoricos.temporada} desc`,
    )
    .limit(1);
  if (!grupo) return 0;
  opciones.gruposVistos.push(grupo.codGrupo);
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
  let partidos: ReturnType<typeof partidosConCodigos>;
  try {
    partidos = codTemporada
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
  } catch (error) {
    opciones.errores.push(
      `${grupo.temporada} ${grupo.competicion}: ${error instanceof Error ? error.message : "fallo desconocido"}`,
    );
    await db
      .update(schema.rfgfGruposHistoricos)
      .set({ actualizadoEn: ahora.toISOString() })
      .where(eq(schema.rfgfGruposHistoricos.codGrupo, grupo.codGrupo));
    return 1;
  }
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
    .set({
      codActa: partido.codActa,
      estado: "listo",
      intentos: jornada,
      actualizadoEn: ahora.toISOString(),
    })
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
async function leerUno(
  descargador: DescargadorRfgf,
  ahora: Date,
  opciones: OpcionesPaso,
): Promise<number> {
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
    .where(
      and(
        isNull(schema.rfgfHistorico.leidoEn),
        isNotNull(schema.rfgfGruposHistoricos.codActa),
        opciones.codGrupo ? eq(schema.rfgfHistorico.codGrupo, opciones.codGrupo) : undefined,
        opciones.jugadoresVistos.length
          ? notInArray(
              sql<string>`${schema.rfgfHistorico.codGrupo} || ':' || ${schema.rfgfHistorico.jugadorId}`,
              opciones.jugadoresVistos,
            )
          : undefined,
      ),
    )
    .orderBy(
      asc(schema.rfgfHistorico.actualizadoEn),
      sql`${schema.rfgfGruposHistoricos.temporada} desc`,
      asc(schema.rfgfHistorico.codigo),
    )
    .limit(1);
  if (!pendiente?.codActa) return 0;
  opciones.jugadoresVistos.push(`${pendiente.codGrupo}:${pendiente.jugadorId}`);
  let cifras: ReturnType<typeof parsearEstadisticasJugador>;
  try {
    cifras = parsearEstadisticasJugador(
      await descargador.html(urlEstadisticasJugador(pendiente.codigo, pendiente.codActa)),
    );
  } catch (error) {
    // No se inventan cifras ni se da por leído. Pasa detrás de los demás en la próxima tanda.
    opciones.errores.push(
      `${pendiente.temporada}, jugador ${pendiente.codigo}: ${error instanceof Error ? error.message : "fallo desconocido"}`,
    );
    await db
      .update(schema.rfgfHistorico)
      .set({ actualizadoEn: ahora.toISOString() })
      .where(
        and(
          eq(schema.rfgfHistorico.codGrupo, pendiente.codGrupo),
          eq(schema.rfgfHistorico.jugadorId, pendiente.jugadorId),
        ),
      );
    return 1;
  }
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
  return (
    (await conCandadoRfgf(async () => {
      const opciones: OpcionesPaso = { gruposVistos: [], jugadoresVistos: [], errores: [] };
      const limite = Number.isFinite(maximo) ? Math.max(0, Math.min(2, Math.floor(maximo))) : 2;
      // Alterna prioridad por tic para que ninguna cola espere a que se agote la otra.
      // El presupuesto sigue siendo dos páginas en total, bajo la misma reserva.
      const archivoPrimero = Math.floor(ahora.getTime() / 600_000) % 2 === 0;
      let paginas = archivoPrimero
        ? await avanzarPartidosHistoricosSinCandado(descargador, ahora, limite)
        : await avanzarSinCandado(descargador, ahora, limite, opciones);
      if (paginas < limite)
        paginas += archivoPrimero
          ? await avanzarSinCandado(descargador, ahora, limite - paginas, opciones)
          : await avanzarPartidosHistoricosSinCandado(descargador, ahora, limite - paginas);
      for (const error of opciones.errores) console.warn(`[rfgf] Histórico: ${error}`);
      return paginas;
    })) ?? 0
  );
}

interface OpcionesPaso {
  codGrupo?: string;
  gruposVistos: string[];
  jugadoresVistos: string[];
  errores: string[];
}

async function avanzarSinCandado(
  descargador: DescargadorRfgf,
  ahora: Date,
  maximo: number,
  opciones: OpcionesPaso,
): Promise<number> {
  // El descubrimiento tampoco espera a que todas las páginas de jugadores se puedan leer.
  // Se reserva su coste completo: nunca se empieza con solo una página de presupuesto.
  let pedidas = !opciones.codGrupo && maximo >= 2 ? await descubrirGrupos(descargador, ahora) : 0;
  while (pedidas < maximo) {
    // Preparar antes de leer: una página de jugador rota no deja esperando todos los grupos.
    const paso =
      (await prepararGrupo(descargador, ahora, opciones)) ||
      (await leerUno(descargador, ahora, opciones));
    if (!paso) break;
    pedidas += paso;
  }
  return pedidas;
}

/** Estado local, también de los grupos sin jugadores o que no tienen acta de referencia. */
export async function estadoHistorico() {
  const { db } = await obtenerDb();
  const grupos = await db
    .select()
    .from(schema.rfgfGruposHistoricos)
    .orderBy(
      sql`${schema.rfgfGruposHistoricos.temporada} desc`,
      asc(schema.rfgfGruposHistoricos.categoria),
      asc(schema.rfgfGruposHistoricos.codGrupo),
    );
  const jugadores = await db
    .select({ codGrupo: schema.rfgfHistorico.codGrupo, cifras: schema.rfgfHistorico.cifras })
    .from(schema.rfgfHistorico);
  const partidos = await db.select().from(schema.rfgfHistoricoPartidos);
  return grupos.map((grupo) => ({
    ...grupo,
    jugadores: jugadores.filter((j) => j.codGrupo === grupo.codGrupo).length,
    conCifras: jugadores.filter((j) => j.codGrupo === grupo.codGrupo && j.cifras !== null).length,
    archivoPartidos: resumenPartidosHistoricos(
      grupo,
      partidos.filter((p) => p.codGrupo === grupo.codGrupo),
    ),
  }));
}

export interface ResumenHistoricoRfgf {
  codGrupo: string;
  paginas: number;
  jugadores: number;
  avisos: string[];
  errores: string[];
}

/** Avanza exclusivamente este grupo. Dos páginas como máximo, incluidos los intentos fallidos. */
export async function traerTemporadaHistorica(
  codGrupo: string,
  descargador: DescargadorRfgf,
  ahora = new Date(),
): Promise<ResumenHistoricoRfgf> {
  const vacio: ResumenHistoricoRfgf = {
    codGrupo,
    paginas: 0,
    jugadores: 0,
    avisos: [],
    errores: [],
  };
  return (
    (await conCandadoRfgf(async () => {
      const antes = (await estadoHistorico()).find((g) => g.codGrupo === codGrupo);
      if (!antes) throw new Error("Ese grupo histórico no está guardado.");
      if (antes.estado === "sin_acta")
        return { ...vacio, avisos: ["No se encontró un acta de referencia para este grupo."] };
      const opciones: OpcionesPaso = {
        codGrupo,
        gruposVistos: [],
        jugadoresVistos: [],
        errores: [],
      };
      const paginas = await avanzarSinCandado(descargador, ahora, 2, opciones);
      const despues = (await estadoHistorico()).find((g) => g.codGrupo === codGrupo)!;
      return {
        codGrupo,
        paginas,
        jugadores: despues.conCifras - antes.conCifras,
        avisos: paginas
          ? []
          : [
              antes.estado === "pendiente"
                ? "Faltan jugadores identificados de esta categoría para avanzar."
                : "Este grupo ya tiene todas sus cifras leídas.",
            ],
        errores: opciones.errores,
      };
    })) ?? { ...vacio, avisos: [AVISO_RFGF_OCUPADA] }
  );
}
