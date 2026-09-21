"use server";

import { parsearCalendarioPdf } from "@santiso/actas";
import { schema } from "@santiso/db";
import { eq, inArray } from "drizzle-orm";
import {
  planDeImportacion,
  type EstadoBd,
  type PlanImportacion,
} from "@/lib/calendario/plan-importacion";
import { capturar, exito, fallo, type Resultado } from "@/lib/resultado";
import { obtenerDb } from "@/lib/server/db";

export interface CalendarioLeido {
  competicion: string;
  temporada: string;
  /** Jornadas y cruces que trae el PDF, ya contrastados con la base de datos. */
  plan: PlanImportacion;
}

/** El parser rechaza por encima de esto; se comprueba antes para no leer el fichero en balde. */
const MAXIMO_BYTES = 15 * 1024 * 1024;

/** Lo que hay hoy en la base de datos para esa competición. */
async function estadoDe(competicionId: string): Promise<EstadoBd> {
  const { db } = await obtenerDb();

  const [competicion] = await db
    .select({ categoria: schema.competiciones.categoria })
    .from(schema.competiciones)
    .where(eq(schema.competiciones.id, competicionId));
  if (!competicion) throw new Error("La competición no existe.");

  // Los inscritos en la competición primero; si aún no hay ninguno, toda la categoría, que es
  // lo normal al cargar el calendario de una temporada recién creada.
  const inscritos = await db
    .select({ id: schema.equipos.id, nombre: schema.equipos.nombre })
    .from(schema.competicionEquipos)
    .innerJoin(schema.equipos, eq(schema.equipos.id, schema.competicionEquipos.equipoId))
    .where(eq(schema.competicionEquipos.competicionId, competicionId));
  const equipos =
    inscritos.length > 0
      ? inscritos
      : await db
          .select({ id: schema.equipos.id, nombre: schema.equipos.nombre })
          .from(schema.equipos)
          .where(eq(schema.equipos.categoria, competicion.categoria));

  const jornadas = await db
    .select({ id: schema.jornadas.id, numero: schema.jornadas.numero })
    .from(schema.jornadas)
    .where(eq(schema.jornadas.competicionId, competicionId));

  const cruces =
    jornadas.length === 0
      ? []
      : await db
          .select({
            jornadaNumero: schema.jornadas.numero,
            equipoLocalId: schema.partidos.equipoLocalId,
            equipoVisitanteId: schema.partidos.equipoVisitanteId,
          })
          .from(schema.partidos)
          .innerJoin(schema.jornadas, eq(schema.jornadas.id, schema.partidos.jornadaId))
          .where(
            inArray(
              schema.partidos.jornadaId,
              jornadas.map((j) => j.id),
            ),
          );

  return { equipos, jornadas, cruces };
}

/**
 * Lee el calendario federativo en PDF **en local** y lo contrasta con la base de datos.
 * No escribe nada: devuelve el plan para que se revise antes de aplicarlo.
 */
export async function leerCalendarioPdf(
  formulario: FormData,
): Promise<Resultado<CalendarioLeido>> {
  const fichero = formulario.get("calendario");
  const competicionId = String(formulario.get("competicionId") ?? "").trim();
  if (!(fichero instanceof File)) return fallo("No se recibió ningún PDF.");
  if (fichero.size === 0) return fallo("El PDF está vacío.");
  if (fichero.size > MAXIMO_BYTES) return fallo("El PDF supera los 15 MiB.");
  if (!competicionId) return fallo("Elige la competición de destino.");

  let calendario;
  try {
    calendario = await parsearCalendarioPdf(new Uint8Array(await fichero.arrayBuffer()));
  } catch (error) {
    // El parser rechaza explícitamente lo que no entiende; su mensaje dice qué pasó.
    const detalle = error instanceof Error ? error.message : "motivo desconocido";
    return fallo(`No se pudo leer el calendario: ${detalle}`);
  }

  return capturar("No se pudo preparar la importación.", async () => ({
    competicion: calendario.competicion,
    temporada: calendario.temporada,
    plan: planDeImportacion(calendario, await estadoDe(competicionId)),
  }));
}

/**
 * Aplica el plan en una sola transacción. **Nunca modifica un partido que ya existe**: puede
 * llevar un marcador metido desde un acta. El índice único de la tabla hace el resto, así que
 * volver a importar el mismo calendario no cambia nada.
 */
export async function guardarCalendario(entrada: {
  competicionId: string;
  plan: PlanImportacion;
}): Promise<Resultado<{ jornadas: number; partidos: number }>> {
  const { competicionId, plan } = entrada;
  if (!competicionId) return fallo("Elige la competición de destino.");

  const porCrear = plan.cruces.filter((cruce) => cruce.estado === "nuevo");
  if (plan.jornadasNuevas.length === 0 && porCrear.length === 0) {
    return exito({ jornadas: 0, partidos: 0 });
  }

  const { db } = await obtenerDb();
  return capturar("No se pudo guardar el calendario.", async () =>
    db.transaction(async (tx) => {
      if (plan.jornadasNuevas.length > 0) {
        await tx
          .insert(schema.jornadas)
          .values(
            plan.jornadasNuevas.map((jornada) => ({
              competicionId,
              numero: jornada.numero,
              fechaInicio: jornada.fechaInicio || null,
            })),
          )
          .onConflictDoNothing();
      }

      const jornadas = await tx
        .select({ id: schema.jornadas.id, numero: schema.jornadas.numero })
        .from(schema.jornadas)
        .where(eq(schema.jornadas.competicionId, competicionId));
      const idDeJornada = new Map(jornadas.map((j) => [j.numero, j.id]));

      const filas = porCrear.flatMap((cruce) => {
        const jornadaId = idDeJornada.get(cruce.jornada);
        if (!jornadaId || !cruce.localId || !cruce.visitanteId) return [];
        return [
          {
            jornadaId,
            equipoLocalId: cruce.localId,
            equipoVisitanteId: cruce.visitanteId,
            // El calendario no trae ni resultado, ni hora, ni campo. No se inventan.
            estado: "programado" as const,
          },
        ];
      });
      if (filas.length > 0) {
        await tx.insert(schema.partidos).values(filas).onConflictDoNothing();
      }

      // Las que pedía el plan y ahora están: `onConflictDoNothing` pudo saltarse alguna.
      const pedidas = new Set(plan.jornadasNuevas.map((j) => j.numero));
      const creadas = jornadas.filter((j) => pedidas.has(j.numero)).length;

      return { jornadas: creadas, partidos: filas.length };
    }),
  );
}
