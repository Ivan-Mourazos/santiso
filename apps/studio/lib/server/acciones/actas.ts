"use server";

import { schema } from "@santiso/db";
import { asc, eq } from "drizzle-orm";
import {
  actaDeGuardado,
  ErrorActa,
  eventosDeActa,
  participacionesDeActa,
} from "@/lib/actas/transformar";
import type { ParsedActa } from "@/lib/actas/types";
import type { CampoDto, JugadorDto, PartidoActaDto } from "@/lib/dto";
import { capturar, exito, fallo, type Resultado } from "@/lib/resultado";
import { asegurarCampo } from "@/lib/server/acciones/campos";
import {
  eventosDePartido,
  participacionesDePartido,
  partidosParaActa,
} from "@/lib/server/consultas/actas";
import { listarCampos } from "@/lib/server/consultas/campos";
import { listarJugadores } from "@/lib/server/consultas/jugadores";
import { obtenerDb } from "@/lib/server/db";

/**
 * Todo lo que necesita un importador de actas, en una sola acción.
 * Sin `categoria` trae las tres, que es lo que usa el importador en lote.
 */
export async function cargarPantallaActa(categoria?: string): Promise<{
  partidos: PartidoActaDto[];
  jugadores: JugadorDto[];
  campos: CampoDto[];
}> {
  const [partidos, jugadores, campos] = await Promise.all([
    partidosParaActa(categoria),
    listarJugadores(categoria),
    listarCampos(),
  ]);
  return { partidos, jugadores, campos };
}

/** Envoltorios de servidor: `consultas/` lleva `server-only` y el cliente no puede importarlo. */
export async function cargarEventosDePartido(partidoId: string) {
  return partidoId ? eventosDePartido(partidoId) : [];
}

export async function cargarParticipacionesDePartido(partidoId: string) {
  return partidoId ? participacionesDePartido(partidoId) : [];
}

/**
 * El acta guardada de un partido, en la forma del formulario de revisión, para corregirla.
 * `null` si el partido todavía no tiene convocatoria ni eventos.
 */
export async function cargarActaGuardada(partidoId: string): Promise<Resultado<ParsedActa | null>> {
  return capturar("No se pudo abrir el acta guardada.", async () => {
    const { db } = await obtenerDb();
    const [partido] = await db
      .select({
        golesLocal: schema.partidos.golesLocal,
        golesVisitante: schema.partidos.golesVisitante,
        campoId: schema.partidos.campoId,
      })
      .from(schema.partidos)
      .where(eq(schema.partidos.id, partidoId));
    if (!partido) return null;
    const [convocados, eventos] = await Promise.all([
      participacionesDePartido(partidoId),
      db
        .select({
          id: schema.partidoEventos.id,
          tipo: schema.partidoEventos.tipo,
          lado: schema.partidoEventos.lado,
          propia: schema.partidoEventos.propia,
          minuto: schema.partidoEventos.minuto,
          jugadorId: schema.partidoEventos.jugadorId,
          jugadorSaleId: schema.partidoEventos.jugadorSaleId,
          nombreRival: schema.partidoEventos.nombreRival,
        })
        .from(schema.partidoEventos)
        .where(eq(schema.partidoEventos.partidoId, partidoId))
        .orderBy(asc(schema.partidoEventos.minuto)),
    ]);
    if (convocados.length === 0 && eventos.length === 0) return null;
    return actaDeGuardado(partido, convocados, eventos);
  });
}

/**
 * Guarda un acta revisada. Todo el trabajo va en **una** transacción: actualizar el partido,
 * borrar la convocatoria y los eventos anteriores e insertar los nuevos. Es lo que arregla el
 * hallazgo P1 #3 de la auditoría: antes se borraba primero y se insertaba después sin
 * transacción, así que un fallo a medias dejaba el partido sin datos y sin forma de volver.
 */
export async function guardarActa(partidoId: string, acta: ParsedActa): Promise<Resultado<null>> {
  const golesLocal = Number(acta.marcadorLocal);
  const golesVisitante = Number(acta.marcadorVisitante);
  const valido = (n: number) => Number.isInteger(n) && n >= 0;
  if (!valido(golesLocal) || !valido(golesVisitante)) {
    return fallo("El marcador del acta no es válido.");
  }

  // La transformación se hace antes de abrir la transacción: si el acta trae algo imposible,
  // se rechaza sin haber tocado la base de datos.
  let participaciones;
  let eventos;
  try {
    participaciones = participacionesDeActa(acta);
    eventos = eventosDeActa(acta);
  } catch (error) {
    if (error instanceof ErrorActa) return fallo(error.message);
    throw error;
  }

  const { db } = await obtenerDb();
  const [partido] = await db
    .select({ id: schema.partidos.id })
    .from(schema.partidos)
    .where(eq(schema.partidos.id, partidoId));
  if (!partido) return fallo("Ese partido ya no existe.");

  let campoId: string | null = null;
  if (acta.campoNombre.trim()) {
    const campo = await asegurarCampo(acta.campoNombre, acta.campoPoblacion);
    if (!campo.ok) return campo;
    campoId = campo.datos.id;
  } else if (acta.campoId) {
    campoId = acta.campoId;
  }

  const resultado = await capturar("No se pudo guardar el acta.", async () => {
    await db.transaction(async (tx) => {
      await tx
        .update(schema.partidos)
        .set({
          golesLocal,
          golesVisitante,
          estado: "finalizado",
          ...(campoId ? { campoId } : {}),
        })
        .where(eq(schema.partidos.id, partidoId));

      await tx
        .delete(schema.partidoParticipaciones)
        .where(eq(schema.partidoParticipaciones.partidoId, partidoId));
      await tx.delete(schema.partidoEventos).where(eq(schema.partidoEventos.partidoId, partidoId));

      if (participaciones.length > 0) {
        await tx
          .insert(schema.partidoParticipaciones)
          .values(participaciones.map((p) => ({ ...p, partidoId })));
      }
      if (eventos.length > 0) {
        await tx.insert(schema.partidoEventos).values(eventos.map((e) => ({ ...e, partidoId })));
      }
    });
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}
