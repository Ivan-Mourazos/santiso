"use server";

/**
 * Libreta del partido en directo: apuntes personales del delegado para cerrar el acta con el
 * árbitro. Nunca escribe en el acta (`partido_eventos`), ni en participaciones ni en el partido.
 */
import { schema } from "@santiso/db";
import { ESTADOS_RELOJ, LADOS_EVENTO, MINUTO_MAXIMO, TIPOS_EVENTO } from "@santiso/domain";
import { aliasedTable, and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { RELOJ_INICIAL, type RelojDirecto } from "@/lib/directo/reloj";
import type {
  EventoDirecto,
  OperacionDirecto,
  PantallaDirecto,
} from "@/lib/directo/tipos";
import { capturar, exito, fallo, validar, type Resultado } from "@/lib/resultado";
import { listarJugadores } from "@/lib/server/consultas/jugadores";
import { obtenerDb } from "@/lib/server/db";

const entero = (min: number, max: number) => z.number().int().min(min).max(max);
const dorsal = entero(0, 999).nullable();

const esquemaEvento = z.object({
  id: z.string().min(1).max(64),
  tipo: z.enum(TIPOS_EVENTO),
  lado: z.enum(LADOS_EVENTO),
  propia: z.boolean(),
  parte: z.union([z.literal(1), z.literal(2)]),
  minuto: entero(0, MINUTO_MAXIMO).nullable(),
  jugadorId: z.string().min(1).nullable(),
  jugadorSaleId: z.string().min(1).nullable(),
  dorsal,
  dorsalSale: dorsal,
  nota: z.string().max(200),
});

const esquemaReloj = z.object({
  duracionParte: entero(10, 60),
  estado: z.enum(ESTADOS_RELOJ),
  inicioParte: z.number().int().nonnegative().nullable(),
  pausadoMs: z.number().int().nonnegative(),
  pausaDesde: z.number().int().nonnegative().nullable(),
});

const esquemaOperaciones = z
  .array(
    z.discriminatedUnion("op", [
      z.object({ op: z.literal("guardar"), evento: esquemaEvento }),
      z.object({ op: z.literal("borrar"), id: z.string().min(1) }),
      z.object({ op: z.literal("reloj"), reloj: esquemaReloj }),
    ]),
  )
  .max(500);

/** Todo lo que pinta la pantalla de directo de un partido. */
export async function cargarDirecto(partidoId: string): Promise<Resultado<PantallaDirecto>> {
  const resultado = await capturar("No se pudo abrir el directo.", async () => {
    const { db } = await obtenerDb();
    const local = aliasedTable(schema.equipos, "local");
    const visitante = aliasedTable(schema.equipos, "visitante");
    const [partido] = await db
      .select({
        id: schema.partidos.id,
        categoria: schema.competiciones.categoria,
        temporadaId: schema.competiciones.temporadaId,
        local: local.nombre,
        visitante: visitante.nombre,
        localPropio: local.esPropio,
      })
      .from(schema.partidos)
      .innerJoin(schema.jornadas, eq(schema.jornadas.id, schema.partidos.jornadaId))
      .innerJoin(schema.competiciones, eq(schema.competiciones.id, schema.jornadas.competicionId))
      .leftJoin(local, eq(local.id, schema.partidos.equipoLocalId))
      .leftJoin(visitante, eq(visitante.id, schema.partidos.equipoVisitanteId))
      .where(eq(schema.partidos.id, partidoId));
    if (!partido) return null;

    const [reloj] = await db
      .select()
      .from(schema.partidoDirecto)
      .where(eq(schema.partidoDirecto.partidoId, partidoId));
    const filas = await db
      .select()
      .from(schema.partidoDirectoEventos)
      .where(eq(schema.partidoDirectoEventos.partidoId, partidoId))
      .orderBy(
        asc(schema.partidoDirectoEventos.parte),
        asc(schema.partidoDirectoEventos.minuto),
        asc(schema.partidoDirectoEventos.creadoEn),
      );

    // Convocados si hay convocatoria; si no, la plantilla de la categoría esa temporada.
    const plantilla = await listarJugadores(partido.categoria, partido.temporadaId);
    const convocados = new Set(
      (
        await db
          .select({ id: schema.partidoConvocados.jugadorId })
          .from(schema.partidoConvocados)
          .where(eq(schema.partidoConvocados.partidoId, partidoId))
      ).map((f) => f.id),
    );
    const jugadores = plantilla
      .filter((j) => convocados.size === 0 || convocados.has(j.id))
      .map((j) => ({ id: j.id, nombre: j.apodo || j.nombre, dorsal: j.dorsal }));

    const datos: PantallaDirecto = {
      partido: {
        id: partido.id,
        categoria: partido.categoria,
        local: partido.local ?? "Local",
        visitante: partido.visitante ?? "Visitante",
        somosLocal: partido.localPropio === true,
      },
      reloj: reloj
        ? {
            duracionParte: reloj.duracionParte,
            estado: reloj.estado,
            inicioParte: reloj.inicioParte,
            pausadoMs: reloj.pausadoMs,
            pausaDesde: reloj.pausaDesde,
          }
        : RELOJ_INICIAL,
      eventos: filas.map(
        (f): EventoDirecto => ({
          id: f.id,
          tipo: f.tipo,
          lado: f.lado,
          propia: f.propia,
          parte: f.parte === 2 ? 2 : 1,
          minuto: f.minuto,
          jugadorId: f.jugadorId,
          jugadorSaleId: f.jugadorSaleId,
          dorsal: f.dorsal,
          dorsalSale: f.dorsalSale,
          nota: f.nota,
        }),
      ),
      jugadores,
    };
    return datos;
  });
  if (resultado.ok && resultado.datos === null) return fallo("Ese partido ya no existe.");
  return resultado as Resultado<PantallaDirecto>;
}

/**
 * Aplica en orden, en una transacción, lo que manda el móvil. Reenviar el mismo lote es seguro:
 * guardar es insertar o actualizar por `id`, y borrar algo que no existe no falla.
 */
export async function aplicarDirecto(
  partidoId: string,
  operaciones: OperacionDirecto[],
): Promise<Resultado<null>> {
  const entrada = validar(esquemaOperaciones, operaciones);
  if (!entrada.ok) return fallo("Hay un apunte que no es válido.");
  const ops = entrada.datos;

  const { db } = await obtenerDb();
  const [partido] = await db
    .select({ id: schema.partidos.id })
    .from(schema.partidos)
    .where(eq(schema.partidos.id, partidoId));
  if (!partido) return fallo("Ese partido ya no existe.");

  // Un id del móvil que ya pertenece a otro partido no se pisa.
  const ids = ops.flatMap((o) => (o.op === "guardar" ? [o.evento.id] : []));
  if (ids.length > 0) {
    const existentes = await db
      .select({ partidoId: schema.partidoDirectoEventos.partidoId })
      .from(schema.partidoDirectoEventos)
      .where(inArray(schema.partidoDirectoEventos.id, ids));
    const deOtro = existentes.map((f) => f.partidoId !== partidoId);
    if (deOtro.some(Boolean)) return fallo("Hay un apunte que es de otro partido.");
  }

  const resultado = await capturar("No se pudieron guardar los apuntes.", async () => {
    await db.transaction(async (tx) => {
      for (const o of ops) {
        if (o.op === "guardar") {
          const { id, ...resto } = o.evento;
          await tx
            .insert(schema.partidoDirectoEventos)
            .values({ id, partidoId, ...resto })
            .onConflictDoUpdate({ target: schema.partidoDirectoEventos.id, set: resto });
        } else if (o.op === "borrar") {
          await tx
            .delete(schema.partidoDirectoEventos)
            .where(
              and(
                eq(schema.partidoDirectoEventos.id, o.id),
                eq(schema.partidoDirectoEventos.partidoId, partidoId),
              ),
            );
        } else {
          const reloj: RelojDirecto = o.reloj;
          await tx
            .insert(schema.partidoDirecto)
            .values({ partidoId, ...reloj })
            .onConflictDoUpdate({ target: schema.partidoDirecto.partidoId, set: reloj });
        }
      }
    });
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}
