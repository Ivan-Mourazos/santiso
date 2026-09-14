import {
  claveNombre,
  esValorDe,
  FORMATOS_COMPETICION,
  normalizarCategoria,
  reglasClasificacionSchema,
} from "@santiso/domain";
import type { Snapshot } from "../snapshot/tipos";
import { marcasDesde } from "./comunes";
import {
  type CompeticionAliasNuevo,
  type CompeticionNueva,
  ErrorMigracion,
  type Informe,
  type TemporadaNueva,
} from "./tipos";

/** R2–R4: temporada de cada competición, reglas validadas y alias deduplicados. */
export function transformarCompeticiones(
  origen: Snapshot,
  temporadas: TemporadaNueva[],
  informe: Informe,
): { competiciones: CompeticionNueva[]; competicionAlias: CompeticionAliasNuevo[] } {
  const activa = temporadas.find((temporada) => temporada.activa);
  const [ultimaInactiva] = temporadas
    .filter((temporada) => !temporada.activa)
    .sort((a, b) => b.nombre.localeCompare(a.nombre));

  const temporadasPorCompeticion = new Map<string, Set<string>>();
  for (const jornada of origen.jornadas) {
    const conjunto = temporadasPorCompeticion.get(jornada.competicion_id) ?? new Set<string>();
    conjunto.add(jornada.temporada_id);
    temporadasPorCompeticion.set(jornada.competicion_id, conjunto);
  }

  const competiciones = origen.competiciones.map((fila): CompeticionNueva => {
    const nombre = fila.nombre.trim();
    const deJornadas = [...(temporadasPorCompeticion.get(fila.id) ?? [])];
    if (deJornadas.length > 1) {
      throw new ErrorMigracion(
        `La competición "${nombre}" tiene jornadas en ${deJornadas.length} temporadas.`,
      );
    }

    let [temporadaId] = deJornadas;
    if (!temporadaId) {
      const destino = fila.activa ? activa : ultimaInactiva;
      if (!destino) {
        throw new ErrorMigracion(`No hay temporada para la competición sin jornadas "${nombre}".`);
      }
      temporadaId = destino.id;
      informe.avisos.push(
        `Competición sin jornadas "${nombre}" asignada a la temporada ${destino.nombre}.`,
      );
    }

    const filasReglas = origen.reglas_liga.filter((reglas) => reglas.competicion_id === fila.id);
    if (filasReglas.length > 1) {
      throw new ErrorMigracion(
        `La competición "${nombre}" tiene ${filasReglas.length} filas de reglas.`,
      );
    }
    const [filaReglas] = filasReglas;
    if (filaReglas && filaReglas.temporada_id !== temporadaId) {
      throw new ErrorMigracion(`Las reglas de "${nombre}" pertenecen a otra temporada.`);
    }

    const formato = fila.formato ?? "liga";
    if (!esValorDe(FORMATOS_COMPETICION, formato)) {
      throw new ErrorMigracion(
        `La competición "${nombre}" tiene un formato desconocido: "${formato}".`,
      );
    }

    return {
      id: fila.id,
      temporadaId,
      categoria: normalizarCategoria(fila.categoria),
      nombre,
      formato,
      orden: fila.orden,
      reglasClasificacion: filaReglas ? reglasClasificacionSchema.parse(filaReglas.reglas) : [],
      ...marcasDesde(fila.created_at),
    };
  });

  const vistos = new Set<string>();
  const competicionAlias: CompeticionAliasNuevo[] = [];
  for (const etiqueta of origen.competicion_etiquetas) {
    const clave = claveNombre(etiqueta.etiqueta);
    const clavePar = `${etiqueta.competicion_id}|${clave}`;
    if (!clave || vistos.has(clavePar)) continue;
    vistos.add(clavePar);
    competicionAlias.push({
      competicionId: etiqueta.competicion_id,
      alias: etiqueta.etiqueta.trim(),
      clave,
    });
  }

  return { competiciones, competicionAlias };
}
