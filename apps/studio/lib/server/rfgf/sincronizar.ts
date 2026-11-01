import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  marcadorDeFichaPdf,
  parsearClasificacionPdf,
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
  urlClasificacionPdf,
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
import { alineacionesDeFicha, eventosDeFicha } from "@/lib/liga/eventos";
import {
  jornadasSinEventos,
  jornadasPendientes,
  leFaltaAlgo,
  partidoDeActa,
  type PartidoLocal,
} from "@/lib/rfgf/plan";
import { compararClasificacion } from "@/lib/rfgf/clasificacion";
import { guardarActa } from "@/lib/server/acciones/actas";
import {
  cambiarCampoPartido,
  cambiarFechaPartido,
  guardarMarcador,
} from "@/lib/server/acciones/calendario";
import { asegurarCampo } from "@/lib/server/acciones/campos";
import { listarCampos } from "@/lib/server/consultas/campos";
import { clasificacionDeCompeticion } from "@/lib/server/consultas/clasificacion";
import { listarJugadores } from "@/lib/server/consultas/jugadores";
import { obtenerDb } from "@/lib/server/db";
import type { DescargadorRfgf } from "./descargador";
import { actualizarCrucesDeCopa } from "./calendario";
import { sincronizarJugadores } from "./jugadores";
import { conCandadoRfgf } from "./candado";

type EstadoActa = (typeof schema.ESTADOS_ACTA_RFGF)[number];

export interface ResumenRfgf {
  competicionId: string;
  competicion: string;
  /** Marcadores guardados en esta pasada. */
  resultados: number;
  /** Actas del Santiso guardadas enteras en esta pasada. */
  actas: number;
  /** Cruces de copa añadidos tras un sorteo. */
  crucesNuevos?: number;
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
export function horaLocal(ahora: Date): string {
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}T${dos(ahora.getHours())}:${dos(ahora.getMinutes())}`;
}

/** Un partido con los equipos de cada lado, para apuntar a quién pertenece cada evento. */
export type PartidoConEquipos = PartidoLocal & {
  equipos: { local: string; visitante: string };
  golesLocal: number | null;
  golesVisitante: number | null;
  arbitro: string | null;
};

export async function partidosDeCompeticion(competicionId: string): Promise<PartidoConEquipos[]> {
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
      golesVisitante: schema.partidos.golesVisitante,
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
    arbitro: f.arbitro,
    conMarcador: f.golesLocal !== null,
    golesLocal: f.golesLocal,
    golesVisitante: f.golesVisitante,
    propio: f.localPropio || f.visitantePropio,
    conActa: Number(f.participaciones) > 0,
    conEventos: Number(f.eventos) > 0,
    equipos: { local: f.equipoLocalId, visitante: f.equipoVisitanteId },
  }));
}

export async function anotar(
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

/** El campo del catálogo si ya está; si no, se da de alta con las reglas de siempre. */
async function campoDeFederacion(nombre: string): Promise<string> {
  const conocido = mejorCampo(nombre, "", await listarCampos());
  if (conocido) return conocido;
  const creado = await asegurarCampo(nombre, null);
  if (!creado.ok) throw new Error(creado.error);
  return creado.datos.id;
}

/**
 * Lee el PDF de una jornada y pone al día lo que traiga: el marcador de los partidos jugados
 * que aún no lo tienen y, de los que quedan por jugar, día, hora y campo. Devuelve cuántas
 * cosas cambió. Una sola descarga por jornada.
 */
export async function tratarJornada(
  jornada: number,
  grupo: GrupoRfgf,
  partidos: readonly PartidoConEquipos[],
  descargador: DescargadorRfgf,
  resumen: ResumenRfgf,
  /** A mano la publicación oficial también corrige un resultado anterior. */
  actualizarResultados = false,
): Promise<number> {
  const leida = await parsearJornadaPdf(await descargador.pdf(urlJornadaPdf(grupo, jornada)));
  // Una ronda de copa no va numerada: ahí responde el cruce, que debe ser de esta jornada.
  if (leida.numero !== null && leida.numero !== jornada) {
    throw new Error("La federación devolvió otra jornada.");
  }
  const candidatos = partidos.filter((p) => p.jornada === jornada);
  const { db } = await obtenerDb();
  let cambios = 0;
  for (const enPdf of leida.partidos) {
    // Si el cruce no se reconoce no se toca nada: de eso ya avisa la lectura de actas.
    const partido = partidoDeActa(enPdf.local, enPdf.visitante, candidatos);
    if (!partido) continue;
    // El árbitro sale en cuanto la jornada se cierra, tenga o no marcador ya el partido. Si la
    // federación lo corrige después, manda lo suyo: ya se tiene el PDF y no cuesta nada.
    const arbitro = enPdf.arbitro ? nombreDeArbitro(enPdf.arbitro) : null;
    if (arbitro && arbitro !== partido.arbitro) {
      await db.update(schema.partidos).set({ arbitro }).where(eq(schema.partidos.id, partido.id));
    }
    if (partido.conMarcador && !actualizarResultados) continue;

    if (enPdf.marcador) {
      const [local, visitante] = enPdf.marcador;
      if (partido.golesLocal === local && partido.golesVisitante === visitante) continue;
      const guardado = await guardarMarcador(partido.id, String(local), String(visitante));
      if (!guardado.ok) throw new Error(guardado.error);
      resumen.resultados += 1;
      cambios += 1;
      // Recién importado, un partido ya jugado no tiene ni día ni campo: sin ellos no se buscaría
      // su acta. Solo se rellena; lo que ya tuviera lo pone al día la pasada de horarios.
      if (!partido.fecha) {
        const fecha = await cambiarFechaPartido(
          partido.id,
          fechaDeFederacion(enPdf.fecha, enPdf.hora),
        );
        if (!fecha.ok) throw new Error(fecha.error);
        if (enPdf.campo && !partido.campoId) {
          const campoId = await campoDeFederacion(enPdf.campo);
          const campo = await cambiarCampoPartido(partido.id, campoId);
          if (!campo.ok) throw new Error(campo.error);
        }
      }
      continue;
    }
    // La ausencia de resultado en el PDF no borra uno que ya estuviera guardado.
    if (partido.conMarcador) continue;

    const federacion = {
      fecha: fechaDeFederacion(enPdf.fecha, enPdf.hora),
      campo: enPdf.campo ?? "",
    };
    const cambio = cambioDeHorario(federacion, partido);
    let aviso: { cambio: string; cambioEn: string } | null = null;
    // Solo es un cambio del que avisar si pisa algo que ya había; poner fecha a un partido
    // que no la tenía es rellenar.
    let pisa = false;
    {
      const dicho: string[] = [];
      if (cambio.fecha) {
        const fecha = await cambiarFechaPartido(partido.id, cambio.fecha);
        if (!fecha.ok) throw new Error(fecha.error);
        dicho.push(fechaBreve(cambio.fecha));
        if (partido.fecha) pisa = true;
      }
      if (cambio.campo) {
        const campoId = await campoDeFederacion(cambio.campo);
        if (campoId !== partido.campoId) {
          const campo = await cambiarCampoPartido(partido.id, campoId);
          if (!campo.ok) throw new Error(campo.error);
          dicho.push(cambio.campo);
          if (partido.campoId) pisa = true;
        }
      }
      if (dicho.length) {
        const linea = `J${jornada} ${partido.local} – ${partido.visitante}: ${dicho.join(" · ")}`;
        // Los del Santiso, delante: en el panel solo caben los primeros.
        if (partido.propio) resumen.horarios.unshift(linea);
        else resumen.horarios.push(linea);
        if (pisa) aviso = { cambio: dicho.join(" · "), cambioEn: new Date().toISOString() };
        cambios += 1;
      }
    }
    await db
      .insert(schema.rfgfPartidos)
      .values({ partidoId: partido.id, ...federacion, ...aviso })
      .onConflictDoUpdate({
        target: schema.rfgfPartidos.partidoId,
        set: { ...federacion, ...aviso },
      });
  }
  return cambios;
}

/**
 * Apunta los goles, las tarjetas y las alineaciones de un acta en las tablas de la liga,
 * sustituyendo lo que hubiera.
 */
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
    await guardarAlineacionesDeLiga(partido, ficha, tx);
  });
}

type Transaccion = Parameters<
  Parameters<Awaited<ReturnType<typeof obtenerDb>>["db"]["transaction"]>[0]
>[0];

/** Sustituye las alineaciones de un partido de la liga por las de su acta. */
export async function guardarAlineacionesDeLiga(
  partido: { id: string; equipos: { local: string; visitante: string } },
  ficha: Ficha,
  tx?: Transaccion,
) {
  const alineados = alineacionesDeFicha(ficha).map(({ lado, ...alineado }) => ({
    partidoId: partido.id,
    equipoId: partido.equipos[lado],
    ...alineado,
  }));
  const escribir = async (t: Transaccion) => {
    await t
      .delete(schema.ligaAlineaciones)
      .where(eq(schema.ligaAlineaciones.partidoId, partido.id));
    if (alineados.length) await t.insert(schema.ligaAlineaciones).values(alineados);
  };
  if (tx) return escribir(tx);
  const { db } = await obtenerDb();
  await db.transaction(escribir);
}

/**
 * Trae un acta cerrada: apunta sus goles y tarjetas para las tablas de la liga, guarda el
 * marcador si falta y, si juega el Santiso y todo cuadra, el acta entera.
 */
export async function tratarActa(
  codActa: string,
  grupo: GrupoRfgf,
  competicion: { id: string; categoria: string },
  enLaWeb: { local: string; visitante: string },
  candidatos: readonly PartidoConEquipos[],
  descargador: DescargadorRfgf,
  resumen: ResumenRfgf,
  /** Lo que conviene dejar a la vista del acta aunque lo demás se haya guardado. */
  salida: { aviso: string },
  /** Corrección explícita: sustituye también lo ya guardado. */
  forzar = false,
) {
  const cruce = `${enLaWeb.local} – ${enLaWeb.visitante}`;
  const partido = partidoDeActa(enLaWeb.local, enLaWeb.visitante, candidatos);
  if (!partido) {
    resumen.revisar.push(`${cruce}: no encuentro ese partido en la jornada.`);
    return anotar(codActa, competicion.id, null, "revisar", "No se encontró el partido.");
  }
  // Nada que traer: no se descarga el PDF.
  if (!forzar && !leFaltaAlgo(partido) && partido.conEventos) {
    return anotar(
      codActa,
      competicion.id,
      partido.id,
      partido.propio ? "guardada" : "resultado",
      "Ya estaba.",
    );
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
  else if (!partido.conEventos || forzar) {
    resumen.revisar.push(`${cruce}: no pude leer sus goles y tarjetas (${tropiezo}).`);
    salida.aviso = `No pude leer sus goles y tarjetas (${tropiezo}). Faltan en las tablas de la liga.`;
  }
  // Solo faltaban los goles y las tarjetas: lo demás del partido no se toca.
  if (!forzar && !leFaltaAlgo(partido)) {
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
    if (forzar || !partido.conMarcador) await ponerMarcador();
    return anotar(
      codActa,
      competicion.id,
      partido.id,
      "resultado",
      `${golesLocal}–${golesVisitante}`,
    );
  }

  if (!ficha) {
    if (forzar || !partido.conMarcador) await ponerMarcador();
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
    if (forzar || !partido.conMarcador) await ponerMarcador();
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
 * Baja la clasificación oficial tras la última jornada jugada y la compara con la del Studio.
 * `null` si todavía no se ha jugado nada (no hay con qué comparar).
 */
export async function compararConOficial(
  competicionId: string,
  grupo: GrupoRfgf,
  descargador: DescargadorRfgf,
  ahora: Date,
  /** Bajo demanda se puede contrastar incluso si faltan todos los resultados locales. */
  jornadaPedida?: number,
) {
  const partidos = await partidosDeCompeticion(competicionId);
  const jugadas = partidos.filter((p) => p.conMarcador).map((p) => p.jornada);
  if (jugadas.length === 0 && jornadaPedida === undefined) return null;
  const oficial = await parsearClasificacionPdf(
    await descargador.pdf(urlClasificacionPdf(grupo, jornadaPedida ?? Math.max(...jugadas))),
  );
  if (oficial.filas.length === 0) return null;
  const propia = await clasificacionDeCompeticion(competicionId);
  return {
    jornada: oficial.jornada,
    comparadaEn: ahora.toISOString(),
    ...compararClasificacion(
      oficial.filas,
      propia.map((f) => ({
        equipo: f.nombre,
        puntos: f.puntos,
        jugados: f.jugados,
        golesFavor: f.golesFavor,
        golesContra: f.golesContra,
      })),
    ),
  };
}

/**
 * Mira en la federación las jornadas de una competición que tienen algo pendiente y guarda lo
 * que haya nuevo. No lanza: lo que falle queda en `errores` y se reintenta en la siguiente
 * pasada.
 */
async function sincronizarCompeticionSinCandado(
  competicionId: string,
  descargador: DescargadorRfgf,
  ahora = new Date(),
  /** Solo partidos de los últimos días: es la comprobación frecuente. Sin él, todos. */
  soloRecientes = false,
  /** Pedida a mano: mira también horarios y jornadas atrasadas aunque se hayan mirado hace poco. */
  completa = false,
): Promise<ResumenRfgf | null> {
  const { db } = await obtenerDb();
  const [fila] = await db
    .select({
      enlace: schema.rfgfCompeticiones.enlace,
      horariosEn: schema.rfgfCompeticiones.horariosEn,
      nombre: schema.competiciones.nombre,
      categoria: schema.competiciones.categoria,
      formato: schema.competiciones.formato,
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
  const mirarHorarios = completa || tocaMirarHorarios(fila.horariosEn, ahora);

  // Una copa se va sorteando: con la cadencia de los horarios se añaden los cruces nuevos. La
  // primera carga, con su repaso de equipos, no se hace nunca sola.
  if (mirarHorarios && fila.formato === "eliminatoria" && partidos.length > 0) {
    try {
      resumen.crucesNuevos = await actualizarCrucesDeCopa(competicionId, grupo, descargador);
      if (resumen.crucesNuevos > 0) partidos = await partidosDeCompeticion(competicionId);
    } catch (error) {
      const detalle = error instanceof Error ? error.message : "fallo desconocido";
      resumen.errores.push(`Cruces de la copa: ${detalle}`);
    }
  }

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

  // Además de lo pendiente, con la cadencia de los horarios se van completando las jornadas
  // ya jugadas cuyos goles y tarjetas aún no estén en las tablas de la liga.
  const jornadasActas = new Set([
    ...jornadasPendientes(partidos, horaLocal(ahora), desde),
    ...(mirarHorarios ? jornadasSinEventos(partidos, horaLocal(ahora)) : []),
  ]);
  for (const jornada of jornadasActas) {
    await tratarActasJornada(
      jornada,
      grupo,
      { id: competicionId, categoria: fila.categoria },
      partidos,
      descargador,
      resumen,
    );
  }

  // Con todo ya guardado, la clasificación del Studio se contrasta con la oficial de la última
  // jornada jugada. Una descarga más, con la cadencia de los horarios.
  let comparacion: Awaited<ReturnType<typeof compararConOficial>> = null;
  if (mirarHorarios && fila.formato === "liga") {
    try {
      comparacion = await compararConOficial(competicionId, grupo, descargador, ahora);
    } catch (error) {
      const detalle = error instanceof Error ? error.message : "fallo desconocido";
      resumen.errores.push(`Clasificación oficial: ${detalle}`);
    }
  }

  // Y las cifras oficiales de unos pocos jugadores del club, para contrastar las del Studio.
  if (mirarHorarios) {
    try {
      await sincronizarJugadores(competicionId, fila.categoria, grupo, descargador, ahora);
    } catch (error) {
      const detalle = error instanceof Error ? error.message : "fallo desconocido";
      resumen.errores.push(`Estadísticas de jugadores: ${detalle}`);
    }
  }

  const partes = [
    resumen.actas
      ? `${resumen.actas} acta${resumen.actas > 1 ? "s" : ""} guardada${resumen.actas > 1 ? "s" : ""}`
      : "",
    resumen.resultados ? `${resumen.resultados} resultado${resumen.resultados > 1 ? "s" : ""}` : "",
    resumen.crucesNuevos
      ? `${resumen.crucesNuevos} cruce${resumen.crucesNuevos > 1 ? "s" : ""} nuevo${resumen.crucesNuevos > 1 ? "s" : ""}`
      : "",
    // Los cambios de horario se cuentan con su detalle: es lo que hay que saber de un vistazo.
    ...resumen.horarios.slice(0, 3),
    resumen.horarios.length > 3 ? `y ${resumen.horarios.length - 3} horarios más` : "",
    comparacion?.diferencias.length
      ? `la clasificación no cuadra con la oficial en ${comparacion.diferencias.length} equipo${comparacion.diferencias.length > 1 ? "s" : ""}`
      : "",
    resumen.revisar.length ? `${resumen.revisar.length} por revisar` : "",
    resumen.errores.length ? `${resumen.errores.length} con error` : "",
  ].filter(Boolean);
  await db
    .update(schema.rfgfCompeticiones)
    .set({
      comprobadoEn: ahora.toISOString(),
      ...(mirarHorarios ? { horariosEn: ahora.toISOString() } : {}),
      ...(comparacion ? { clasificacion: comparacion } : {}),
      // Una pasada sin novedades no borra lo último que pasó.
      ...(partes.length > 0 ? { resumen: partes.join(" · ") } : {}),
    })
    .where(eq(schema.rfgfCompeticiones.competicionId, competicionId));
  return resumen;
}

/** Actas de una sola jornada; la pasada diaria conserva sus criterios de no repetir. */
export async function tratarActasJornada(
  jornada: number,
  grupo: GrupoRfgf,
  competicion: { id: string; categoria: string },
  partidos: readonly PartidoConEquipos[],
  descargador: DescargadorRfgf,
  resumen: ResumenRfgf,
  /** A mano se reintenta también lo que quedó por revisar o con aviso. */
  reintentarProblemas = false,
  ahora = new Date(),
) {
  const { db } = await obtenerDb();
  const competicionId = competicion.id;
  let leidas = 0;
  try {
    const enLaWeb = partidosDeJornada(await descargador.html(urlJornada(grupo, jornada))).filter(
      (p): p is typeof p & { codActa: string } => p.codActa !== null,
    );
    if (enLaWeb.length === 0) return 0;
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
          inArray(
            schema.rfgfActas.estado,
            reintentarProblemas ? ["resultado", "guardada"] : ["resultado", "guardada", "revisar"],
          ),
          reintentarProblemas ? eq(schema.rfgfActas.aviso, "") : undefined,
          eq(schema.rfgfActas.eventos, true),
        ),
      );
    const hechas = new Set(tratadas.map((t) => t.codActa));
    const candidatos = partidos.filter((p) => p.jornada === jornada);
    for (const acta of enLaWeb) {
      if (hechas.has(acta.codActa)) continue;
      const partido = partidoDeActa(acta.local, acta.visitante, candidatos);
      if (
        reintentarProblemas &&
        (!partido || !(partido.conMarcador || (partido.fecha && partido.fecha <= horaLocal(ahora))))
      )
        continue;
      const salida = { aviso: "" };
      try {
        await tratarActa(
          acta.codActa,
          grupo,
          competicion,
          acta,
          candidatos,
          descargador,
          resumen,
          salida,
          reintentarProblemas && Boolean(partido?.conEventos),
        );
        leidas += 1;
        // El aviso se pone o se quita según haya ido esta vez.
        await db
          .update(schema.rfgfActas)
          .set({ aviso: salida.aviso })
          .where(eq(schema.rfgfActas.codActa, acta.codActa));
      } catch (error) {
        const detalle = error instanceof Error ? error.message : "fallo desconocido";
        const cruce = `${acta.local} – ${acta.visitante}`;
        resumen.errores.push(`${cruce}: ${detalle}`);
        // El cruce va en el detalle: aquí aún no se sabe a qué partido nuestro corresponde.
        await anotar(
          acta.codActa,
          competicionId,
          reintentarProblemas ? (partido?.id ?? null) : null,
          "error",
          `${cruce}: ${detalle}`,
          !reintentarProblemas,
        );
      }
    }
  } catch (error) {
    const detalle = error instanceof Error ? error.message : "fallo desconocido";
    resumen.errores.push(`Jornada ${jornada}: ${detalle}`);
  }
  return leidas;
}

/** La llamada individual también comparte la reserva con el programador y las peticiones. */
export async function sincronizarCompeticion(
  competicionId: string,
  descargador: DescargadorRfgf,
  ahora = new Date(),
  soloRecientes = false,
  completa = false,
): Promise<ResumenRfgf | null> {
  return conCandadoRfgf(() =>
    sincronizarCompeticionSinCandado(competicionId, descargador, ahora, soloRecientes, completa),
  );
}

/** Sincroniza todas las competiciones enlazadas de la temporada activa. Nunca dos a la vez. */
export async function sincronizarTodo(
  descargador: DescargadorRfgf,
  ahora = new Date(),
  soloRecientes = false,
  completa = false,
): Promise<ResumenRfgf[]> {
  return (
    (await conCandadoRfgf(async () => {
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
        const resumen = await sincronizarCompeticionSinCandado(
          id,
          descargador,
          ahora,
          soloRecientes,
          completa,
        );
        if (resumen) resumenes.push(resumen);
      }
      return resumenes;
    })) ?? []
  );
}

/** Cuándo se miró la federación por última vez, en cualquier competición. `null` si nunca. */
export async function ultimaComprobacion(): Promise<Date | null> {
  const { db } = await obtenerDb();
  const [fila] = await db
    .select({ ultima: sql<string | null>`max(${schema.rfgfCompeticiones.comprobadoEn})` })
    .from(schema.rfgfCompeticiones);
  const fecha = fila?.ultima ? new Date(fila.ultima) : null;
  return fecha && !Number.isNaN(fecha.getTime()) ? fecha : null;
}
