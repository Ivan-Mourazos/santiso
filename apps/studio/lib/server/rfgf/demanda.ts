import "server-only";

import { schema } from "@santiso/db";
import { and, eq } from "drizzle-orm";
import { parecido } from "@/lib/importar/emparejar";
import { grupoDeEnlace } from "@/lib/rfgf/enlace";
import { jornadasPorJugar } from "@/lib/rfgf/horarios";
import type { ComparacionClasificacion } from "@/lib/rfgf/clasificacion";
import { obtenerDb } from "@/lib/server/db";
import { AVISO_RFGF_OCUPADA, conCandadoRfgf } from "./candado";
import type { DescargadorRfgf } from "./descargador";
import { sincronizarJugadores } from "./jugadores";
import {
  anotar,
  compararConOficial,
  horaLocal,
  partidosDeCompeticion,
  tratarActa,
  tratarActasJornada,
  tratarJornada,
  type ResumenRfgf,
} from "./sincronizar";

export interface ResumenPeticionRfgf extends ResumenRfgf {
  /** Actas leídas, incluidas las de equipos ajenos y las que quedan por revisar. */
  actasTratadas: number;
  jugadores: number;
  /** Sin acta publicada, reserva ocupada u otra situación que no es un error. */
  avisos: string[];
}

export interface ResultadoClasificacionRfgf {
  cuadra: boolean;
  jornadaOficial: number | null;
  diferencias: string[];
  /** Una explicación por diferencia; distingue hechos locales de causas acreditadas. */
  motivos: string[];
  avisos: string[];
  errores: string[];
}

const detalleError = (error: unknown) =>
  error instanceof Error ? error.message : "fallo desconocido";

async function competicionEnlazada(competicionId: string) {
  const { db } = await obtenerDb();
  const [fila] = await db
    .select({
      nombre: schema.competiciones.nombre,
      categoria: schema.competiciones.categoria,
      formato: schema.competiciones.formato,
      enlace: schema.rfgfCompeticiones.enlace,
    })
    .from(schema.competiciones)
    .innerJoin(
      schema.rfgfCompeticiones,
      eq(schema.rfgfCompeticiones.competicionId, schema.competiciones.id),
    )
    .where(eq(schema.competiciones.id, competicionId));
  const grupo = fila ? grupoDeEnlace(fila.enlace) : null;
  if (!fila || !grupo)
    throw new Error("La competición no tiene un enlace válido con la federación.");
  return { ...fila, grupo };
}

const resumenVacio = (competicionId: string): ResumenPeticionRfgf => ({
  competicionId,
  competicion: "",
  resultados: 0,
  actas: 0,
  actasTratadas: 0,
  horarios: [],
  revisar: [],
  errores: [],
  jugadores: 0,
  avisos: [],
});

/** La reserva se toma antes de consultar o descargar. Las peticiones concretas no aplazan la pasada diaria. */
async function pedir(
  competicionId: string,
  operacion: (
    competicion: Awaited<ReturnType<typeof competicionEnlazada>>,
    resumen: ResumenPeticionRfgf,
  ) => Promise<void>,
): Promise<ResumenPeticionRfgf> {
  return (
    (await conCandadoRfgf(async () => {
      const resumen = resumenVacio(competicionId);
      const competicion = await competicionEnlazada(competicionId);
      resumen.competicion = competicion.nombre;
      try {
        await operacion(competicion, resumen);
      } catch (error) {
        resumen.errores.push(detalleError(error));
      }
      const texto = [
        resumen.actas ? `${resumen.actas} actas guardadas` : "",
        resumen.actasTratadas ? `${resumen.actasTratadas} actas tratadas` : "",
        resumen.resultados ? `${resumen.resultados} resultados` : "",
        ...resumen.horarios,
        resumen.jugadores ? `${resumen.jugadores} jugadores leídos` : "",
        ...resumen.revisar,
        ...resumen.errores,
        ...resumen.avisos,
      ]
        .filter(Boolean)
        .join(" · ");
      if (texto) {
        const { db } = await obtenerDb();
        await db
          .update(schema.rfgfCompeticiones)
          .set({ resumen: texto })
          .where(eq(schema.rfgfCompeticiones.competicionId, competicionId));
      }
      return resumen;
    })) ?? { ...resumenVacio(competicionId), avisos: [AVISO_RFGF_OCUPADA] }
  );
}

/** Un PDF y la página de esa jornada; después solo las actas jugadas que faltan o tienen problemas. */
export async function traerJornada(
  competicionId: string,
  numero: number,
  descargador: DescargadorRfgf,
  ahora = new Date(),
): Promise<ResumenPeticionRfgf> {
  return pedir(competicionId, async (competicion, resumen) => {
    const { db } = await obtenerDb();
    const [jornada] = await db
      .select({ id: schema.jornadas.id })
      .from(schema.jornadas)
      .where(
        and(eq(schema.jornadas.competicionId, competicionId), eq(schema.jornadas.numero, numero)),
      );
    if (!Number.isInteger(numero) || !jornada)
      throw new Error("Esa jornada no pertenece a la competición.");
    const partidos = await partidosDeCompeticion(competicionId);
    try {
      await tratarJornada(numero, competicion.grupo, partidos, descargador, resumen, true);
    } catch (error) {
      resumen.errores.push(`Jornada ${numero} (PDF): ${detalleError(error)}`);
    }
    resumen.actasTratadas = await tratarActasJornada(
      numero,
      competicion.grupo,
      { id: competicionId, categoria: competicion.categoria },
      await partidosDeCompeticion(competicionId),
      descargador,
      resumen,
      true,
      ahora,
    );
  });
}

/** Solo este acta; si se conoce su código, ni siquiera se pide la página de jornada. Siempre vuelve a tratarla. */
export async function traerActa(
  competicionId: string,
  partidoId: string,
  descargador: DescargadorRfgf,
  ahora = new Date(),
): Promise<ResumenPeticionRfgf> {
  return pedir(competicionId, async (competicion, resumen) => {
    const partido = (await partidosDeCompeticion(competicionId)).find((p) => p.id === partidoId);
    if (!partido) throw new Error("Ese partido no pertenece a la competición.");
    const { db } = await obtenerDb();
    const [apunte] = await db
      .select({ codActa: schema.rfgfActas.codActa })
      .from(schema.rfgfActas)
      .where(
        and(
          eq(schema.rfgfActas.competicionId, competicionId),
          eq(schema.rfgfActas.partidoId, partidoId),
        ),
      );
    let codActa: string | undefined = apunte?.codActa;
    if (!codActa) {
      const { urlJornada } = await import("@/lib/rfgf/enlace");
      const { partidosDeJornada } = await import("@/lib/rfgf/jornada");
      const { partidoDeActa } = await import("@/lib/rfgf/plan");
      const pagina = partidosDeJornada(
        await descargador.html(urlJornada(competicion.grupo, partido.jornada)),
      );
      codActa =
        pagina.find((p) => partidoDeActa(p.local, p.visitante, [partido]))?.codActa ?? undefined;
    }
    if (!codActa) {
      resumen.avisos.push("La federación todavía no tiene acta de ese partido.");
      return;
    }
    const salida = { aviso: "" };
    try {
      await tratarActa(
        codActa,
        competicion.grupo,
        { id: competicionId, categoria: competicion.categoria },
        partido,
        [partido],
        descargador,
        resumen,
        salida,
        true,
      );
      resumen.actasTratadas = 1;
      await db
        .update(schema.rfgfActas)
        .set({ aviso: salida.aviso, actualizadoEn: ahora.toISOString() })
        .where(eq(schema.rfgfActas.codActa, codActa));
    } catch (error) {
      const detalle = detalleError(error);
      await anotar(codActa, competicionId, partidoId, "error", detalle, false);
      throw error;
    }
  });
}

/** Todos los PDF de jornadas por jugar. La selección por jornada conserva el criterio de fechas existente. */
export async function traerHorarios(
  competicionId: string,
  descargador: DescargadorRfgf,
  ahora = new Date(),
): Promise<ResumenPeticionRfgf> {
  return pedir(competicionId, async (competicion, resumen) => {
    const partidos = await partidosDeCompeticion(competicionId);
    const numeros = [...new Set(partidos.map((p) => p.jornada))]
      .filter(
        (n) =>
          jornadasPorJugar(
            partidos.filter((p) => p.jornada === n),
            horaLocal(ahora),
          ).length > 0,
      )
      .sort((a, b) => a - b);
    for (const numero of numeros) {
      try {
        await tratarJornada(numero, competicion.grupo, partidos, descargador, resumen);
      } catch (error) {
        resumen.errores.push(`Jornada ${numero} (PDF): ${detalleError(error)}`);
      }
    }
    if (!resumen.errores.length) {
      const { db } = await obtenerDb();
      await db
        .update(schema.rfgfCompeticiones)
        .set({ horariosEn: ahora.toISOString() })
        .where(eq(schema.rfgfCompeticiones.competicionId, competicionId));
    }
  });
}

/** Una pasada de jugadores: como mucho cuatro fichas, más el partido usado para identificarlos si es nuevo. */
export async function traerCifrasJugadores(
  competicionId: string,
  descargador: DescargadorRfgf,
  ahora = new Date(),
): Promise<ResumenPeticionRfgf> {
  return pedir(competicionId, async (competicion, resumen) => {
    resumen.jugadores = await sincronizarJugadores(
      competicionId,
      competicion.categoria,
      competicion.grupo,
      descargador,
      ahora,
    );
    if (!resumen.jugadores)
      resumen.avisos.push("No hay jugadores con un acta de referencia para leer sus cifras.");
  });
}

async function motivosDeComparacion(
  competicionId: string,
  comparacion: ComparacionClasificacion,
  ahora: Date,
): Promise<string[]> {
  const partidos = await partidosDeCompeticion(competicionId);
  return comparacion.diferencias.map((diferencia) => {
    const equipo = diferencia.split(":")[0]!;
    const conocidos: string[] = [];
    if (diferencia.includes("puntos de sanción"))
      conocidos.push("Sanción de puntos publicada por la federación.");
    const delEquipo = partidos.filter(
      (p) =>
        p.jornada <= comparacion.jornada &&
        (parecido(equipo, p.local) >= 0.5 || parecido(equipo, p.visitante) >= 0.5) &&
        (p.conMarcador || (p.fecha && p.fecha <= horaLocal(ahora))),
    );
    for (const p of delEquipo) {
      const cruce = `J${p.jornada} ${p.local} – ${p.visitante}`;
      if (!p.conMarcador)
        conocidos.push(
          `${cruce}: fecha pasada sin resultado en el Studio; no consta aquí si llegó a jugarse.`,
        );
      if (p.conMarcador && (!p.conEventos || (p.propio && !p.conActa)))
        conocidos.push(
          `${cruce}: jugado sin acta completa o sin eventos en el Studio; esto no acredita la causa de la diferencia de clasificación.`,
        );
    }
    // La diferencia ya se enseña al lado: aquí solo va su explicación.
    return conocidos.length ? conocidos.join(" ") : "No hay un motivo conocido para esta diferencia.";
  });
}

/** Compara primero; solo si difiere recupera PDF de jornadas jugadas sin resultado y contrasta de nuevo. */
export async function actualizarClasificacion(
  competicionId: string,
  descargador: DescargadorRfgf,
  ahora = new Date(),
): Promise<ResultadoClasificacionRfgf> {
  const vacio: ResultadoClasificacionRfgf = {
    cuadra: false,
    jornadaOficial: null,
    diferencias: [],
    motivos: [],
    avisos: [],
    errores: [],
  };
  return (
    (await conCandadoRfgf(async () => {
      const competicion = await competicionEnlazada(competicionId);
      if (competicion.formato !== "liga")
        return { ...vacio, avisos: ["Esta competición no tiene clasificación de liga."] };
      const partidos = await partidosDeCompeticion(competicionId);
      const jugados = partidos.filter(
        (p) => p.conMarcador || (p.fecha && p.fecha <= horaLocal(ahora)),
      );
      if (!jugados.length)
        return { ...vacio, avisos: ["Todavía no hay jornadas jugadas que comparar."] };
      const jornada = Math.max(...jugados.map((p) => p.jornada));
      const errores: string[] = [];
      try {
        let comparacion = await compararConOficial(
          competicionId,
          competicion.grupo,
          descargador,
          ahora,
          jornada,
        );
        if (!comparacion)
          return {
            ...vacio,
            avisos: ["La federación no ha devuelto una clasificación oficial con equipos."],
          };
        if (comparacion.diferencias.length) {
          const pendientes = [
            ...new Set(
              jugados
                .filter((p) => !p.conMarcador && p.jornada <= comparacion!.jornada)
                .map((p) => p.jornada),
            ),
          ].sort((a, b) => a - b);
          const resumen = resumenVacio(competicionId);
          for (const numero of pendientes) {
            try {
              await tratarJornada(numero, competicion.grupo, partidos, descargador, resumen);
            } catch (error) {
              errores.push(`Jornada ${numero}: ${detalleError(error)}`);
            }
          }
          if (pendientes.length) {
            const nueva = await compararConOficial(
              competicionId,
              competicion.grupo,
              descargador,
              ahora,
              comparacion.jornada,
            );
            if (nueva) comparacion = nueva;
            else errores.push("No se pudo volver a contrastar la clasificación oficial.");
          }
        }
        const { db } = await obtenerDb();
        await db
          .update(schema.rfgfCompeticiones)
          .set({ clasificacion: comparacion })
          .where(eq(schema.rfgfCompeticiones.competicionId, competicionId));
        return {
          cuadra: comparacion.diferencias.length === 0 && errores.length === 0,
          jornadaOficial: comparacion.jornada,
          diferencias: comparacion.diferencias,
          motivos: await motivosDeComparacion(competicionId, comparacion, ahora),
          avisos: [],
          errores,
        };
      } catch (error) {
        return { ...vacio, errores: [...errores, detalleError(error)] };
      }
    })) ?? { ...vacio, avisos: [AVISO_RFGF_OCUPADA] }
  );
}
