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
  /** Campo asignado, si lo tiene. Solo hace falta para poner al día los horarios. */
  campoId?: string | null;
  /** Ya se sabe quién lo arbitró. */
  conArbitro?: boolean;
  /** Sus goles y tarjetas ya están en las tablas de la liga. */
  conEventos?: boolean;
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
export function partidoDeActa<T extends PartidoLocal>(
  local: string,
  visitante: string,
  candidatos: readonly T[],
): T | null {
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

/** Jornadas ya jugadas que se ponen al día en cada pasada: catorce actas como mucho. */
export const JORNADAS_ATRASADAS = 2;

/**
 * Las jornadas jugadas más antiguas con algún partido cuyos goles y tarjetas aún no están en
 * las tablas de la liga. Pocas cada vez: son siete actas por jornada y no hay prisa.
 */
export function jornadasSinEventos(partidos: readonly PartidoLocal[], ahora: string): number[] {
  const jornadas = new Set(
    partidos
      .filter((p) => p.conMarcador && !p.conEventos && p.fecha && p.fecha <= ahora)
      .map((p) => p.jornada),
  );
  return [...jornadas].sort((a, b) => a - b).slice(0, JORNADAS_ATRASADAS);
}

/** Hora del día a la que se hace la comprobación diaria de la federación. */
export const HORA_PASADA_DIARIA = 21;

/**
 * Si toca la comprobación diaria. Se hace una al día, a partir de las 21:00: los martes ya ha
 * cerrado el plazo para cambiar horarios (20:00) y el fin de semana ya han acabado los partidos
 * de la tarde. Si el ordenador estaba apagado a esa hora, se hace en cuanto arranca. `ultima`
 * es la última comprobación de cualquier tipo, también la pedida a mano.
 */
export function tocaPasadaDiaria(ahora: Date, ultima: Date | null): boolean {
  const frontera = new Date(ahora);
  frontera.setHours(HORA_PASADA_DIARIA, 0, 0, 0);
  if (ahora < frontera) frontera.setDate(frontera.getDate() - 1);
  return !ultima || ultima < frontera;
}
