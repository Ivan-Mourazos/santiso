import "server-only";

import {
  catalogoDeCalendarioPdf,
  parsearCalendarioPdf,
  parsearCalendarioWeb,
  type Calendario,
} from "@santiso/actas";
import { schema } from "@santiso/db";
import { claveNombre, esEquipoPropio, normalizarNombreEquipo } from "@santiso/domain";
import { and, eq, inArray } from "drizzle-orm";
import {
  planDeImportacion,
  type EstadoBd,
  type PlanImportacion,
} from "@/lib/calendario/plan-importacion";
import { urlCalendarioPdf, urlCalendarioWeb, type GrupoRfgf } from "@/lib/rfgf/enlace";
import { obtenerDb } from "@/lib/server/db";
import { aplicarColoresDeClub, enlazarEquiposConClubes } from "./clubes";
import type { DescargadorRfgf } from "./descargador";

/** Lo que hay hoy en la base de datos para esa competición. */
export async function estadoDeCompeticion(competicionId: string): Promise<EstadoBd> {
  const { db } = await obtenerDb();

  const [competicion] = await db
    .select({ categoria: schema.competiciones.categoria })
    .from(schema.competiciones)
    .where(eq(schema.competiciones.id, competicionId));
  if (!competicion) throw new Error("La competición no existe.");

  // Toda la categoría: un rival de la copa suele estar ya dado de alta por la liga.
  const inscritos = new Set(
    (
      await db
        .select({ id: schema.competicionEquipos.equipoId })
        .from(schema.competicionEquipos)
        .where(eq(schema.competicionEquipos.competicionId, competicionId))
    ).map((e) => e.id),
  );
  const equipos = await db
    .select({
      id: schema.equipos.id,
      nombre: schema.equipos.nombre,
      clubCodigo: schema.equipos.clubCodigo,
    })
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

  return {
    equipos: equipos.map((e) => ({ ...e, inscrito: inscritos.has(e.id) })),
    jornadas,
    cruces,
    categoria: competicion.categoria,
  };
}

const claveCatalogo = (nombre: string) => nombre.normalize("NFC").replace(/\s/gu, "");

/**
 * El calendario de una competición en la federación. El PDF, si es una liga de las que sabe
 * leer; si no (una copa, una liga con descansos), la página web, con los códigos de club que
 * traiga el catálogo del PDF. Dos descargas como mucho.
 */
export async function leerCalendarioFederacion(
  grupo: GrupoRfgf,
  descargador: DescargadorRfgf,
): Promise<Calendario> {
  const pdf = await descargador.pdf(urlCalendarioPdf(grupo)).catch(() => null);
  if (pdf) {
    const liga = await parsearCalendarioPdf(pdf).catch(() => null);
    if (liga) return liga;
  }
  const web = parsearCalendarioWeb(await descargador.html(urlCalendarioWeb(grupo)));
  const catalogo = pdf ? await catalogoDeCalendarioPdf(pdf).catch(() => []) : [];
  const codigos = new Map(catalogo.map((e) => [claveCatalogo(e.nombre), e.codigoFederativo]));
  // Los partidos comparten estos objetos con `equipos`: basta con ponerles el código una vez.
  for (const equipo of web.equipos) {
    equipo.codigoFederativo = codigos.get(claveCatalogo(equipo.nombre)) ?? "";
  }
  return web;
}

export interface CalendarioAplicado {
  equipos: number;
  jornadas: number;
  partidos: number;
}

/**
 * Aplica el plan en una sola transacción: equipos que faltan, inscripciones, jornadas y cruces.
 * **Nunca modifica un partido ni un equipo que ya existe.** Los índices únicos hacen el resto,
 * así que aplicar el mismo calendario dos veces no cambia nada.
 */
export async function aplicarPlanCalendario(
  competicionId: string,
  plan: PlanImportacion,
): Promise<CalendarioAplicado> {
  const { db } = await obtenerDb();
  const [competicion] = await db
    .select({ categoria: schema.competiciones.categoria })
    .from(schema.competiciones)
    .where(eq(schema.competiciones.id, competicionId));
  if (!competicion) throw new Error("La competición no existe.");
  const { categoria } = competicion;

  // El plan viene del navegador: el nombre se vuelve a pasar por las reglas de siempre.
  const equiposNuevos = plan.equiposNuevos.map((equipo) => {
    const nombre = normalizarNombreEquipo(equipo.nombre, categoria);
    return { nombre, clave: claveNombre(nombre), clubCodigo: equipo.clubCodigo };
  });

  const salida = await db.transaction(async (tx) => {
    const codigos = equiposNuevos.flatMap((e) => (e.clubCodigo ? [e.clubCodigo] : []));
    const clubes = new Set(
      codigos.length === 0
        ? []
        : (
            await tx
              .select({ codigo: schema.rfgfClubes.codigo })
              .from(schema.rfgfClubes)
              .where(inArray(schema.rfgfClubes.codigo, codigos))
          ).map((c) => c.codigo),
    );
    const creados = equiposNuevos.length
      ? await tx
          .insert(schema.equipos)
          .values(
            equiposNuevos.map((e) => ({
              nombre: e.nombre,
              clave: e.clave,
              categoria,
              esPropio: esEquipoPropio(e.nombre),
              clubCodigo: e.clubCodigo && clubes.has(e.clubCodigo) ? e.clubCodigo : null,
            })),
          )
          .onConflictDoNothing()
          .returning({ id: schema.equipos.id })
      : [];

    const claves = equiposNuevos.map((e) => e.clave);
    const porClave = new Map(
      (claves.length === 0
        ? []
        : await tx
            .select({ id: schema.equipos.id, clave: schema.equipos.clave })
            .from(schema.equipos)
            .where(and(eq(schema.equipos.categoria, categoria), inArray(schema.equipos.clave, claves)))
      ).map((e) => [e.clave, e.id]),
    );

    const inscripciones = [...new Set([...plan.equiposExistentes, ...porClave.values()])];
    if (inscripciones.length > 0) {
      await tx
        .insert(schema.competicionEquipos)
        .values(inscripciones.map((equipoId) => ({ competicionId, equipoId })))
        .onConflictDoNothing();
    }

    if (plan.jornadasNuevas.length > 0) {
      await tx
        .insert(schema.jornadas)
        .values(
          plan.jornadasNuevas.map((jornada) => ({
            competicionId,
            numero: jornada.numero,
            nombreFase: jornada.nombreFase ?? null,
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

    const filas = plan.cruces.flatMap((cruce) => {
      if (cruce.estado !== "nuevo") return [];
      const jornadaId = idDeJornada.get(cruce.jornada);
      const equipoLocalId = cruce.localId ?? porClave.get(cruce.localNuevo ?? "");
      const equipoVisitanteId = cruce.visitanteId ?? porClave.get(cruce.visitanteNuevo ?? "");
      if (!jornadaId || !equipoLocalId || !equipoVisitanteId) return [];
      // El calendario no trae ni resultado, ni hora, ni campo: los pone la sincronización.
      return [{ jornadaId, equipoLocalId, equipoVisitanteId, estado: "programado" as const }];
    });
    if (filas.length > 0) {
      await tx.insert(schema.partidos).values(filas).onConflictDoNothing();
    }

    // Las que pedía el plan y ahora están: `onConflictDoNothing` pudo saltarse alguna.
    const pedidas = new Set(plan.jornadasNuevas.map((j) => j.numero));
    return {
      equipos: creados.length,
      jornadas: jornadas.filter((j) => pedidas.has(j.numero)).length,
      partidos: filas.length,
      creados: creados.map((c) => c.id),
    };
  });

  // Fuera de la transacción: si falla, los equipos ya están y solo les faltan los colores.
  if (salida.creados.length > 0) {
    await aplicarColoresDeClub(salida.creados).catch(() => 0);
    await enlazarEquiposConClubes().catch(() => null);
  }
  return { equipos: salida.equipos, jornadas: salida.jornadas, partidos: salida.partidos };
}

/**
 * Pone al día una copa con lo sorteado desde la última vez: la federación va asignando cruces
 * ronda a ronda. Devuelve cuántos partidos añadió.
 */
export async function actualizarCrucesDeCopa(
  competicionId: string,
  grupo: GrupoRfgf,
  descargador: DescargadorRfgf,
): Promise<number> {
  const calendario = parsearCalendarioWeb(await descargador.html(urlCalendarioWeb(grupo)));
  const plan = planDeImportacion(calendario, await estadoDeCompeticion(competicionId));
  if (plan.resumen.crucesNuevos === 0 && plan.resumen.jornadasNuevas === 0) return 0;
  return (await aplicarPlanCalendario(competicionId, plan)).partidos;
}
