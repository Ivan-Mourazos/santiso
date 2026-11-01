import "server-only";

import {
  codigoDeTemporada,
  parsearFichaPdf,
  parsearJornadaPdf,
  partidosConCodigos,
  type Calendario,
  type Ficha,
} from "@santiso/actas";
import { schema } from "@santiso/db";
import { claveEquipo, esEquipoPropio, normalizarNombreEquipo } from "@santiso/domain";
import { and, asc, eq, inArray, isNotNull, notInArray, sql } from "drizzle-orm";
import {
  urlActaPdf,
  urlJornada,
  urlJornadaPdf,
  type GrupoRfgf,
} from "@/lib/rfgf/enlace";
import { obtenerDb } from "@/lib/server/db";
import { alineacionesDeFicha, eventosDeFicha } from "@/lib/liga/eventos";
import { CalendarioIlegible, leerCalendarioFederacion } from "./calendario";
import type { DescargadorRfgf } from "./descargador";

type Grupo = typeof schema.rfgfGruposHistoricos.$inferSelect;
type Partido = typeof schema.rfgfHistoricoPartidos.$inferSelect;
const tabla = schema.rfgfHistoricoPartidos;
const grupos = schema.rfgfGruposHistoricos;
const mensaje = (error: unknown) => (error instanceof Error ? error.message : "Fallo desconocido");
const terminado = (p: Partido) =>
  p.estado === "listo" || (p.estado === "sin_acta" && p.resultadoEn !== null);

function enlaceGrupo(grupo: Grupo): GrupoRfgf {
  const codTemporada = codigoDeTemporada(grupo.temporada);
  if (!codTemporada || !/^\d+$/u.test(grupo.codGrupo) || !/^\d+$/u.test(grupo.codCompeticion))
    throw new Error("Códigos o temporada del grupo no soportados.");
  return {
    codPrimaria: "1000120",
    codTemporada,
    codGrupo: grupo.codGrupo,
    codCompeticion: grupo.codCompeticion,
  };
}
const nombreEquipo = (nombre: string, grupo: Grupo) =>
  normalizarNombreEquipo(nombre, grupo.categoria);
const misma = (a: string, b: string, grupo: Grupo) =>
  claveEquipo(nombreEquipo(a, grupo)) === claveEquipo(nombreEquipo(b, grupo));

/** Solo encola. Repetir la solicitud conserva resultados y trabajo ya hecho. */
export async function pedirPartidosHistoricos(codGrupo: string, ahora = new Date()): Promise<void> {
  const { db } = await obtenerDb();
  const [grupo] = await db.select().from(grupos).where(eq(grupos.codGrupo, codGrupo));
  if (!grupo) throw new Error("Ese grupo histórico no está guardado.");
  if (grupo.partidosPedidosEn) return;
  await db
    .update(grupos)
    .set({
      partidosPedidosEn: ahora.toISOString(),
      partidosEstado: "en_cola",
      partidosActualizadoEn: ahora.toISOString(),
    })
    .where(eq(grupos.codGrupo, codGrupo));
}

/** Resumen compartido por las dos lecturas; sin descargas ni escrituras. */
export function resumenPartidosHistoricos(grupo: Grupo, partidos: Partido[]) {
  const total = partidos.length;
  const listos = partidos.filter((p) => p.estado === "listo").length;
  const sinActa = partidos.filter((p) => p.estado === "sin_acta" && terminado(p)).length;
  const pendientes = partidos.filter((p) => !terminado(p)).length;
  return {
    estado: grupo.partidosEstado,
    total,
    listos,
    sinActa,
    pendientes,
    errores: partidos.filter((p) => p.estado === "error").length,
    pedidoEn: grupo.partidosPedidosEn,
    aviso: grupo.partidosAviso,
    // Se enseña tal cual en Archivo y en Federación: en palabras de quien lo usa.
    texto:
      grupo.partidosEstado === "no_pedido"
        ? "Sin pedir"
        : grupo.partidosEstado === "en_cola"
          ? "Pedidos, llegarán poco a poco"
          : grupo.partidosEstado === "terminado"
            ? "Todos traídos"
            : grupo.partidosEstado === "no_compatible"
              ? "La federación no los tiene en un formato que se pueda leer"
              : `${listos} de ${total} traídos`,
  };
}

/** Archivo local ordenado por jornada. Un grupo desconocido es un error de contrato. */
export async function partidosHistoricos(codGrupo: string) {
  const { db } = await obtenerDb();
  const [grupo] = await db.select().from(grupos).where(eq(grupos.codGrupo, codGrupo));
  if (!grupo) throw new Error("Ese grupo histórico no está guardado.");
  const partidos = await db
    .select()
    .from(tabla)
    .where(eq(tabla.codGrupo, codGrupo))
    .orderBy(asc(tabla.jornada), asc(tabla.fechaNominal), asc(tabla.id));
  const eventos = partidos.length
    ? await db
        .select()
        .from(schema.rfgfHistoricoEventos)
        .where(
          inArray(
            schema.rfgfHistoricoEventos.partidoId,
            partidos.map((p) => p.id),
          ),
        )
        .orderBy(sql`rowid`)
    : [];
  return {
    codGrupo,
    resumen: resumenPartidosHistoricos(grupo, partidos),
    partidos: partidos.map((p) => ({
      ...p,
      enlaceActa: p.codActa ? urlActaPdf(enlaceGrupo(grupo), p.codActa) : null,
      eventos: eventos.filter((e) => e.partidoId === p.id),
    })),
  };
}

async function descubrirPartidos(grupo: Grupo, descargador: DescargadorRfgf, ahora: string) {
  const { db } = await obtenerDb();
  // PDF si es una liga limpia y, si no, la web. Un fallo de red se sale de aquí y se reintenta;
  // solo cuenta como no compatible lo que llegó y no se supo leer.
  let calendario: Calendario | null = null;
  let ilegible = "";
  try {
    calendario = await leerCalendarioFederacion(enlaceGrupo(grupo), descargador);
  } catch (error) {
    if (!(error instanceof CalendarioIlegible)) throw error;
    ilegible = error.message;
  }
  let valores: (typeof tabla.$inferInsert)[];
  try {
    if (!calendario) throw new Error(ilegible);
    if (calendario.temporada !== grupo.temporada)
      throw new Error("El calendario corresponde a otra temporada.");
    // El código de catálogo del PDF no es el codequipo del HTML: se reconoce por nombre.
    const propios = await db
      .select({ nombre: schema.equipos.nombre })
      .from(schema.equipos)
      .where(
        and(
          eq(schema.equipos.esPropio, true),
          sql`${schema.equipos.categoria} = ${grupo.categoria}`,
        ),
      );
    const esPropio = (nombre: string) =>
      esEquipoPropio(nombre) || propios.some((e) => misma(e.nombre, nombre, grupo));
    valores = calendario.jornadas.flatMap((j) =>
      j.partidos
        .filter((p) => esPropio(p.local.nombre) || esPropio(p.visitante.nombre))
        .map((p) => {
          if (esPropio(p.local.nombre) && esPropio(p.visitante.nombre))
            throw new Error("Cruce del club ambiguo.");
          return {
            codGrupo: grupo.codGrupo,
            jornada: j.numero,
            fechaNominal: j.fechaNominal,
            local: nombreEquipo(p.local.nombre, grupo),
            visitante: nombreEquipo(p.visitante.nombre, grupo),
            santisoLocal: esPropio(p.local.nombre),
            actualizadoEn: ahora,
          };
        }),
    );
    if (!valores.length) throw new Error("No se reconoce al Santiso en este calendario.");
  } catch (error) {
    await db
      .update(grupos)
      .set({
        partidosEstado: "no_compatible",
        partidosAviso: `Calendario no soportado: ${mensaje(error)}`,
        partidosActualizadoEn: ahora,
        partidosIntentos: grupo.partidosIntentos + 1,
      })
      .where(eq(grupos.codGrupo, grupo.codGrupo));
    return;
  }
  await db.transaction(async (tx) => {
    await tx.insert(tabla).values(valores).onConflictDoNothing();
    await tx
      .update(grupos)
      .set({
        partidosCalendarioEn: ahora,
        partidosEstado: "en_curso",
        partidosAviso: "",
        partidosActualizadoEn: ahora,
        partidosIntentos: grupo.partidosIntentos + 1,
      })
      .where(eq(grupos.codGrupo, grupo.codGrupo));
  });
}

async function leerPartido(p: Partido, grupo: Grupo, descargador: DescargadorRfgf, ahora: string) {
  const { db } = await obtenerDb(),
    enlace = enlaceGrupo(grupo);
  const filtro = eq(tabla.id, p.id);
  const marca = { actualizadoEn: ahora, intentos: p.intentos + 1 };
  try {
    if (!p.codigosEn) {
      const html = await descargador.html(urlJornada(enlace, p.jornada));
      const candidatos = partidosConCodigos(html).filter(
        (c) =>
          misma(c.local, p.local, grupo) &&
          misma(c.visitante, p.visitante, grupo) &&
          (p.santisoLocal ? c.codLocal : c.codVisitante) === grupo.codEquipo,
      );
      if (candidatos.length > 1) throw new Error("Más de un acta coincide con este cruce.");
      // Un HTML vacío o ajeno no demuestra que no haya acta.
      if (!candidatos.length && !/NFG_VisEquipos|NFG_CmpJornada/iu.test(html))
        throw new Error("No se reconoce la página de jornada; se reintentará.");
      await db
        .update(tabla)
        .set({
          ...marca,
          codigosEn: ahora,
          codActa: candidatos[0]?.codActa ?? null,
          estado: "pendiente",
          aviso: candidatos.length ? "" : "No hay un acta publicada para este cruce.",
        })
        .where(filtro);
    } else if (p.codActa && !p.actaLeidaEn) {
      const bytes = await descargador.pdf(urlActaPdf(enlace, p.codActa));
      let ficha: Ficha;
      try {
        ficha = await parsearFichaPdf(bytes);
        if (
          ficha.temporada !== grupo.temporada ||
          ficha.jornada !== p.jornada ||
          !misma(ficha.local.nombre, p.local, grupo) ||
          !misma(ficha.visitante.nombre, p.visitante, grupo)
        )
          throw new Error("El acta no corresponde al partido o a la temporada solicitados.");
      } catch (error) {
        await db
          .update(tabla)
          .set({
            ...marca,
            actaLeidaEn: ahora,
            estado: "sin_acta",
            aviso: `Acta no soportada: ${mensaje(error)}`,
          })
          .where(filtro);
        return;
      }
      const eventos = eventosDeFicha(ficha).map((evento) => ({ ...evento, partidoId: p.id }));
      const alineados = alineacionesDeFicha(ficha).map((a) => ({ ...a, partidoId: p.id }));
      await db.transaction(async (tx) => {
        await tx
          .delete(schema.rfgfHistoricoEventos)
          .where(eq(schema.rfgfHistoricoEventos.partidoId, p.id));
        if (eventos.length) await tx.insert(schema.rfgfHistoricoEventos).values(eventos);
        await tx
          .delete(schema.rfgfHistoricoAlineaciones)
          .where(eq(schema.rfgfHistoricoAlineaciones.partidoId, p.id));
        if (alineados.length) await tx.insert(schema.rfgfHistoricoAlineaciones).values(alineados);
        await tx
          .update(tabla)
          .set({
            ...marca,
            actaLeidaEn: ahora,
            estado: "listo",
            fecha: ficha.fecha,
            golesLocal: ficha.marcador[0],
            golesVisitante: ficha.marcador[1],
            resultadoEn: ahora,
            aviso: ficha.avisos.join(" "),
          })
          .where(filtro);
      });
    } else {
      const bytes = await descargador.pdf(urlJornadaPdf(enlace, p.jornada));
      let jornada: Awaited<ReturnType<typeof parsearJornadaPdf>>;
      try {
        jornada = await parsearJornadaPdf(bytes);
      } catch (error) {
        await db
          .update(tabla)
          .set({
            ...marca,
            estado: "sin_acta",
            resultadoEn: ahora,
            aviso: [p.aviso, `PDF de jornada no soportado: ${mensaje(error)}`]
              .filter(Boolean)
              .join(" "),
          })
          .where(filtro);
        return;
      }
      if (jornada.numero !== null && jornada.numero !== p.jornada) throw new Error("El PDF corresponde a otra jornada.");
      const candidatos = jornada.partidos.filter(
        (c) => misma(c.local, p.local, grupo) && misma(c.visitante, p.visitante, grupo),
      );
      const partido = candidatos.length === 1 ? candidatos[0] : undefined;
      // Marcar como terminado sin inventar resultado cuando el formato no permite leerlo.
      await db
        .update(tabla)
        .set({
          ...marca,
          estado: "sin_acta",
          resultadoEn: ahora,
          ...(partido
            ? {
                fecha: `${partido.fecha}${partido.hora ? `T${partido.hora}` : ""}`,
                golesLocal: partido.marcador?.[0] ?? null,
                golesVisitante: partido.marcador?.[1] ?? null,
              }
            : {}),
          aviso: [
            p.aviso,
            !partido
              ? "No se pudo identificar el partido en el PDF de jornada."
              : !partido.marcador
                ? "El PDF de jornada no publica marcador."
                : "",
          ]
            .filter(Boolean)
            .join(" "),
        })
        .where(filtro);
    }
  } catch (error) {
    await db
      .update(tabla)
      .set({
        ...marca,
        estado: "error",
        aviso: [
          p.actaLeidaEn ? p.aviso.split(" Reintento: ")[0] : "",
          `Reintento: ${mensaje(error)}`,
        ]
          .filter(Boolean)
          .join(" "),
      })
      .where(filtro);
  }
}

/** Solo se llama dentro de conCandadoRfgf. Cada paso consume una página, también si falla. */
export async function avanzarPartidosHistoricosSinCandado(
  descargador: DescargadorRfgf,
  ahora: Date,
  maximo: number,
): Promise<number> {
  const { db } = await obtenerDb();
  const vistos: string[] = [],
    gruposFallidos: string[] = [];
  let paginas = 0;
  while (paginas < maximo) {
    const cola = await db
      .select()
      .from(grupos)
      .where(
        and(
          isNotNull(grupos.partidosPedidosEn),
          inArray(grupos.partidosEstado, ["en_cola", "en_curso"]),
          gruposFallidos.length ? notInArray(grupos.codGrupo, gruposFallidos) : undefined,
        ),
      )
      .orderBy(
        asc(grupos.partidosActualizadoEn),
        asc(grupos.partidosPedidosEn),
        asc(grupos.codGrupo),
      );
    let avanzo = false;
    for (const grupo of cola) {
      if (!grupo.partidosCalendarioEn) {
        paginas++;
        avanzo = true;
        try {
          await descubrirPartidos(grupo, descargador, ahora.toISOString());
        } catch (error) {
          gruposFallidos.push(grupo.codGrupo);
          await db
            .update(grupos)
            .set({
              partidosAviso: mensaje(error),
              partidosActualizadoEn: ahora.toISOString(),
              partidosIntentos: grupo.partidosIntentos + 1,
            })
            .where(eq(grupos.codGrupo, grupo.codGrupo));
        }
        break;
      }
      const pendientes = await db
        .select()
        .from(tabla)
        .where(eq(tabla.codGrupo, grupo.codGrupo))
        .orderBy(
          sql`case when ${tabla.estado} = 'error' then 1 else 0 end`,
          asc(tabla.actualizadoEn),
          asc(tabla.jornada),
        );
      const p = pendientes.find((p) => !terminado(p) && !vistos.includes(p.id));
      if (!p) {
        if (pendientes.every(terminado))
          await db
            .update(grupos)
            .set({ partidosEstado: "terminado" })
            .where(eq(grupos.codGrupo, grupo.codGrupo));
        continue;
      }
      vistos.push(p.id);
      paginas++;
      avanzo = true;
      await leerPartido(p, grupo, descargador, ahora.toISOString());
      const despues = await db.select().from(tabla).where(eq(tabla.codGrupo, grupo.codGrupo));
      await db
        .update(grupos)
        .set({
          partidosActualizadoEn: ahora.toISOString(),
          partidosEstado: despues.every(terminado) ? "terminado" : "en_curso",
        })
        .where(eq(grupos.codGrupo, grupo.codGrupo));
      break;
    }
    if (!avanzo) break;
  }
  return paginas;
}
