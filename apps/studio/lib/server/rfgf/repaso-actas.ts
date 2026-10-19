import "server-only";

import { parsearFichaPdf } from "@santiso/actas";
import { schema } from "@santiso/db";
import { aliasedTable, and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { grupoDeEnlace, urlActaPdf } from "@/lib/rfgf/enlace";
import { obtenerDb } from "@/lib/server/db";
import { conCandadoRfgf } from "./candado";
import type { DescargadorRfgf } from "./descargador";
import { apuntarJugadoresDeActa } from "./jugadores";
import { guardarAlineacionesDeLiga } from "./sincronizar";

/**
 * Páginas por pasada del repaso. Las mismas que el de temporadas pasadas: tras una ráfaga de
 * unas decenas la federación deja de responder, y esto no corre prisa.
 */
export const PAGINAS_REPASO_ACTAS = 2;

export interface ResumenRepasoActas {
  /** Páginas pedidas a la federación. */
  paginas: number;
  /** Actas del club de las que se apuntaron sus jugadores con código. */
  jugadores: number;
  /** Actas de las que se apuntaron las alineaciones. */
  alineaciones: number;
  errores: string[];
}

/** Lo que falta por repasar en la temporada activa. */
export interface PendientesRepasoActas {
  /** Actas del club sin sus jugadores leídos. */
  jugadores: number;
  /** Actas del club sin alineaciones. */
  alineacionesPropias: number;
  /** Actas del resto de la liga sin alineaciones. */
  alineacionesResto: number;
}

/** Las actas ya tratadas de la temporada activa, con lo que les falta. Sin peticiones. */
async function actasDeLaTemporada() {
  const { db } = await obtenerDb();
  const local = aliasedTable(schema.equipos, "local");
  const visitante = aliasedTable(schema.equipos, "visitante");
  const filas = await db
    .select({
      codActa: schema.rfgfActas.codActa,
      competicionId: schema.rfgfActas.competicionId,
      categoria: schema.competiciones.categoria,
      enlace: schema.rfgfCompeticiones.enlace,
      partidoId: schema.partidos.id,
      fecha: schema.partidos.fecha,
      localId: local.id,
      localPropio: local.esPropio,
      visitanteId: visitante.id,
      visitantePropio: visitante.esPropio,
      jugadoresEn: schema.rfgfActas.jugadoresEn,
      alineacionesEn: schema.rfgfActas.alineacionesEn,
      conAlineaciones: sql<number>`exists (select 1 from ${schema.ligaAlineaciones} a where a.partido_id = ${schema.partidos.id})`,
    })
    .from(schema.rfgfActas)
    .innerJoin(schema.partidos, eq(schema.partidos.id, schema.rfgfActas.partidoId))
    .innerJoin(local, eq(local.id, schema.partidos.equipoLocalId))
    .innerJoin(visitante, eq(visitante.id, schema.partidos.equipoVisitanteId))
    .innerJoin(schema.competiciones, eq(schema.competiciones.id, schema.rfgfActas.competicionId))
    .innerJoin(schema.temporadas, eq(schema.temporadas.id, schema.competiciones.temporadaId))
    .innerJoin(
      schema.rfgfCompeticiones,
      eq(schema.rfgfCompeticiones.competicionId, schema.rfgfActas.competicionId),
    )
    .where(and(eq(schema.temporadas.activa, true), isNotNull(schema.rfgfActas.partidoId)))
    // Lo que lleva más sin tocarse, primero: lo que acaba de fallar pasa detrás.
    .orderBy(asc(schema.rfgfActas.actualizadoEn), desc(schema.partidos.fecha));
  return filas.map((f) => {
    const propio = f.localPropio || f.visitantePropio;
    const sinAlineaciones = !f.alineacionesEn && !Number(f.conAlineaciones);
    return {
      ...f,
      propio,
      faltanJugadores: propio && !f.jugadoresEn,
      sinAlineaciones,
    };
  });
}

export async function pendientesRepasoActas(): Promise<PendientesRepasoActas> {
  const actas = await actasDeLaTemporada();
  return {
    jugadores: actas.filter((a) => a.faltanJugadores).length,
    alineacionesPropias: actas.filter((a) => a.propio && a.sinAlineaciones).length,
    alineacionesResto: actas.filter((a) => !a.propio && a.sinAlineaciones).length,
  };
}

/**
 * Completa poco a poco lo que las actas ya tratadas de la temporada activa no dejaron: los
 * jugadores del club con su código (de cada partido del club, no solo del último) y las
 * alineaciones de cada partido (las actas leídas antes de guardarse alineaciones no las
 * tienen). Primero lo del club, después el resto de la liga. Nunca vuelve a leer lo que ya
 * está. Como mucho `maximo` páginas; devuelve lo hecho.
 */
export async function avanzarRepasoActas(
  descargador: DescargadorRfgf,
  ahora = new Date(),
  maximo = PAGINAS_REPASO_ACTAS,
): Promise<ResumenRepasoActas> {
  const resumen: ResumenRepasoActas = { paginas: 0, jugadores: 0, alineaciones: 0, errores: [] };
  const limite = Math.max(0, Math.min(PAGINAS_REPASO_ACTAS, Math.floor(maximo)));
  await conCandadoRfgf(async () => {
    const { db } = await obtenerDb();
    const vistas = new Set<string>();
    while (resumen.paginas < limite) {
      const actas = await actasDeLaTemporada();
      // Por orden: jugadores del club, alineaciones del club, alineaciones del resto.
      const tarea = [
        ...actas
          .filter((a) => a.faltanJugadores)
          .map((acta) => ({ acta, tipo: "jugadores" as const })),
        ...actas
          .filter((a) => a.propio && a.sinAlineaciones)
          .map((acta) => ({ acta, tipo: "alineaciones" as const })),
        ...actas
          .filter((a) => !a.propio && a.sinAlineaciones)
          .map((acta) => ({ acta, tipo: "alineaciones" as const })),
      ].find((t) => !vistas.has(`${t.tipo}:${t.acta.codActa}`));
      if (!tarea) break;
      const { acta, tipo } = tarea;
      vistas.add(`${tipo}:${acta.codActa}`);
      const grupo = grupoDeEnlace(acta.enlace);
      if (!grupo) continue;
      resumen.paginas++;
      try {
        if (tipo === "jugadores") {
          await apuntarJugadoresDeActa(
            acta.competicionId,
            acta.categoria,
            grupo,
            { codActa: acta.codActa, lado: acta.localPropio ? "local" : "visitante" },
            descargador,
            ahora,
          );
          resumen.jugadores++;
        } else {
          const pdf = await descargador.pdf(urlActaPdf(grupo, acta.codActa));
          // Un acta que no se sabe leer tampoco mejora releyéndola: se marca igual.
          const ficha = await parsearFichaPdf(pdf).catch(() => null);
          if (ficha) {
            await guardarAlineacionesDeLiga(
              {
                id: acta.partidoId,
                equipos: { local: acta.localId, visitante: acta.visitanteId },
              },
              ficha,
            );
            resumen.alineaciones++;
          }
          await db
            .update(schema.rfgfActas)
            .set({ alineacionesEn: ahora.toISOString() })
            .where(eq(schema.rfgfActas.codActa, acta.codActa));
        }
      } catch (error) {
        // Fallo de red: no se marca nada y pasa detrás de las demás.
        resumen.errores.push(
          `Acta ${acta.codActa}: ${error instanceof Error ? error.message : "fallo desconocido"}`,
        );
        await db
          .update(schema.rfgfActas)
          .set({ actualizadoEn: ahora.toISOString() })
          .where(eq(schema.rfgfActas.codActa, acta.codActa));
      }
    }
  });
  return resumen;
}
