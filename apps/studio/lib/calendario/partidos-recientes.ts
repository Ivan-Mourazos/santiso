interface EstadoPartido {
  estado?: string | null;
  goles_local?: number | null;
  goles_visitante?: number | null;
}

/** Lista ya ordenada por jornada: último jugado y siguientes. No altera datos ni borradores. */
export function partidosRecientes<T extends EstadoPartido>(partidos: T[]) {
  let ultimo = -1;
  partidos.forEach((p, i) => {
    const jugado =
      p.estado === "finalizado" ||
      (!p.estado && p.goles_local != null && p.goles_visitante != null);
    if (jugado) ultimo = i;
  });
  const corte = Math.max(0, ultimo);
  return { anteriores: partidos.slice(0, corte), actuales: partidos.slice(corte) };
}
