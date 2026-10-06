interface PartidoLeido {
  localNombre: string;
  visitanteNombre: string;
  golesLocal: string;
  golesVisitante: string;
  hora?: string;
}

const clave = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Cuánto dato trae una fila: entre dos lecturas del mismo partido gana la más completa. */
const peso = (partido: PartidoLeido) =>
  (partido.golesLocal !== "" && partido.golesVisitante !== "" ? 2 : 0) + (partido.hora ? 1 : 0);

/**
 * Con varias capturas de la misma jornada que se solapan, el mismo partido llega dos veces.
 * Se queda con una fila por cruce, en el orden de la primera aparición.
 */
export function sinPartidosRepetidos<T extends PartidoLeido>(partidos: readonly T[]): T[] {
  const porCruce = new Map<string, T>();
  for (const partido of partidos) {
    const cruce = `${clave(partido.localNombre)}#${clave(partido.visitanteNombre)}`;
    const anterior = porCruce.get(cruce);
    if (!anterior || peso(partido) > peso(anterior)) porCruce.set(cruce, partido);
  }
  return [...porCruce.values()];
}
