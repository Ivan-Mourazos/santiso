import { normalizarNombreTemporada } from "@santiso/domain";
import type { Snapshot } from "../snapshot/tipos";
import { marcasDesde } from "./comunes";
import { ErrorMigracion, type Informe, type TemporadaNueva } from "./tipos";

/** R1: nombres normalizados y exactamente una temporada activa. */
export function transformarTemporadas(origen: Snapshot, informe: Informe): TemporadaNueva[] {
  const temporadas = origen.temporadas.map((fila) => {
    const nombre = normalizarNombreTemporada(fila.nombre);
    if (nombre !== fila.nombre) {
      informe.avisos.push(`Temporada "${fila.nombre}" renombrada a "${nombre}".`);
    }
    return { id: fila.id, nombre, activa: fila.activa === true, ...marcasDesde(fila.created_at) };
  });
  const activas = temporadas.filter((temporada) => temporada.activa).length;
  if (activas !== 1) {
    throw new ErrorMigracion(`Debe haber exactamente una temporada activa y hay ${activas}.`);
  }
  return temporadas;
}
