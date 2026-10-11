import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parsearFichaPdf } from "@santiso/actas";
import { DIR_DATOS, schema } from "@santiso/db";
import { aliasedTable, and, eq, inArray, sql } from "drizzle-orm";
import { enlazarActa } from "@/lib/actas/enlazar";
import { actaDeFicha } from "@/lib/actas/ficha-a-acta";
import { mejorCampo } from "@/lib/importar/emparejar";
import { grupoDeEnlace, urlActaPdf, urlJornada, type GrupoRfgf } from "@/lib/rfgf/enlace";
import { partidosDeJornada } from "@/lib/rfgf/jornada";
import { jornadasPendientes, leFaltaAlgo, partidoDeActa, type PartidoLocal } from "@/lib/rfgf/plan";
import { guardarActa } from "@/lib/server/acciones/actas";
import { guardarMarcador } from "@/lib/server/acciones/calendario";
import { listarCampos } from "@/lib/server/consultas/campos";
import { listarJugadores } from "@/lib/server/consultas/jugadores";
import { obtenerDb } from "@/lib/server/db";
import type { DescargadorRfgf } from "./descargador";

type EstadoActa = (typeof schema.ESTADOS_ACTA_RFGF)[number];

export interface ResumenRfgf {
  competicionId: string;
  competicion: string;
  /** Marcadores guardados en esta pasada. */
  resultados: number;
  /** Actas del Santiso guardadas enteras en esta pasada. */
  actas: number;
  /** Actas que no se pudieron guardar solas, con el motivo. */
  revisar: string[];
  errores: string[];
}

/** Carpeta donde queda el PDF de un acta que hay que revisar a mano. */
export const DIR_RFGF = path.join(DIR_DATOS, "rfgf");

/** Hora local de pared con el formato de `partidos.fecha`. */
function horaLocal(ahora: Date): string {
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}T${dos(ahora.getHours())}:${dos(ahora.getMinutes())}`;
}

async function partidosDeCompeticion(competicionId: string): Promise<PartidoLocal[]> {
  const { db } = await obtenerDb();
  const local = aliasedTable(schema.equipos, "local");
  const visitante = aliasedTable(schema.equipos, "visitante");
  const filas = await db
    .select({
      id: schema.partidos.id,
      jornada: schema.jornadas.numero,
      local: local.nombre,
      visitante: visitante.nombre,
      localPropio: local.esPropio,
      visitantePropio: visitante.esPropio,
      fecha: schema.partidos.fecha,
      golesLocal: schema.partidos.golesLocal,
      participaciones: sql<number>`(select count(*) from ${schema.partidoParticipaciones} where ${schema.partidoParticipaciones.partidoId} = ${schema.partidos.id})`,
    })
    .from(schema.partidos)
    .innerJoin(schema.jornadas, eq(schema.jornadas.id, schema.partidos.jornadaId))
    .innerJoin(local, eq(local.id, schema.partidos.equipoLocalId))
    .innerJoin(visitante, eq(visitante.id, schema.partidos.equipoVisitanteId))
    .where(eq(schema.jornadas.competicionId, competicionId));
  return filas.map((f) => ({
    id: f.id,
    jornada: f.jornada,
    local: f.local,
    visitante: f.visitante,
    fecha: f.fecha,
    conMarcador: f.golesLocal !== null,
    propio: f.localPropio || f.visitantePropio,
    conActa: Number(f.participaciones) > 0,
  }));
}

async function anotar(
  codActa: string,
  competicionId: string,
  partidoId: string | null,
  estado: EstadoActa,
  detalle: string,
) {
  const { db } = await obtenerDb();
  const valores = { competicionId, partidoId, estado, detalle: detalle.slice(0, 500) };
  await db
    .insert(schema.rfgfActas)
    .values({ codActa, ...valores })
    .onConflictDoUpdate({ target: schema.rfgfActas.codActa, set: valores });
}

/** Trae un acta cerrada: guarda el marcador y, si juega el Santiso y todo cuadra, el acta. */
async function tratarActa(
  codActa: string,
  grupo: GrupoRfgf,
  competicion: { id: string; categoria: string },
  enLaWeb: { local: string; visitante: string },
  candidatos: readonly PartidoLocal[],
  descargador: DescargadorRfgf,
  resumen: ResumenRfgf,
) {
  const cruce = `${enLaWeb.local} – ${enLaWeb.visitante}`;
  const partido = partidoDeActa(enLaWeb.local, enLaWeb.visitante, candidatos);
  if (!partido) {
    resumen.revisar.push(`${cruce}: no encuentro ese partido en la jornada.`);
    return anotar(codActa, competicion.id, null, "revisar", "No se encontró el partido.");
  }
  // Nada que traer: no se descarga el PDF.
  if (!leFaltaAlgo(partido)) {
    return anotar(codActa, competicion.id, partido.id, partido.propio ? "guardada" : "resultado", "Ya estaba.");
  }

  const pdf = await descargador.pdf(urlActaPdf(grupo, codActa));
  const ficha = await parsearFichaPdf(pdf);
  const [golesLocal, golesVisitante] = ficha.marcador;

  if (!partido.propio) {
    const marcador = await guardarMarcador(partido.id, String(golesLocal), String(golesVisitante));
    if (!marcador.ok) throw new Error(marcador.error);
    resumen.resultados += 1;
    return anotar(codActa, competicion.id, partido.id, "resultado", `${golesLocal}–${golesVisitante}`);
  }

  // Partido del Santiso: el acta entera, pero solo si todos los jugadores se reconocen.
  const { db } = await obtenerDb();
  const [equipos] = await db
    .select({ localPropio: schema.equipos.esPropio })
    .from(schema.partidos)
    .innerJoin(schema.equipos, eq(schema.equipos.id, schema.partidos.equipoLocalId))
    .where(eq(schema.partidos.id, partido.id));
  const plantilla = await listarJugadores(competicion.categoria);
  const { acta, dudas } = enlazarActa(actaDeFicha(ficha, equipos?.localPropio ?? false), plantilla);

  if (dudas.length > 0) {
    // El marcador sí se guarda: no depende de reconocer a nadie.
    if (!partido.conMarcador) {
      const marcador = await guardarMarcador(partido.id, String(golesLocal), String(golesVisitante));
      if (marcador.ok) resumen.resultados += 1;
    }
    await mkdir(DIR_RFGF, { recursive: true });
    await writeFile(path.join(DIR_RFGF, `${codActa}.pdf`), pdf);
    const motivo = `no reconozco a ${dudas.join(", ")}`;
    resumen.revisar.push(`${cruce}: ${motivo}.`);
    return anotar(codActa, competicion.id, partido.id, "revisar", motivo);
  }

  // Si el campo ya está en el catálogo se usa ese; si no, `guardarActa` lo da de alta.
  const campoId = mejorCampo(acta.campoNombre, acta.campoPoblacion, await listarCampos());
  const lista = campoId ? { ...acta, campoId, campoNombre: "", campoPoblacion: "" } : acta;
  const guardado = await guardarActa(partido.id, lista);
  if (!guardado.ok) {
    resumen.revisar.push(`${cruce}: ${guardado.error}`);
    return anotar(codActa, competicion.id, partido.id, "revisar", guardado.error);
  }
  resumen.actas += 1;
  const convocados = lista.titulares.length + lista.suplentes.length;
  return anotar(
    codActa,
    competicion.id,
    partido.id,
    "guardada",
    `${golesLocal}–${golesVisitante}, ${convocados} convocados, ${lista.eventos.length} eventos`,
  );
}

/**
 * Mira en la federación las jornadas de una competición que tienen algo pendiente y guarda lo
 * que haya nuevo. No lanza: lo que falle queda en `errores` y se reintenta en la siguiente
 * pasada.
 */
export async function sincronizarCompeticion(
  competicionId: string,
  descargador: DescargadorRfgf,
  ahora = new Date(),
): Promise<ResumenRfgf | null> {
  const { db } = await obtenerDb();
  const [fila] = await db
    .select({
      enlace: schema.rfgfCompeticiones.enlace,
      nombre: schema.competiciones.nombre,
      categoria: schema.competiciones.categoria,
    })
    .from(schema.rfgfCompeticiones)
    .innerJoin(
      schema.competiciones,
      eq(schema.competiciones.id, schema.rfgfCompeticiones.competicionId),
    )
    .where(eq(schema.rfgfCompeticiones.competicionId, competicionId));
  const grupo = fila ? grupoDeEnlace(fila.enlace) : null;
  if (!fila || !grupo) return null;

  const resumen: ResumenRfgf = {
    competicionId,
    competicion: fila.nombre,
    resultados: 0,
    actas: 0,
    revisar: [],
    errores: [],
  };
  const partidos = await partidosDeCompeticion(competicionId);

  for (const jornada of jornadasPendientes(partidos, horaLocal(ahora))) {
    try {
      const enLaWeb = partidosDeJornada(await descargador.html(urlJornada(grupo, jornada))).filter(
        (p): p is typeof p & { codActa: string } => p.codActa !== null,
      );
      if (enLaWeb.length === 0) continue;
      // Las que ya se trataron no se vuelven a descargar; las que fallaron, sí.
      const tratadas = await db
        .select({ codActa: schema.rfgfActas.codActa })
        .from(schema.rfgfActas)
        .where(
          and(
            inArray(
              schema.rfgfActas.codActa,
              enLaWeb.map((p) => p.codActa),
            ),
            inArray(schema.rfgfActas.estado, ["resultado", "guardada", "revisar"]),
          ),
        );
      const hechas = new Set(tratadas.map((t) => t.codActa));
      const candidatos = partidos.filter((p) => p.jornada === jornada);
      for (const acta of enLaWeb) {
        if (hechas.has(acta.codActa)) continue;
        try {
          await tratarActa(
            acta.codActa,
            grupo,
            { id: competicionId, categoria: fila.categoria },
            acta,
            candidatos,
            descargador,
            resumen,
          );
        } catch (error) {
          const detalle = error instanceof Error ? error.message : "fallo desconocido";
          resumen.errores.push(`${acta.local} – ${acta.visitante}: ${detalle}`);
          await anotar(acta.codActa, competicionId, null, "error", detalle);
        }
      }
    } catch (error) {
      const detalle = error instanceof Error ? error.message : "fallo desconocido";
      resumen.errores.push(`Jornada ${jornada}: ${detalle}`);
    }
  }

  const partes = [
    resumen.actas ? `${resumen.actas} acta${resumen.actas > 1 ? "s" : ""} guardada${resumen.actas > 1 ? "s" : ""}` : "",
    resumen.resultados ? `${resumen.resultados} resultado${resumen.resultados > 1 ? "s" : ""}` : "",
    resumen.revisar.length ? `${resumen.revisar.length} por revisar` : "",
    resumen.errores.length ? `${resumen.errores.length} con error` : "",
  ].filter(Boolean);
  await db
    .update(schema.rfgfCompeticiones)
    .set({
      comprobadoEn: ahora.toISOString(),
      // Una pasada sin novedades no borra lo último que pasó.
      ...(partes.length > 0 ? { resumen: partes.join(" · ") } : {}),
    })
    .where(eq(schema.rfgfCompeticiones.competicionId, competicionId));
  return resumen;
}

let enMarcha = false;

/** Sincroniza todas las competiciones enlazadas de la temporada activa. Nunca dos a la vez. */
export async function sincronizarTodo(
  descargador: DescargadorRfgf,
  ahora = new Date(),
): Promise<ResumenRfgf[]> {
  if (enMarcha) return [];
  enMarcha = true;
  try {
    const { db } = await obtenerDb();
    const enlazadas = await db
      .select({ id: schema.rfgfCompeticiones.competicionId })
      .from(schema.rfgfCompeticiones)
      .innerJoin(
        schema.competiciones,
        eq(schema.competiciones.id, schema.rfgfCompeticiones.competicionId),
      )
      .innerJoin(schema.temporadas, eq(schema.temporadas.id, schema.competiciones.temporadaId))
      .where(eq(schema.temporadas.activa, true));
    const resumenes: ResumenRfgf[] = [];
    for (const { id } of enlazadas) {
      const resumen = await sincronizarCompeticion(id, descargador, ahora);
      if (resumen) resumenes.push(resumen);
    }
    return resumenes;
  } finally {
    enMarcha = false;
  }
}
