/** Partido tal y como lo necesita el cálculo: sin fechas, campos ni nombres. */
export interface PartidoClasificacion {
  equipoLocalId: string;
  equipoVisitanteId: string;
  golesLocal: number | null;
  golesVisitante: number | null;
  estado: string;
}

export interface LineaClasificacion {
  equipoId: string;
  puntos: number;
  jugados: number;
  ganados: number;
  empatados: number;
  perdidos: number;
  golesFavor: number;
  golesContra: number;
  diferencia: number;
}

const nuevaLinea = (equipoId: string): LineaClasificacion => ({
  equipoId,
  puntos: 0,
  jugados: 0,
  ganados: 0,
  empatados: 0,
  perdidos: 0,
  golesFavor: 0,
  golesContra: 0,
  diferencia: 0,
});

/**
 * Clasificación desde los partidos disputados. Solo cuentan los finalizados con marcador: un
 * «finalizado» sin goles o un aplazado 0-0 no son un empate, son un partido sin jugar.
 * Desempates: puntos, diferencia de goles, goles a favor y, por último, id (orden estable).
 * La Fase 6 añade `clasificacion_ajustes` y desempates configurables por competición.
 */
export function calcularClasificacion(
  equipoIds: readonly string[],
  partidos: readonly PartidoClasificacion[],
): LineaClasificacion[] {
  const tabla = new Map(equipoIds.map((id) => [id, nuevaLinea(id)]));

  for (const partido of partidos) {
    if (partido.estado !== "finalizado") continue;
    const { golesLocal, golesVisitante } = partido;
    if (golesLocal === null || golesVisitante === null) continue;
    const local = tabla.get(partido.equipoLocalId);
    const visitante = tabla.get(partido.equipoVisitanteId);
    if (!local || !visitante) continue;

    local.jugados++;
    visitante.jugados++;
    local.golesFavor += golesLocal;
    local.golesContra += golesVisitante;
    visitante.golesFavor += golesVisitante;
    visitante.golesContra += golesLocal;

    if (golesLocal > golesVisitante) {
      local.ganados++;
      local.puntos += 3;
      visitante.perdidos++;
    } else if (golesLocal < golesVisitante) {
      visitante.ganados++;
      visitante.puntos += 3;
      local.perdidos++;
    } else {
      local.empatados++;
      visitante.empatados++;
      local.puntos++;
      visitante.puntos++;
    }
  }

  return [...tabla.values()]
    .map((linea) => ({ ...linea, diferencia: linea.golesFavor - linea.golesContra }))
    .sort(
      (a, b) =>
        b.puntos - a.puntos ||
        b.diferencia - a.diferencia ||
        b.golesFavor - a.golesFavor ||
        a.equipoId.localeCompare(b.equipoId),
    );
}
