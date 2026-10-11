"use server";

import { schema } from "@santiso/db";
import { and, asc, eq, sql } from "drizzle-orm";
import { capturar, fallo, type Resultado } from "@/lib/resultado";
import { grupoDeEnlace } from "@/lib/rfgf/enlace";
import { obtenerDb } from "@/lib/server/db";
import { crearDescargador } from "@/lib/server/rfgf/descargador";
import { sincronizarTodo } from "@/lib/server/rfgf/sincronizar";

export interface ActaPorRevisar {
  codActa: string;
  partido: string;
  motivo: string;
}

export interface CompeticionRfgf {
  competicionId: string;
  nombre: string;
  categoria: string;
  /** Vacío si la competición no está enlazada con la federación. */
  enlace: string;
  /** ISO de la última comprobación, o `null`. */
  comprobadoEn: string | null;
  /** Lo último que se trajo, en una frase. */
  resumen: string;
  revisar: ActaPorRevisar[];
}

/** Las competiciones de la temporada activa y cómo va su sincronización con la federación. */
export async function cargarEstadoRfgf(): Promise<Resultado<CompeticionRfgf[]>> {
  return capturar("No se pudo cargar el estado de la federación.", async () => {
    const { db } = await obtenerDb();
    const competiciones = await db
      .select({
        competicionId: schema.competiciones.id,
        nombre: schema.competiciones.nombre,
        categoria: schema.competiciones.categoria,
        enlace: schema.rfgfCompeticiones.enlace,
        comprobadoEn: schema.rfgfCompeticiones.comprobadoEn,
        resumen: schema.rfgfCompeticiones.resumen,
      })
      .from(schema.competiciones)
      .innerJoin(schema.temporadas, eq(schema.temporadas.id, schema.competiciones.temporadaId))
      .leftJoin(
        schema.rfgfCompeticiones,
        eq(schema.rfgfCompeticiones.competicionId, schema.competiciones.id),
      )
      .where(eq(schema.temporadas.activa, true))
      .orderBy(asc(schema.competiciones.categoria), asc(schema.competiciones.orden));

    const pendientes = await db
      .select({
        codActa: schema.rfgfActas.codActa,
        competicionId: schema.rfgfActas.competicionId,
        motivo: schema.rfgfActas.detalle,
        local: sql<string | null>`(select e.nombre from ${schema.partidos} p join ${schema.equipos} e on e.id = p.equipo_local_id where p.id = ${schema.rfgfActas.partidoId})`,
        visitante: sql<string | null>`(select e.nombre from ${schema.partidos} p join ${schema.equipos} e on e.id = p.equipo_visitante_id where p.id = ${schema.rfgfActas.partidoId})`,
      })
      .from(schema.rfgfActas)
      .where(
        and(
          eq(schema.rfgfActas.estado, "revisar"),
          // Deja de estar pendiente en cuanto el partido tiene su acta, venga de donde venga.
          sql`not exists (select 1 from ${schema.partidoParticipaciones} where ${schema.partidoParticipaciones.partidoId} = ${schema.rfgfActas.partidoId})`,
        ),
      );

    return competiciones.map((c) => ({
      competicionId: c.competicionId,
      nombre: c.nombre,
      categoria: c.categoria,
      enlace: c.enlace ?? "",
      comprobadoEn: c.comprobadoEn ?? null,
      resumen: c.resumen ?? "",
      revisar: pendientes
        .filter((p) => p.competicionId === c.competicionId)
        .map((p) => ({
          codActa: p.codActa,
          partido: p.local && p.visitante ? `${p.local} – ${p.visitante}` : "Partido sin identificar",
          motivo: p.motivo,
        })),
    }));
  });
}

/** Enlaza una competición con su calendario en la federación. Vacío = dejar de sincronizarla. */
export async function guardarEnlaceRfgf(
  competicionId: string,
  enlace: string,
): Promise<Resultado<null>> {
  const texto = enlace.trim();
  const { db } = await obtenerDb();
  if (!texto) {
    return capturar("No se pudo quitar el enlace.", async () => {
      await db
        .delete(schema.rfgfCompeticiones)
        .where(eq(schema.rfgfCompeticiones.competicionId, competicionId));
      return null;
    });
  }
  if (!grupoDeEnlace(texto)) {
    return fallo(
      "Ese enlace no vale. Pega el del calendario o el de una jornada de la competición en futgal.es.",
    );
  }
  return capturar("No se pudo guardar el enlace.", async () => {
    await db
      .insert(schema.rfgfCompeticiones)
      .values({ competicionId, enlace: texto })
      .onConflictDoUpdate({ target: schema.rfgfCompeticiones.competicionId, set: { enlace: texto } });
    return null;
  });
}

/** Mira ahora mismo la federación, sin esperar a la siguiente comprobación periódica. */
export async function comprobarRfgfAhora(): Promise<Resultado<string>> {
  return capturar("No se pudo consultar la federación.", async () => {
    const resumenes = await sincronizarTodo(crearDescargador());
    if (resumenes.length === 0) return "No hay competiciones enlazadas, o ya hay una comprobación en marcha.";
    const actas = resumenes.reduce((n, r) => n + r.actas, 0);
    const resultados = resumenes.reduce((n, r) => n + r.resultados, 0);
    const revisar = resumenes.reduce((n, r) => n + r.revisar.length, 0);
    const errores = resumenes.reduce((n, r) => n + r.errores.length, 0);
    if (!actas && !resultados && !revisar && !errores) return "Sin novedades en la federación.";
    return [
      actas ? `${actas} acta${actas > 1 ? "s" : ""}` : "",
      resultados ? `${resultados} resultado${resultados > 1 ? "s" : ""}` : "",
      revisar ? `${revisar} por revisar` : "",
      errores ? `${errores} con error` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  });
}

/** Tras arreglar lo que impedía guardar un acta (dar de alta a un jugador), se vuelve a intentar. */
export async function reintentarActaRfgf(codActa: string): Promise<Resultado<null>> {
  return capturar("No se pudo preparar el reintento.", async () => {
    const { db } = await obtenerDb();
    await db
      .delete(schema.rfgfActas)
      .where(and(eq(schema.rfgfActas.codActa, codActa), eq(schema.rfgfActas.estado, "revisar")));
    return null;
  });
}
