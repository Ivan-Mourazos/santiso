import type { PartidoLocal } from "./plan";

/** Lo que la federación publica de un partido por jugar. */
export interface HorarioFederacion {
  /** `AAAA-MM-DD`, o `AAAA-MM-DDTHH:mm` si ya hay hora. */
  fecha: string;
  /** Nombre del campo como lo escribe la federación; vacío si está por asignar. */
  campo: string;
}

/** Cada cuánto se vuelven a mirar los horarios de lo que queda por jugar. */
export const HORAS_ENTRE_HORARIOS = 3;
/** Jornadas por jugar que se miran en cada comprobación de horarios. */
export const JORNADAS_POR_JUGAR = 2;

/** Día y hora juntos, con el formato de `partidos.fecha`. */
export function fechaDeFederacion(fecha: string, hora: string | null): string {
  return hora ? `${fecha}T${hora}` : fecha;
}

/** Si toca volver a mirar los horarios: nunca se miraron o ya pasó el plazo. */
export function tocaMirarHorarios(ultima: string | null, ahora: Date): boolean {
  if (!ultima) return true;
  const antes = Date.parse(ultima);
  return Number.isNaN(antes) || ahora.getTime() - antes >= HORAS_ENTRE_HORARIOS * 3_600_000;
}

/**
 * Las jornadas más próximas que aún tienen partidos por empezar, por orden de fecha. Un partido
 * sin fecha cuenta como por jugar. `ahora` es hora local de pared, como la de los partidos.
 */
export function jornadasPorJugar(partidos: readonly PartidoLocal[], ahora: string): number[] {
  const primera = new Map<number, string>();
  for (const partido of partidos) {
    if (partido.conMarcador) continue;
    // Sin hora, el día entero cuenta como por jugar.
    const fecha = partido.fecha ?? "9999";
    if (fecha.length > 10 ? fecha <= ahora : fecha < ahora.slice(0, 10)) continue;
    const anterior = primera.get(partido.jornada);
    if (!anterior || fecha < anterior) primera.set(partido.jornada, fecha);
  }
  return [...primera]
    .sort((a, b) => a[1].localeCompare(b[1]) || a[0] - b[0])
    .slice(0, JORNADAS_POR_JUGAR)
    .map(([jornada]) => jornada);
}

/**
 * Qué hay que cambiar en un partido nuestro a la vista de lo que publica la federación.
 *
 * La federación manda siempre (decisión de Iván, 12/10/2026): si publica un día, una hora o
 * un campo distintos de los del Studio, se ponen los suyos, aunque lo del Studio se hubiera
 * corregido a mano. Lo único que no hace es borrar: mientras no publique hora o el campo esté
 * «por asignar», se conserva lo que hubiera.
 */
export function cambioDeHorario(
  federacion: HorarioFederacion,
  actual: { fecha: string | null },
): { fecha: string | null; campo: string | null } {
  const mismoDia = actual.fecha?.slice(0, 10) === federacion.fecha.slice(0, 10);
  const sinHoraNueva = federacion.fecha.length === 10;
  // La federación aún no da hora y el día es el mismo: se conserva la hora que ya había.
  const fecha =
    actual.fecha === federacion.fecha || (sinHoraNueva && mismoDia) ? null : federacion.fecha;
  // Si el campo es ya el del partido lo decide quien lo aplica, que conoce el catálogo.
  return { fecha, campo: federacion.campo || null };
}

/** «18/10 17:00» o «18/10» para contar un cambio en una línea. */
export function fechaBreve(fecha: string): string {
  const [dia = "", hora] = fecha.split("T");
  const [, mes, numero] = dia.split("-");
  return `${numero}/${mes}${hora ? ` ${hora}` : ""}`;
}
