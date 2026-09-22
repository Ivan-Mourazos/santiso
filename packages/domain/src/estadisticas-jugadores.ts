import type { LadoEvento, TipoEvento } from "./catalogos";

export interface ParticipacionEstadistica {
  partidoId: string;
  jugadorId: string;
  titular: boolean;
  jugo: boolean;
}
export interface EventoEstadistica {
  id: string;
  partidoId: string;
  jugadorId: string | null;
  tipo: TipoEvento;
  lado: LadoEvento;
  propia: boolean;
}
export interface EstadisticaJugador {
  jugadorId: string;
  convocados: number;
  titularidades: number;
  partidosJugados: number;
  goles: number;
  golesPropia: number;
  amarillas: number;
  rojas: number;
  /** El almacenamiento actual no distingue goles de penalti. */
  golesPenalti: null;
}

/** Agrega datos de un ámbito ya filtrado, sin inferir minutos ni transformar tarjetas. */
export function calcularEstadisticasJugadores(
  participaciones: readonly ParticipacionEstadistica[],
  eventos: readonly EventoEstadistica[],
): EstadisticaJugador[] {
  const filas = new Map<string, EstadisticaJugador>();
  const obtener = (jugadorId: string): EstadisticaJugador => {
    let fila = filas.get(jugadorId);
    if (!fila) {
      fila = {
        jugadorId,
        convocados: 0,
        titularidades: 0,
        partidosJugados: 0,
        goles: 0,
        golesPropia: 0,
        amarillas: 0,
        rojas: 0,
        golesPenalti: null,
      };
      filas.set(jugadorId, fila);
    }
    return fila;
  };
  const convocatorias = new Set<string>();
  for (const p of participaciones) {
    const clave = JSON.stringify([p.partidoId, p.jugadorId]);
    if (convocatorias.has(clave)) continue;
    convocatorias.add(clave);
    const fila = obtener(p.jugadorId);
    fila.convocados++;
    fila.titularidades += Number(p.titular);
    fila.partidosJugados += Number(p.jugo);
  }
  const vistos = new Set<string>();
  for (const e of eventos) {
    if (vistos.has(e.id)) continue;
    vistos.add(e.id);
    if (!e.jugadorId) continue;
    if (e.tipo === "gol") {
      if (e.lado === "propio" && !e.propia) obtener(e.jugadorId).goles++;
      else if (e.lado === "rival" && e.propia) obtener(e.jugadorId).golesPropia++;
    } else if (e.lado === "propio") {
      if (e.tipo === "tarjeta_amarilla") obtener(e.jugadorId).amarillas++;
      else if (e.tipo === "tarjeta_roja") obtener(e.jugadorId).rojas++;
    }
  }
  return [...filas.values()].sort((a, b) => a.jugadorId.localeCompare(b.jugadorId));
}
