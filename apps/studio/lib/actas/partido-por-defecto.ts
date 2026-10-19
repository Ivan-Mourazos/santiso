/** Lo que hace falta de un partido para elegir el que se abre por defecto en el acta a mano. */
export interface PartidoParaActa {
  id: string;
  estado: string | null;
  fecha?: string | null;
  goles_local: number | null;
  con_acta?: boolean;
}

/** Fecha y hora locales en el formato de la base («2026-10-18T17:00»), para comparar textos. */
export function ahoraLocal(ahora = new Date()): string {
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}T${dos(ahora.getHours())}:${dos(ahora.getMinutes())}`;
}

/** Jugado: acabado, con marcador o con la hora ya pasada. Nunca uno aplazado o suspendido. */
export function partidoJugado(partido: PartidoParaActa, ahora: string): boolean {
  if (partido.estado === "aplazado" || partido.estado === "cancelado") return false;
  if (partido.estado === "finalizado" || partido.goles_local !== null) return true;
  return Boolean(partido.fecha && partido.fecha <= ahora);
}

/**
 * El partido que el acta a mano propone al abrirse: el último jugado que aún no tiene acta.
 * Nunca uno por jugar; si no hay ninguno, nada (que se elija a mano).
 */
export function partidoPorDefectoActa(
  partidos: readonly PartidoParaActa[],
  ahora: string,
): string {
  const pendientes = partidos.filter((p) => !p.con_acta && partidoJugado(p, ahora));
  pendientes.sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""));
  return pendientes[0]?.id ?? "";
}
