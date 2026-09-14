import { MINUTO_MAXIMO } from "@santiso/domain";
import type { FilaEvento, Snapshot } from "../snapshot/tipos";
import { marcasDesde, textoOpcional } from "./comunes";
import { ErrorMigracion, type EventoNuevo, type Informe, type ParticipacionNueva } from "./tipos";

/** Minuto que usaba el importador antiguo para eventos posteriores al final. */
const MINUTO_FINAL_ANTIGUO = 999;

/** R12: correspondencia exhaustiva de las 7 formas conocidas; cualquier otra detiene la migración. */
export function mapearEvento(fila: FilaEvento): EventoNuevo {
  const minuto = fila.minuto === null || fila.minuto === MINUTO_FINAL_ANTIGUO ? null : fila.minuto;
  if (minuto !== null && (minuto < 0 || minuto > MINUTO_MAXIMO)) {
    throw new ErrorMigracion(`El evento ${fila.id} tiene un minuto fuera de rango: ${minuto}.`);
  }
  // jugadorId/jugadorSaleId/nombreRival se rellenan con las claves específicas de cada forma
  // más abajo; sin la anotación, TS infiere `null` desde este literal y rechaza esas variantes.
  const base: {
    id: string;
    partidoId: string;
    minuto: number | null;
    propia: boolean;
    jugadorId: string | null;
    jugadorSaleId: string | null;
    nombreRival: string | null;
    creadoEn?: string;
    actualizadoEn?: string;
  } = {
    id: fila.id,
    partidoId: fila.partido_id,
    minuto,
    propia: false,
    jugadorId: null,
    jugadorSaleId: null,
    nombreRival: null,
    ...marcasDesde(fila.created_at),
  };
  const nombre = textoOpcional(fila.nombre_mostrado);
  const { tipo, es_rival: esRival, jugador_id: jugadorId } = fila;
  const jugadorSaleId = fila.jugador_relacionado_id;

  if (tipo === "gol") {
    if (!esRival && jugadorId) return { ...base, tipo, lado: "propio", jugadorId };
    if (!esRival && nombre)
      return { ...base, tipo, lado: "propio", propia: true, nombreRival: nombre };
    if (esRival && jugadorId) return { ...base, tipo, lado: "rival", propia: true, jugadorId };
    if (esRival) return { ...base, tipo, lado: "rival", nombreRival: nombre };
  }
  if (tipo === "tarjeta_amarilla" || tipo === "tarjeta_roja") {
    if (!esRival && jugadorId) return { ...base, tipo, lado: "propio", jugadorId };
    if (esRival && !jugadorId) return { ...base, tipo, lado: "rival", nombreRival: nombre };
  }
  if (tipo === "cambio" && !esRival && jugadorId && jugadorSaleId) {
    return { ...base, tipo, lado: "propio", jugadorId, jugadorSaleId };
  }
  throw new ErrorMigracion(
    `El evento ${fila.id} tiene una forma no reconocida: ${JSON.stringify({
      tipo,
      esRival,
      jugador: Boolean(jugadorId),
      sale: Boolean(jugadorSaleId),
      nombre,
    })}.`,
  );
}

/** R10–R11: participaciones desde estadísticas, goles verificados y jugadores completados. */
export function transformarActas(
  origen: Snapshot,
  informe: Informe,
): { partidoParticipaciones: ParticipacionNueva[]; partidoEventos: EventoNuevo[] } {
  const partidoEventos = origen.partido_eventos_santiso.map(mapearEvento);
  const clave = (partidoId: string, jugadorId: string) => `${partidoId}|${jugadorId}`;

  const participaciones = new Map<string, ParticipacionNueva>();
  for (const fila of origen.jugador_partido_stats) {
    const titular = fila.titular === true;
    participaciones.set(clave(fila.partido_id, fila.jugador_id), {
      partidoId: fila.partido_id,
      jugadorId: fila.jugador_id,
      titular,
      jugo: titular || fila.jugo === true,
    });
  }

  const golesPorJugador = new Map<string, number>();
  for (const evento of partidoEventos) {
    if (evento.tipo === "gol" && evento.lado === "propio" && !evento.propia && evento.jugadorId) {
      const k = clave(evento.partidoId, evento.jugadorId);
      golesPorJugador.set(k, (golesPorJugador.get(k) ?? 0) + 1);
    }
  }
  for (const fila of origen.jugador_partido_stats) {
    const deEventos = golesPorJugador.get(clave(fila.partido_id, fila.jugador_id)) ?? 0;
    if ((fila.goles ?? 0) !== deEventos) {
      throw new ErrorMigracion(
        `Goles del jugador ${fila.jugador_id} en el partido ${fila.partido_id}: estadística ${fila.goles ?? 0}, eventos ${deEventos}.`,
      );
    }
  }

  for (const evento of partidoEventos) {
    for (const jugadorId of [evento.jugadorId, evento.jugadorSaleId]) {
      if (!jugadorId) continue;
      const k = clave(evento.partidoId, jugadorId);
      const existente = participaciones.get(k);
      if (!existente) {
        participaciones.set(k, {
          partidoId: evento.partidoId,
          jugadorId,
          titular: false,
          jugo: true,
        });
        informe.participacionesCreadas++;
      } else if (!existente.jugo) {
        existente.jugo = true;
        informe.avisos.push(
          `Jugador ${jugadorId} marcado como que jugó el partido ${evento.partidoId} por tener eventos.`,
        );
      }
    }
  }

  return { partidoParticipaciones: [...participaciones.values()], partidoEventos };
}
