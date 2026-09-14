export const FORMATOS_COMPETICION = ["liga", "eliminatoria"] as const;
export type FormatoCompeticion = (typeof FORMATOS_COMPETICION)[number];

export const ESTADOS_PARTIDO = [
  "programado",
  "en_juego",
  "finalizado",
  "aplazado",
  "cancelado",
] as const;
export type EstadoPartido = (typeof ESTADOS_PARTIDO)[number];

export const TIPOS_EVENTO = ["gol", "tarjeta_amarilla", "tarjeta_roja", "cambio"] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

/** Equipo al que se anota un evento del acta. */
export const LADOS_EVENTO = ["propio", "rival"] as const;
export type LadoEvento = (typeof LADOS_EVENTO)[number];

export const TIPOS_STAFF = ["tecnico", "directiva"] as const;
export type TipoStaff = (typeof TIPOS_STAFF)[number];

export const POSICIONES = [
  "POR",
  "LD",
  "DFC",
  "LI",
  "MCD",
  "MC",
  "MCO",
  "MD",
  "MI",
  "ED",
  "EI",
  "DC",
] as const;
export type Posicion = (typeof POSICIONES)[number];

/** Minuto máximo admitido en un acta (prórroga más descuento). */
export const MINUTO_MAXIMO = 130;

/** Comprueba y estrecha el tipo de un texto a un catálogo cerrado. */
export function esValorDe<T extends string>(valores: readonly T[], valor: string): valor is T {
  return (valores as readonly string[]).includes(valor);
}
