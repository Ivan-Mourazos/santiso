/**
 * Ficha de un jugador: su temporada partido a partido. Puro: recibe lo que dice el acta de
 * cada partido y aplica las mismas reglas que la tabla de estadísticas
 * (`calcularEstadisticasJugadores`), para que los totales coincidan.
 */
import {
  calcularEstadisticasJugadores,
  type EventoEstadistica,
  type ParticipacionEstadistica,
} from "@santiso/domain";

/** Un partido del club en el que el jugador estuvo convocado. */
export interface PartidoBase {
  partidoId: string;
  /** Hora de pared `AAAA-MM-DDTHH:mm`, o `null`. */
  fecha: string | null;
  competicion: string;
  jornada: number;
  rival: string;
  rivalEscudoUrl: string | null;
  /** El Santiso jugó en casa. */
  local: boolean;
  golesSantiso: number | null;
  golesRival: number | null;
}

export interface EventoDeFicha extends EventoEstadistica {
  minuto: number | null;
  /** Solo en cambios: quien sale. `jugadorId` es quien entra. */
  jugadorSaleId: string | null;
}

export interface PartidoDeFicha extends PartidoBase {
  titular: boolean;
  jugo: boolean;
  goles: number;
  golesPropia: number;
  amarillas: number;
  rojas: number;
  /** Minuto en que entró desde el banquillo, si el acta lo dice. */
  entra: number | null;
  /** Minuto en que lo sustituyeron, si el acta lo dice. */
  sale: number | null;
}

export interface FichaJugador {
  jugador: {
    id: string;
    nombre: string;
    apodo: string | null;
    dorsal: number | null;
    posicion: string | null;
    fotoUrl: string | null;
  };
  /** Del más reciente al más antiguo. */
  partidos: PartidoDeFicha[];
}

export function construirPartidos(
  jugadorId: string,
  partidos: readonly PartidoBase[],
  participaciones: readonly ParticipacionEstadistica[],
  eventos: readonly EventoDeFicha[],
): PartidoDeFicha[] {
  return partidos
    .map((partido): PartidoDeFicha | null => {
      const suya = participaciones.find(
        (p) => p.partidoId === partido.partidoId && p.jugadorId === jugadorId,
      );
      if (!suya) return null;
      const delPartido = eventos.filter((e) => e.partidoId === partido.partidoId);
      const [fila] = calcularEstadisticasJugadores(
        [suya],
        delPartido.filter((e) => e.jugadorId === jugadorId),
      );
      const cambio = (clave: "jugadorId" | "jugadorSaleId") =>
        delPartido.find((e) => e.tipo === "cambio" && e[clave] === jugadorId)?.minuto ?? null;
      return {
        ...partido,
        titular: suya.titular,
        jugo: suya.jugo,
        goles: fila?.goles ?? 0,
        golesPropia: fila?.golesPropia ?? 0,
        amarillas: fila?.amarillas ?? 0,
        rojas: fila?.rojas ?? 0,
        entra: cambio("jugadorId"),
        sale: cambio("jugadorSaleId"),
      };
    })
    .filter((p): p is PartidoDeFicha => p !== null)
    .sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""));
}

/** «Titular», «Suplente (entró 60')», «No jugó»… */
export function papelEnPartido(p: PartidoDeFicha): string {
  if (!p.jugo) return "No jugó";
  if (p.titular) return p.sale === null ? "Titular" : `Titular (cambio ${p.sale}')`;
  return p.entra === null ? "Suplente" : `Suplente (entró ${p.entra}')`;
}

/** «V 3-1», «E 0-0», «D 1-2» desde el lado del Santiso; vacío si no hay resultado. */
export function resultadoDePartido(p: PartidoBase): string {
  if (p.golesSantiso === null || p.golesRival === null) return "";
  const letra = p.golesSantiso > p.golesRival ? "V" : p.golesSantiso < p.golesRival ? "D" : "E";
  return `${letra} ${p.golesSantiso}-${p.golesRival}`;
}

export function totalesDeFicha(partidos: readonly PartidoDeFicha[]) {
  const suma = (clave: "goles" | "golesPropia" | "amarillas" | "rojas") =>
    partidos.reduce((n, p) => n + p[clave], 0);
  return {
    convocados: partidos.length,
    titularidades: partidos.filter((p) => p.titular).length,
    jugados: partidos.filter((p) => p.jugo).length,
    goles: suma("goles"),
    amarillas: suma("amarillas"),
    rojas: suma("rojas"),
  };
}
