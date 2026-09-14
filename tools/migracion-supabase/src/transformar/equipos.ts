import {
  aInstanteIso,
  type Categoria,
  claveNombre,
  esEquipoPropio,
  normalizarCategoria,
} from "@santiso/domain";
import { idDeterminista } from "../ids";
import { claveMediaDesdeUrl } from "../snapshot/media";
import type { FilaEquipo, Snapshot } from "../snapshot/tipos";
import { marcasDesde } from "./comunes";
import {
  type CompeticionEquipoNuevo,
  type CompeticionNueva,
  type EquipoNuevo,
  ErrorMigracion,
  type Informe,
} from "./tipos";

export interface ResultadoEquipos {
  equipos: EquipoNuevo[];
  competicionEquipos: CompeticionEquipoNuevo[];
  /** Id definitivo de un equipo de origen dentro de una competición (tras fusiones y separaciones). */
  resolver: (equipoIdOrigen: string, competicionId: string) => string;
}

/** R5–R7 y R17. */
export function transformarEquipos(
  origen: Snapshot,
  competiciones: CompeticionNueva[],
  informe: Informe,
): ResultadoEquipos {
  const competicionPorId = new Map(
    competiciones.map((competicion) => [competicion.id, competicion]),
  );
  const competicionDeJornada = new Map(
    origen.jornadas.map((jornada) => [jornada.id, jornada.competicion_id]),
  );

  // R5 — Agrupar por categoría + clave y conservar el más antiguo.
  const grupos = new Map<string, { categoria: Categoria; filas: FilaEquipo[] }>();
  for (const fila of origen.equipos) {
    if (!fila.categoria) {
      throw new ErrorMigracion(`El equipo "${fila.nombre}" (${fila.id}) no tiene categoría.`);
    }
    const categoria = normalizarCategoria(fila.categoria);
    const clave = `${categoria}|${claveNombre(fila.nombre)}`;
    const grupo = grupos.get(clave) ?? { categoria, filas: [] };
    grupo.filas.push(fila);
    grupos.set(clave, grupo);
  }

  const equipos = new Map<string, EquipoNuevo>();
  const idPorCategoriaClave = new Map<string, string>();
  const idConservado = new Map<string, string>();

  for (const [claveGrupo, { categoria, filas }] of grupos) {
    const ordenadas = [...filas].sort((a, b) =>
      aInstanteIso(a.created_at).localeCompare(aInstanteIso(b.created_at)),
    );
    const [conservada, ...resto] = ordenadas;
    if (!conservada) continue;
    const nombre = conservada.nombre.trim();
    const equipo: EquipoNuevo = {
      id: conservada.id,
      nombre,
      clave: claveNombre(nombre),
      categoria,
      esPropio: esEquipoPropio(nombre),
      escudo:
        ordenadas.map((fila) => claveMediaDesdeUrl(fila.escudo_url)).find((c) => c !== null) ??
        null,
      ...marcasDesde(conservada.created_at),
    };
    equipos.set(equipo.id, equipo);
    idPorCategoriaClave.set(claveGrupo, equipo.id);
    for (const fila of ordenadas) idConservado.set(fila.id, equipo.id);
    if (resto.length > 0) {
      informe.equiposFusionados.push({
        conservado: equipo.id,
        eliminados: resto.map((fila) => fila.id),
        nombre,
        categoria,
      });
    }
  }

  // R6 — Materializar el equipo definitivo de cada referencia (equipo de origen, competición).
  const destino = new Map<string, string>();
  const materializar = (equipoIdOrigen: string, competicionId: string) => {
    const clave = `${equipoIdOrigen}|${competicionId}`;
    if (destino.has(clave)) return;
    const base = equipos.get(idConservado.get(equipoIdOrigen) ?? "");
    if (!base) throw new ErrorMigracion(`Referencia a un equipo inexistente: ${equipoIdOrigen}.`);
    const competicion = competicionPorId.get(competicionId);
    if (!competicion) {
      throw new ErrorMigracion(`Referencia a una competición inexistente: ${competicionId}.`);
    }
    if (base.categoria === competicion.categoria) {
      destino.set(clave, base.id);
      return;
    }
    const claveDestino = `${competicion.categoria}|${base.clave}`;
    let id = idPorCategoriaClave.get(claveDestino);
    if (!id) {
      id = idDeterminista("equipo", competicion.categoria, base.clave);
      equipos.set(id, {
        id,
        nombre: base.nombre,
        clave: base.clave,
        categoria: competicion.categoria,
        esPropio: base.esPropio,
        escudo: base.escudo ?? null,
      });
      idPorCategoriaClave.set(claveDestino, id);
      informe.equiposSeparados.push({
        origen: base.id,
        nuevo: id,
        nombre: base.nombre,
        categoria: competicion.categoria,
        competicion: competicion.nombre,
      });
    }
    destino.set(clave, id);
  };

  const competicionDe = (jornadaId: string) => {
    const id = competicionDeJornada.get(jornadaId);
    if (!id) throw new ErrorMigracion(`Referencia a una jornada inexistente: ${jornadaId}.`);
    return id;
  };

  for (const relacion of origen.equipo_competiciones) {
    materializar(relacion.equipo_id, relacion.competicion_id);
  }
  for (const partido of origen.partidos_liga) {
    const competicionId = competicionDe(partido.jornada_id);
    materializar(partido.equipo_local_id, competicionId);
    materializar(partido.equipo_visitante_id, competicionId);
  }
  for (const descanso of origen.jornada_equipo_descanso) {
    materializar(descanso.equipo_id, competicionDe(descanso.jornada_id));
  }

  const resolver = (equipoIdOrigen: string, competicionId: string) => {
    const id = destino.get(`${equipoIdOrigen}|${competicionId}`);
    if (!id) {
      throw new ErrorMigracion(
        `El equipo ${equipoIdOrigen} no tiene referencias en la competición ${competicionId}.`,
      );
    }
    return id;
  };

  // R7 — Inscripciones, incluidas las de equipos que juegan sin estar inscritos.
  const relaciones = new Map<string, CompeticionEquipoNuevo>();
  const inscribir = (competicionId: string, equipoId: string, desdePartido: boolean) => {
    const clave = `${competicionId}|${equipoId}`;
    if (relaciones.has(clave)) return;
    if (desdePartido) {
      const equipo = equipos.get(equipoId)?.nombre ?? equipoId;
      const competicion = competicionPorId.get(competicionId)?.nombre ?? competicionId;
      informe.avisos.push(`Equipo "${equipo}" inscrito en "${competicion}" porque juega en ella.`);
    }
    relaciones.set(clave, { competicionId, equipoId });
  };
  for (const relacion of origen.equipo_competiciones) {
    inscribir(
      relacion.competicion_id,
      resolver(relacion.equipo_id, relacion.competicion_id),
      false,
    );
  }
  for (const partido of origen.partidos_liga) {
    const competicionId = competicionDe(partido.jornada_id);
    inscribir(competicionId, resolver(partido.equipo_local_id, competicionId), true);
    inscribir(competicionId, resolver(partido.equipo_visitante_id, competicionId), true);
  }

  // R17 — Clasificación manual antigua, solo como referencia.
  for (const fila of origen.equipos) {
    const valores = {
      pts: fila.pts ?? 0,
      pj: fila.pj ?? 0,
      pg: fila.pg ?? 0,
      pe: fila.pe ?? 0,
      pp: fila.pp ?? 0,
      gf: fila.gf ?? 0,
      gc: fila.gc ?? 0,
    };
    if (Object.values(valores).some((valor) => valor !== 0)) {
      informe.clasificacionManualAntigua.push({
        equipoId: idConservado.get(fila.id) ?? fila.id,
        nombre: fila.nombre,
        categoria: fila.categoria ?? "",
        ...valores,
      });
    }
  }

  return {
    equipos: [...equipos.values()],
    competicionEquipos: [...relaciones.values()],
    resolver,
  };
}
