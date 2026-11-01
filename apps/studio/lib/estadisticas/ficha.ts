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
    fechaNacimiento: string | null;
    /** Una línea por temporada: «25/26: Club». */
    historial: string[];
  };
  /** Del más reciente al más antiguo. */
  partidos: PartidoDeFicha[];
  /** Lo que dice la federación, por competición; vacío si aún no se ha traído. */
  oficial: CifrasOficiales[];
  /** Temporadas pasadas en el club según la federación, de la más reciente a la más antigua. */
  anteriores: TemporadaAnterior[];
}

/** Las cifras de un jugador en un grupo de una temporada pasada. */
export interface TemporadaAnterior {
  /** «2025-2026». */
  temporada: string;
  competicion: string;
  grupo: string;
  convocados: number;
  titular: number;
  jugados: number;
  goles: number | null;
  amarillas: number;
  rojas: number;
}

/** Las cifras de un jugador en una competición según la web de la federación. */
export interface CifrasOficiales {
  competicionId: string;
  competicion: string;
  /** ISO de la última lectura. */
  leidoEn: string;
  convocados: number;
  titular: number;
  jugados: number;
  goles: number | null;
  amarillas: number;
  rojas: number;
}

/**
 * En qué no coinciden las cifras del Studio con las oficiales, en frases. Solo se puede
 * comparar cuando la ficha abarca justo esa competición; si no, lista vacía.
 */
export function diferenciasConOficial(
  propias: { convocados: number; titularidades: number; goles: number },
  oficial: CifrasOficiales,
): string[] {
  // Las tarjetas no se comparan: la federación cuenta aparte la doble amarilla.
  const pares: [string, number, number | null][] = [
    ["convocatorias", propias.convocados, oficial.convocados],
    ["titularidades", propias.titularidades, oficial.titular],
    ["goles", propias.goles, oficial.goles],
  ];
  return pares
    .filter(([, aqui, alli]) => alli !== null && aqui !== alli)
    .map(([que, aqui, alli]) => `${que}: ${alli} en la federación y ${aqui} aquí`);
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
