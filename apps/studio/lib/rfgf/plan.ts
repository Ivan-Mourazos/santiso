import { parecido } from "@/lib/importar/emparejar";

/** Un partido nuestro, con lo justo para decidir qué falta por traer de la federación. */
export interface PartidoLocal {
  id: string;
  jornada: number;
  local: string;
  visitante: string;
  /** Hora local de pared «YYYY-MM-DDTHH:mm», o `null` si no tiene fecha. */
  fecha: string | null;
  conMarcador: boolean;
  /** Juega el Santiso. */
  propio: boolean;
  /** Ya tiene convocatoria guardada (acta). */
  conActa: boolean;
}

/** Como mucho, estas jornadas por pasada: sin prisa y sin cargar la web de la federación. */
export const MAXIMO_JORNADAS = 3;

/** A un partido le falta algo si no tiene marcador o, siendo del Santiso, no tiene acta. */
export const leFaltaAlgo = (partido: PartidoLocal) =>
  !partido.conMarcador || (partido.propio && !partido.conActa);

/**
 * Jornadas que merece la pena mirar: las que tienen algún partido ya empezado al que le falta
 * algo. `ahora` es hora local de pared, con el mismo formato que la fecha de los partidos.
 * Las más antiguas primero.
 */
export function jornadasPendientes(partidos: readonly PartidoLocal[], ahora: string): number[] {
  const jornadas = new Set<number>();
  for (const partido of partidos) {
    if (!partido.fecha || partido.fecha > ahora) continue;
    if (leFaltaAlgo(partido)) jornadas.add(partido.jornada);
  }
  return [...jornadas].sort((a, b) => a - b).slice(0, MAXIMO_JORNADAS);
}

/** Por debajo de esto, el nombre de la federación no se da por el de un equipo nuestro. */
const MINIMO_EQUIPO = 0.6;

/**
 * El partido nuestro que corresponde a un acta, por los dos equipos y en su orden. `null` si
 * no hay ninguno claro o si hay dos que valdrían.
 */
export function partidoDeActa(
  local: string,
  visitante: string,
  candidatos: readonly PartidoLocal[],
): PartidoLocal | null {
  const validos = candidatos.filter(
    (partido) =>
      parecido(local, partido.local) >= MINIMO_EQUIPO &&
      parecido(visitante, partido.visitante) >= MINIMO_EQUIPO,
  );
  return validos.length === 1 ? (validos[0] ?? null) : null;
}
