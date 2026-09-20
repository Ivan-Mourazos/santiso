import { calcularClasificacion } from "@santiso/domain";
import { cargarJornadasDeCompeticion } from "@/lib/server/acciones/calendario";
import { cargarReglas } from "@/lib/server/acciones/competiciones";
import { cargarPartidosDeCompeticion } from "@/lib/server/acciones/clasificacion";
import { fetchCompeticiones, fetchTeamsForCompetition } from "@/lib/lecturas-cliente";

/**
 * Datos del cartel de clasificación. El cálculo vive en `@santiso/domain`: aquí solo se leen
 * los partidos y se da forma a lo que espera la plantilla. Antes había aquí una copia del
 * cálculo con desempates propios, que divergía de la tabla que se veía en pantalla.
 */
export async function getClasificacionData(categoria: string, competicionId: string) {
  try {
    const [competiciones, partidos, equipos, jornadas, reglas] = [
      await fetchCompeticiones(),
      await cargarPartidosDeCompeticion(competicionId),
      await fetchTeamsForCompetition(categoria, competicionId),
      await cargarJornadasDeCompeticion(competicionId),
      await cargarReglas(competicionId),
    ];

    const formato = competiciones.find((c) => c.id === competicionId)?.formato || "liga";

    // En eliminatoria no hay tabla: la plantilla pinta el cuadro por rondas.
    if (formato === "eliminatoria") {
      const rondas = jornadas.map((jornada) => ({
        id: jornada.id,
        numero: jornada.numero,
        nombre: jornada.nombre_fase || `Ronda ${jornada.numero}`,
        partidos: partidos.filter((p) => p.jornada_id === jornada.id),
      }));
      return { formato, equipos: rondas, reglas };
    }

    const porId = new Map(equipos.map((e) => [e.id, e]));
    const tabla = calcularClasificacion(
      equipos.map((e) => e.id),
      partidos.map((p) => ({
        equipoLocalId: p.equipo_local_id,
        equipoVisitanteId: p.equipo_visitante_id,
        golesLocal: p.goles_local,
        golesVisitante: p.goles_visitante,
        estado: p.estado,
      })),
    );

    return {
      formato,
      equipos: tabla.map((fila) => ({
        equipo_id: fila.equipoId,
        nombre: porId.get(fila.equipoId)?.nombre ?? "",
        escudo_url: porId.get(fila.equipoId)?.escudo_url ?? null,
        pj: fila.jugados,
        pg: fila.ganados,
        pe: fila.empatados,
        pp: fila.perdidos,
        gf: fila.golesFavor,
        gc: fila.golesContra,
        pts: fila.puntos,
      })),
      reglas,
    };
  } catch (error) {
    console.error("getClasificacionData", error);
    return { formato: "liga", equipos: [], reglas: [] };
  }
}
