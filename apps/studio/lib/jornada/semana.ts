/**
 * Semanas de competición: de lunes a domingo, en fechas locales `AAAA-MM-DD`. Los partidos
 * guardan la hora de pared (`AAAA-MM-DDTHH:mm`), así que una semana se filtra comparando texto,
 * sin zonas horarias de por medio.
 */

export interface Semana {
  /** Lunes, `AAAA-MM-DD`. */
  desde: string;
  /** Domingo, `AAAA-MM-DD`. */
  hasta: string;
}

const RE_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

const aTexto = (fecha: Date) =>
  `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;

/** El día de hoy en hora local, `AAAA-MM-DD`. */
export function hoyLocal(ahora = new Date()): string {
  return aTexto(ahora);
}

/** `true` si el texto es un día real (`2026-02-30` no lo es). */
export function esDia(texto: string | null | undefined): texto is string {
  const m = texto ? RE_DIA.exec(texto) : null;
  if (!m) return false;
  const fecha = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return aTexto(fecha) === texto;
}

/** La semana (lunes a domingo) que contiene el día. */
export function semanaDe(dia: string): Semana {
  if (!esDia(dia)) throw new Error(`Día no válido: "${dia}"`);
  const [a, m, d] = dia.split("-").map(Number) as [number, number, number];
  const fecha = new Date(a, m - 1, d);
  // getDay: domingo = 0. El lunes queda a (día + 6) % 7 días hacia atrás.
  const alLunes = (fecha.getDay() + 6) % 7;
  const lunes = new Date(a, m - 1, d - alLunes);
  const domingo = new Date(a, m - 1, d - alLunes + 6);
  return { desde: aTexto(lunes), hasta: aTexto(domingo) };
}

/** El lunes de la semana anterior (-1) o siguiente (+1). */
export function semanaVecina(dia: string, paso: -1 | 1): string {
  const { desde } = semanaDe(dia);
  const [a, m, d] = desde.split("-").map(Number) as [number, number, number];
  return aTexto(new Date(a, m - 1, d + 7 * paso));
}

/** ¿Cae la fecha del partido (`AAAA-MM-DDTHH:mm` o solo el día) dentro de la semana? */
export function enSemana(fecha: string | null | undefined, semana: Semana): boolean {
  if (!fecha) return false;
  const dia = fecha.slice(0, 10);
  return dia >= semana.desde && dia <= semana.hasta;
}
