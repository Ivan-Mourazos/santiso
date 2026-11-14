/**
 * Cronómetro de la libreta en directo. Se calcula con marcas de tiempo (epoch ms), nunca con un
 * contador en memoria: si el móvil se bloquea o la pestaña duerme, al volver el minuto es el real.
 */
import { MINUTO_MAXIMO, type EstadoReloj } from "@santiso/domain";

export interface RelojDirecto {
  duracionParte: number;
  estado: EstadoReloj;
  /** Cuándo empezó la parte en curso. */
  inicioParte: number | null;
  /** Tiempo parado dentro de la parte en curso. */
  pausadoMs: number;
  /** Si está en pausa, desde cuándo. */
  pausaDesde: number | null;
}

export type AccionReloj = "empezar" | "descanso" | "segunda" | "final" | "pausa" | "seguir";

export const RELOJ_INICIAL: RelojDirecto = {
  duracionParte: 45,
  estado: "previo",
  inicioParte: null,
  pausadoMs: 0,
  pausaDesde: null,
};

const enJuego = (r: RelojDirecto) => r.estado === "primera" || r.estado === "segunda";

/** Milisegundos jugados de la parte en curso, sin pausas. */
function transcurrido(r: RelojDirecto, ahora: number): number {
  if (!enJuego(r) || r.inicioParte === null) return 0;
  return Math.max(0, (r.pausaDesde ?? ahora) - r.inicioParte - r.pausadoMs);
}

/** Segundos del partido para el marcador («63:12»): la segunda parte cuenta desde el 45. */
export function segundosParte(r: RelojDirecto, ahora: number): number {
  const base = r.duracionParte * 60;
  switch (r.estado) {
    case "previo":
      return 0;
    case "primera":
      return Math.floor(transcurrido(r, ahora) / 1000);
    case "descanso":
      return base;
    case "segunda":
      return base + Math.floor(transcurrido(r, ahora) / 1000);
    case "final":
      return base * 2;
  }
}

/** Minuto que se propone al apuntar algo. `null` antes de empezar y tras el final. */
export function minutoActual(
  r: RelojDirecto,
  ahora: number,
): { parte: 1 | 2; minuto: number } | null {
  const tope = (m: number) => Math.min(m, MINUTO_MAXIMO);
  switch (r.estado) {
    case "previo":
    case "final":
      return null;
    case "descanso":
      return { parte: 1, minuto: r.duracionParte };
    case "primera":
      return { parte: 1, minuto: tope(Math.floor(transcurrido(r, ahora) / 60_000) + 1) };
    case "segunda":
      return {
        parte: 2,
        minuto: tope(r.duracionParte + Math.floor(transcurrido(r, ahora) / 60_000) + 1),
      };
  }
}

/** «23'», o «45+2» en el descuento. Vacío sin minuto. */
export function etiquetaMinuto(parte: 1 | 2, minuto: number | null, duracion: number): string {
  if (minuto === null) return "";
  const fin = duracion * parte;
  return minuto > fin ? `${fin}+${minuto - fin}` : `${minuto}'`;
}

/** Siguiente estado del reloj. Una acción que no toca en ese momento devuelve el mismo objeto. */
export function avanzarReloj(r: RelojDirecto, accion: AccionReloj, ahora: number): RelojDirecto {
  const nuevaParte = (estado: EstadoReloj): RelojDirecto => ({
    ...r,
    estado,
    inicioParte: ahora,
    pausadoMs: 0,
    pausaDesde: null,
  });
  const sinParte = (estado: EstadoReloj): RelojDirecto => ({
    ...r,
    estado,
    inicioParte: null,
    pausadoMs: 0,
    pausaDesde: null,
  });
  switch (accion) {
    case "empezar":
      return r.estado === "previo" ? nuevaParte("primera") : r;
    case "descanso":
      return r.estado === "primera" ? sinParte("descanso") : r;
    case "segunda":
      return r.estado === "descanso" ? nuevaParte("segunda") : r;
    case "final":
      return enJuego(r) ? sinParte("final") : r;
    case "pausa":
      return enJuego(r) && r.pausaDesde === null ? { ...r, pausaDesde: ahora } : r;
    case "seguir":
      return r.pausaDesde !== null
        ? { ...r, pausadoMs: r.pausadoMs + (ahora - r.pausaDesde), pausaDesde: null }
        : r;
  }
}

/** Descuento de la 1ª parte más largo que se admite antes de dar el minuto por 2ª parte. */
const DESCUENTO_MAXIMO = 10;

/**
 * Parte de un minuto escrito a mano: hasta el fin de la 1ª es 1ª; pasado el descuento máximo, 2ª;
 * entre medias (46–55 con 45) vale cualquiera y se respeta la elegida.
 */
export function parteDeMinuto(minuto: number | null, parte: 1 | 2, duracion: number): 1 | 2 {
  if (minuto === null) return parte;
  if (minuto <= duracion) return 1;
  if (minuto > duracion + DESCUENTO_MAXIMO) return 2;
  return parte;
}
