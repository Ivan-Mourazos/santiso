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
export function jornadasPendientes(
  partidos: readonly PartidoLocal[],
  ahora: string,
  /** Si se da, se ignoran los partidos anteriores a ese momento (comprobación frecuente). */
  desde?: string,
): number[] {
  const jornadas = new Set<number>();
  for (const partido of partidos) {
    if (!partido.fecha || partido.fecha > ahora) continue;
    if (desde && partido.fecha < desde) continue;
    if (leFaltaAlgo(partido)) jornadas.add(partido.jornada);
  }
  return [...jornadas].sort((a, b) => a - b).slice(0, MAXIMO_JORNADAS);
}

/** Cada equipo debe parecerse al menos esto al nuestro… */
const MINIMO_EQUIPO = 0.4;
/** …y entre los dos sumar esto: uno casi exacto compensa a otro escrito distinto. */
const MINIMO_CRUCE = 1.2;
/** Ventaja sobre el segundo candidato para darlo por bueno. */
const VENTAJA_CRUCE = 0.2;

/**
 * El partido nuestro que corresponde a un acta, por los dos equipos y en su orden. La
 * federación escribe algunos nombres distinto («MELIDE VETERANOS» es aquí «Melide»), así que
 * no se exige que los dos casen perfectos: como cada equipo juega una vez por jornada, basta
 * con que el cruce destaque claramente. `null` si no hay ninguno claro o si valdrían dos.
 */
export function partidoDeActa(
  local: string,
  visitante: string,
  candidatos: readonly PartidoLocal[],
): PartidoLocal | null {
  const puntuados = candidatos
    .map((partido) => {
      const l = parecido(local, partido.local);
      const v = parecido(visitante, partido.visitante);
      return { partido, minimo: Math.min(l, v), total: l + v };
    })
    .filter((c) => c.minimo >= MINIMO_EQUIPO && c.total >= MINIMO_CRUCE)
    .sort((a, b) => b.total - a.total);
  const [mejor, segundo] = puntuados;
  if (!mejor) return null;
  if (segundo && mejor.total - segundo.total < VENTAJA_CRUCE) return null;
  return mejor.partido;
}
