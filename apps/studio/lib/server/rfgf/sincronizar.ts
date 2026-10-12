import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  marcadorDeFichaPdf,
  parsearFichaPdf,
  parsearJornadaPdf,
  type Ficha,
} from "@santiso/actas";
import { DIR_DATOS, schema } from "@santiso/db";
import { aliasedTable, and, eq, inArray, sql } from "drizzle-orm";
import { enlazarActa } from "@/lib/actas/enlazar";
import { actaDeFicha } from "@/lib/actas/ficha-a-acta";
import { mejorCampo } from "@/lib/importar/emparejar";
import {
  grupoDeEnlace,
  urlActaPdf,
  urlJornada,
  urlJornadaPdf,
  type GrupoRfgf,
} from "@/lib/rfgf/enlace";
import {
  cambioDeHorario,
  fechaBreve,
  fechaDeFederacion,
  DIAS_BUSCANDO_ARBITRO,
  jornadasPorJugar,
  jornadasSinArbitro,
  nombreDeArbitro,
  tocaMirarHorarios,
} from "@/lib/rfgf/horarios";
import { partidosDeJornada } from "@/lib/rfgf/jornada";
import { eventosDeFicha } from "@/lib/liga/eventos";
import {
  jornadaSinEventos,
  jornadasPendientes,
  leFaltaAlgo,
  partidoDeActa,
  type PartidoLocal,
} from "@/lib/rfgf/plan";
import { guardarActa } from "@/lib/server/acciones/actas";
import {
  cambiarCampoPartido,
  cambiarFechaPartido,
  guardarMarcador,
} from "@/lib/server/acciones/calendario";
import { asegurarCampo } from "@/lib/server/acciones/campos";
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
  /** Cambios de día, hora o campo traídos de la federación, uno por línea. */
  horarios: string[];
  /** Actas que no se pudieron guardar solas, con el motivo. */
  revisar: string[];
  errores: string[];
}

/** Un acta suele cerrarse el mismo día; pasado este plazo ya solo se mira una vez al día. */
const DIAS_RECIENTES = 10;

/** Carpeta donde queda el PDF de un acta que hay que revisar a mano. */
export const DIR_RFGF = path.join(DIR_DATOS, "rfgf");

/** Hora local de pared con el formato de `partidos.fecha`. */
function horaLocal(ahora: Date): string {
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}T${dos(ahora.getHours())}:${dos(ahora.getMinutes())}`;
}

/** Un partido con los equipos de cada lado, para apuntar a quién pertenece cada evento. */
type PartidoConEquipos = PartidoLocal & { equipos: { local: string; visitante: string } };

async function partidosDeCompeticion(competicionId: string): Promise<PartidoConEquipos[]> {
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
      campoId: schema.partidos.campoId,
      arbitro: schema.partidos.arbitro,
      golesLocal: schema.partidos.golesLocal,
      participaciones: sql<number>`(select count(*) from ${schema.partidoParticipaciones} where ${schema.partidoParticipaciones.partidoId} = ${schema.partidos.id})`,
      eventos: sql<number>`(select count(*) from ${schema.rfgfActas} where ${schema.rfgfActas.partidoId} = ${schema.partidos.id} and ${schema.rfgfActas.eventos} = 1)`,
      equipoLocalId: schema.partidos.equipoLocalId,
      equipoVisitanteId: schema.partidos.equipoVisitanteId,
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
    campoId: f.campoId,
    conArbitro: Boolean(f.arbitro),
    conMarcador: f.golesLocal !== null,
    propio: f.localPropio || f.visitantePropio,
    conActa: Number(f.participaciones) > 0,
    conEventos: Number(f.eventos) > 0,
    equipos: { local: f.equipoLocalId, visitante: f.equipoVisitanteId },
  }));
}

async function anotar(
  codActa: string,
  competicionId: string,
  partidoId: string | null,
  estado: EstadoActa,
  detalle: string,
  /** Ya se miraron sus goles y tarjetas (se pudieran leer o no): no hay que volver a por ella. */
  eventos = true,
) {
  const { db } = await obtenerDb();
  const valores = { competicionId, partidoId, estado, detalle: detalle.slice(0, 500), eventos };
  await db
    .insert(schema.rfgfActas)
    .values({ codActa, ...valores })
    .onConflictDoUpdate({ target: schema.rfgfActas.codActa, set: valores });
}

/**
 * Lee el PDF de una jornada y pone al día lo que traiga: el marcador de los partidos jugados
 * que aún no lo tienen y, de los que quedan por jugar, día, hora y campo. Devuelve cuántas
 * cosas cambió. Una sola descarga por jornada.
 */
async function tratarJornada(
  jornada: number,
  grupo: GrupoRfgf,
  partidos: readonly PartidoLocal[],
  descargador: DescargadorRfgf,
  resumen: ResumenRfgf,
): Promise<number> {
  const leida = await parsearJornadaPdf(await descargador.pdf(urlJornadaPdf(grupo, jornada)));
  if (leida.numero !== jornada) throw new Error("La federación devolvió otra jornada.");
  const candidatos = partidos.filter((p) => p.jornada === jornada);
  const { db } = await obtenerDb();
  let cambios = 0;
  for (const enPdf of leida.partidos) {
    // Si el cruce no se reconoce no se toca nada: de eso ya avisa la lectura de actas.
    const partido = partidoDeActa(enPdf.local, enPdf.visitante, candidatos);
    if (!partido) continue;
    // El árbitro sale en cuanto la jornada se cierra, tenga o no marcador ya el partido.
    if (enPdf.arbitro && !partido.conArbitro) {
      await db
        .update(schema.partidos)
        .set({ arbitro: nombreDeArbitro(enPdf.arbitro) })
        .where(eq(schema.partidos.id, partido.id));
    }
    if (partido.conMarcador) continue;

    if (enPdf.marcador) {
      const [local, visitante] = enPdf.marcador;
      const guardado = await guardarMarcador(partido.id, String(local), String(visitante));
      if (!guardado.ok) throw new Error(guardado.error);
      resumen.resultados += 1;
      cambios += 1;
      continue;
    }

    const federacion = {
      fecha: fechaDeFederacion(enPdf.fecha, enPdf.hora),
      campo: enPdf.campo ?? "",
    };
    const cambio = cambioDeHorario(federacion, partido);
    {
      const dicho: string[] = [];
      if (cambio.fecha) {
        const fecha = await cambiarFechaPartido(partido.id, cambio.fecha);
        if (!fecha.ok) throw new Error(fecha.error);
        dicho.push(fechaBreve(cambio.fecha));
      }
      if (cambio.campo) {
        // El del catálogo si ya está; si no, se da de alta con las reglas de siempre.
        let campoId = mejorCampo(cambio.campo, "", await listarCampos());
        if (!campoId) {
          const creado = await asegurarCampo(cambio.campo, null);
          if (!creado.ok) throw new Error(creado.error);
          campoId = creado.datos.id;
        }
        if (campoId !== partido.campoId) {
          const campo = await cambiarCampoPartido(partido.id, campoId);
          if (!campo.ok) throw new Error(campo.error);
          dicho.push(cambio.campo);
        }
      }
      if (dicho.length) {
        const linea = `J${jornada} ${partido.local} – ${partido.visitante}: ${dicho.join(" · ")}`;
        // Los del Santiso, delante: en el panel solo caben los primeros.
        if (partido.propio) resumen.horarios.unshift(linea);
        else resumen.horarios.push(linea);
        cambios += 1;
      }
    }
    await db
      .insert(schema.rfgfPartidos)
      .values({ partidoId: partido.id, ...federacion })
      .onConflictDoUpdate({ target: schema.rfgfPartidos.partidoId, set: federacion });
  }
  return cambios;
}

/** Apunta los goles y las tarjetas de un acta en las tablas de la liga, sustituyendo los que hubiera. */
async function guardarEventosDeLiga(partido: PartidoConEquipos, ficha: Ficha) {
  const { db } = await obtenerDb();
  const filas = eventosDeFicha(ficha).map(({ lado, ...evento }) => ({
    partidoId: partido.id,
    equipoId: partido.equipos[lado],
    ...evento,
  }));
  await db.transaction(async (tx) => {
    await tx.delete(schema.ligaEventos).where(eq(schema.ligaEventos.partidoId, partido.id));
    if (filas.length) await tx.insert(schema.ligaEventos).values(filas);
  });
}

/**
 * Trae un acta cerrada: apunta sus goles y tarjetas para las tablas de la liga, guarda el
 * marcador si falta y, si juega el Santiso y todo cuadra, el acta entera.
 */
async function tratarActa(
  codActa: string,
  grupo: GrupoRfgf,
  competicion: { id: string; categoria: string },
  enLaWeb: { local: string; visitante: string },
  candidatos: readonly PartidoConEquipos[],
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
  if (!leFaltaAlgo(partido) && partido.conEventos) {
    return anotar(codActa, competicion.id, partido.id, partido.propio ? "guardada" : "resultado", "Ya estaba.");
  }

  // Un fallo de red sale de aquí como excepción y se reintenta en la siguiente pasada. Lo que
  // venga después (no saber leer el PDF) no mejora reintentando: queda para revisar.
  const pdf = await descargador.pdf(urlActaPdf(grupo, codActa));
  // Primero la lectura completa, que es la exacta. Si tropieza con algo (un evento escrito de
  // forma rara), queda la tolerante, que solo busca el marcador.
  let ficha: Ficha | null = null;
  let tropiezo = "formato desconocido";
  try {
    ficha = await parsearFichaPdf(pdf);
  } catch (error) {
    if (error instanceof Error) tropiezo = error.message;
  }
  if (ficha) await guardarEventosDeLiga(partido, ficha);
  else if (!partido.conEventos) {
    resumen.revisar.push(`${cruce}: no pude leer sus goles y tarjetas (${tropiezo}).`);
  }
  // Solo faltaban los goles y las tarjetas: lo demás del partido no se toca.
  if (!leFaltaAlgo(partido)) {
    const estado = partido.propio ? "guardada" : "resultado";
    return anotar(codActa, competicion.id, partido.id, estado, "Goles y tarjetas apuntados.");
  }
  const leido = ficha?.marcador ?? (await marcadorDeFichaPdf(pdf).catch(() => null));
  const dejarPdf = async () => {
    await mkdir(DIR_RFGF, { recursive: true });
    await writeFile(path.join(DIR_RFGF, `${codActa}.pdf`), pdf);
  };
  if (!leido) {
    await dejarPdf();
    resumen.revisar.push(`${cruce}: no supe leer el marcador del PDF.`);
    return anotar(codActa, competicion.id, partido.id, "revisar", "no supe leer el PDF");
  }
  const [golesLocal, golesVisitante] = leido;
  const ponerMarcador = async () => {
    const marcador = await guardarMarcador(partido.id, String(golesLocal), String(golesVisitante));
    if (!marcador.ok) throw new Error(marcador.error);
    resumen.resultados += 1;
  };

  // Partido ajeno: solo interesa el resultado, y para eso basta el marcador.
  if (!partido.propio) {
    if (!partido.conMarcador) await ponerMarcador();
    return anotar(codActa, competicion.id, partido.id, "resultado", `${golesLocal}–${golesVisitante}`);
  }

  if (!ficha) {
    if (!partido.conMarcador) await ponerMarcador();
    await dejarPdf();
    const motivo = `no supe leer el acta (${tropiezo})`;
    resumen.revisar.push(`${cruce}: ${motivo}.`);
    return anotar(codActa, competicion.id, partido.id, "revisar", motivo);
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
    if (!partido.conMarcador) await ponerMarcador();
    await dejarPdf();
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
  /** Solo partidos de los últimos días: es la comprobación frecuente. Sin él, todos. */
  soloRecientes = false,
): Promise<ResumenRfgf | null> {
  const { db } = await obtenerDb();
  const [fila] = await db
    .select({
      enlace: schema.rfgfCompeticiones.enlace,
      horariosEn: schema.rfgfCompeticiones.horariosEn,
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
    horarios: [],
    revisar: [],
    errores: [],
  };
  let partidos = await partidosDeCompeticion(competicionId);

  const desde = soloRecientes
    ? horaLocal(new Date(ahora.getTime() - DIAS_RECIENTES * 86_400_000))
    : undefined;

  // Primero el PDF de cada jornada: de una sola descarga salen los marcadores de todos los
  // partidos jugados y los horarios de los que quedan. Los horarios, cada pocas horas.
  const mirarHorarios = tocaMirarHorarios(fila.horariosEn, ahora);
  const jornadasPdf = new Set([
    ...jornadasPendientes(partidos, horaLocal(ahora), desde),
    ...(mirarHorarios ? jornadasPorJugar(partidos, horaLocal(ahora)) : []),
    // Con la misma cadencia, el árbitro de lo ya jugado que aún no lo tenga.
    ...(mirarHorarios
      ? jornadasSinArbitro(
          partidos,
          horaLocal(ahora),
          horaLocal(new Date(ahora.getTime() - DIAS_BUSCANDO_ARBITRO * 86_400_000)),
        )
      : []),
  ]);
  let cambiosPdf = 0;
  for (const jornada of jornadasPdf) {
    try {
      cambiosPdf += await tratarJornada(jornada, grupo, partidos, descargador, resumen);
    } catch (error) {
      const detalle = error instanceof Error ? error.message : "fallo desconocido";
      resumen.errores.push(`Jornada ${jornada} (PDF): ${detalle}`);
    }
  }
  // Con los marcadores ya puestos, a las jornadas solo les falta, si acaso, el acta del Santiso.
  if (cambiosPdf > 0) partidos = await partidosDeCompeticion(competicionId);

  // Además de lo pendiente, con la cadencia de los horarios se va completando una jornada ya
  // jugada cuyos goles y tarjetas aún no estén en las tablas de la liga.
  const atrasada = mirarHorarios ? jornadaSinEventos(partidos, horaLocal(ahora)) : null;
  const jornadasActas = new Set([
    ...jornadasPendientes(partidos, horaLocal(ahora), desde),
    ...(atrasada === null ? [] : [atrasada]),
  ]);
  for (const jornada of jornadasActas) {
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
            eq(schema.rfgfActas.eventos, true),
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
    // Los cambios de horario se cuentan con su detalle: es lo que hay que saber de un vistazo.
    ...resumen.horarios.slice(0, 3),
    resumen.horarios.length > 3 ? `y ${resumen.horarios.length - 3} horarios más` : "",
    resumen.revisar.length ? `${resumen.revisar.length} por revisar` : "",
    resumen.errores.length ? `${resumen.errores.length} con error` : "",
  ].filter(Boolean);
  await db
    .update(schema.rfgfCompeticiones)
    .set({
      comprobadoEn: ahora.toISOString(),
      ...(mirarHorarios ? { horariosEn: ahora.toISOString() } : {}),
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
  soloRecientes = false,
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
      const resumen = await sincronizarCompeticion(id, descargador, ahora, soloRecientes);
      if (resumen) resumenes.push(resumen);
    }
    return resumenes;
  } finally {
    enMarcha = false;
  }
}
