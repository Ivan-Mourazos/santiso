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
 * Desempates, en este orden: puntos, enfrentamiento directo entre los equipos empatados
 * (resuelto como mini-liga: puntos, diferencia y goles a favor **solo** de los partidos entre
 * ellos), y después diferencia de goles, goles a favor e id en la tabla general.
 * El enfrentamiento directo es el criterio que ha venido usando el cartel de clasificación,
 * pero allí se aplicaba dentro del comparador de `sort`, donde no funciona: al no ser
 * transitivo, el orden de dos equipos podía deducirse a través de un tercero sin llegar a
 * compararlos. La mini-liga resuelve eso y además cubre los empates de tres o más.
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

  const filas = [...tabla.values()].map((linea) => ({
    ...linea,
    diferencia: linea.golesFavor - linea.golesContra,
  }));

  const disputados = partidos.filter(
    (p) => p.estado === "finalizado" && p.golesLocal !== null && p.golesVisitante !== null,
  );

  // Se agrupa por puntos y el desempate directo se resuelve como una mini-liga dentro de cada
  // grupo. Aplicarlo dentro del comparador no funciona: no es transitivo, así que `sort` puede
  // deducir el orden de dos equipos a través de un tercero sin llegar a compararlos entre sí.
  const porPuntos = new Map<number, typeof filas>();
  for (const fila of filas) {
    const grupo = porPuntos.get(fila.puntos);
    if (grupo) grupo.push(fila);
    else porPuntos.set(fila.puntos, [fila]);
  }

  const ordenadas: typeof filas = [];
  for (const puntos of [...porPuntos.keys()].sort((a, b) => b - a)) {
    const grupo = porPuntos.get(puntos) ?? [];
    const mini = miniLiga(
      grupo.map((f) => f.equipoId),
      disputados,
    );
    grupo.sort((a, b) => {
      const ma = mini.get(a.equipoId);
      const mb = mini.get(b.equipoId);
      if (ma && mb) {
        if (ma.puntos !== mb.puntos) return mb.puntos - ma.puntos;
        if (ma.diferencia !== mb.diferencia) return mb.diferencia - ma.diferencia;
        if (ma.golesFavor !== mb.golesFavor) return mb.golesFavor - ma.golesFavor;
      }
      return (
        b.diferencia - a.diferencia ||
        b.golesFavor - a.golesFavor ||
        a.equipoId.localeCompare(b.equipoId)
      );
    });
    ordenadas.push(...grupo);
  }
  return ordenadas;
}

/**
 * Tabla reducida con solo los partidos jugados **entre** los equipos indicados. Es la forma
 * estándar de resolver un empate a puntos entre dos o más equipos, y a diferencia de comparar
 * de dos en dos sí define un orden coherente cuando hay tres o más implicados.
 */
function miniLiga(
  equipoIds: readonly string[],
  disputados: readonly PartidoClasificacion[],
): Map<string, { puntos: number; golesFavor: number; diferencia: number }> {
  const dentro = new Set(equipoIds);
  const tabla = new Map(
    equipoIds.map((id) => [id, { puntos: 0, golesFavor: 0, diferencia: 0 }]),
  );
  if (equipoIds.length < 2) return tabla;

  for (const partido of disputados) {
    if (!dentro.has(partido.equipoLocalId) || !dentro.has(partido.equipoVisitanteId)) continue;
    const local = tabla.get(partido.equipoLocalId);
    const visitante = tabla.get(partido.equipoVisitanteId);
    if (!local || !visitante) continue;

    const golesLocal = partido.golesLocal ?? 0;
    const golesVisitante = partido.golesVisitante ?? 0;
    local.golesFavor += golesLocal;
    visitante.golesFavor += golesVisitante;
    local.diferencia += golesLocal - golesVisitante;
    visitante.diferencia += golesVisitante - golesLocal;

    if (golesLocal > golesVisitante) local.puntos += 3;
    else if (golesLocal < golesVisitante) visitante.puntos += 3;
    else {
      local.puntos++;
      visitante.puntos++;
    }
  }
  return tabla;
}
