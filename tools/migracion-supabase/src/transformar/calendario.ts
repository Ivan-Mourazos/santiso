import {
  aFechaHoraLiteral,
  aFechaLiteral,
  claveNombre,
  ESTADOS_PARTIDO,
  esValorDe,
  normalizarCategoria,
} from "@santiso/domain";
import type { Snapshot } from "../snapshot/tipos";
import { marcasDesde, textoOpcional } from "./comunes";
import type { ResultadoEquipos } from "./equipos";
import {
  type CampoNuevo,
  type CompeticionNueva,
  ErrorMigracion,
  type Informe,
  type JornadaDescansoNuevo,
  type JornadaNueva,
  type PartidoNuevo,
} from "./tipos";

/** R8–R9: campos, jornadas, descansos y partidos. */
export function transformarCalendario(
  origen: Snapshot,
  competiciones: CompeticionNueva[],
  equipos: ResultadoEquipos,
  informe: Informe,
) {
  const competicionPorId = new Map(
    competiciones.map((competicion) => [competicion.id, competicion]),
  );

  const campos = origen.campos_futbol.map((fila): CampoNuevo => {
    const nombre = fila.nombre.trim();
    return {
      id: fila.id,
      nombre,
      clave: claveNombre(nombre),
      poblacion: textoOpcional(fila.poblacion),
      ...marcasDesde(fila.created_at),
    };
  });
  const duplicados = campos.filter(
    (campo, indice) => campos.findIndex((otro) => otro.clave === campo.clave) !== indice,
  );
  if (duplicados.length > 0) {
    throw new ErrorMigracion(`Campos duplicados: ${duplicados.map((c) => c.nombre).join(", ")}.`);
  }

  const jornadas = origen.jornadas.map((fila): JornadaNueva => {
    const competicion = competicionPorId.get(fila.competicion_id);
    if (!competicion) {
      throw new ErrorMigracion(`La jornada ${fila.id} apunta a una competición inexistente.`);
    }
    if (normalizarCategoria(fila.categoria) !== competicion.categoria) {
      throw new ErrorMigracion(
        `La jornada ${fila.numero} de "${competicion.nombre}" tiene otra categoría (${fila.categoria}).`,
      );
    }
    return {
      id: fila.id,
      competicionId: competicion.id,
      numero: fila.numero,
      nombreFase: textoOpcional(fila.nombre_fase),
      fechaInicio: fila.fecha_inicio ? aFechaLiteral(fila.fecha_inicio) : null,
      fechaFin: fila.fecha_fin ? aFechaLiteral(fila.fecha_fin) : null,
      ...marcasDesde(fila.created_at),
    };
  });
  const numeros = new Set<string>();
  for (const jornada of jornadas) {
    const clave = `${jornada.competicionId}|${jornada.numero}`;
    if (numeros.has(clave)) {
      throw new ErrorMigracion(
        `Jornada ${jornada.numero} repetida en la competición ${jornada.competicionId}.`,
      );
    }
    numeros.add(clave);
  }

  const jornadaPorId = new Map(jornadas.map((jornada) => [jornada.id, jornada]));
  const jornadaDe = (id: string) => {
    const jornada = jornadaPorId.get(id);
    if (!jornada) throw new ErrorMigracion(`Referencia a una jornada inexistente: ${id}.`);
    return jornada;
  };

  const descansos = new Map<string, JornadaDescansoNuevo>();
  for (const fila of origen.jornada_equipo_descanso) {
    const jornada = jornadaDe(fila.jornada_id);
    const equipoId = equipos.resolver(fila.equipo_id, jornada.competicionId);
    descansos.set(`${jornada.id}|${equipoId}`, { jornadaId: jornada.id, equipoId });
  }

  let sinDisputarConCeros = 0;
  const partidos = origen.partidos_liga.map((fila): PartidoNuevo => {
    const jornada = jornadaDe(fila.jornada_id);
    if (fila.competicion_id !== jornada.competicionId) {
      throw new ErrorMigracion(
        `El partido ${fila.id} tiene una competición distinta a la de su jornada.`,
      );
    }
    const estado = fila.estado;
    if (!esValorDe(ESTADOS_PARTIDO, estado)) {
      throw new ErrorMigracion(`El partido ${fila.id} tiene un estado desconocido: "${estado}".`);
    }
    if ((fila.goles_local === null) !== (fila.goles_visitante === null)) {
      throw new ErrorMigracion(`El partido ${fila.id} tiene un marcador incompleto.`);
    }

    let golesLocal = fila.goles_local;
    let golesVisitante = fila.goles_visitante;
    const disputado = estado === "finalizado" || estado === "en_juego";
    if (estado === "finalizado" && golesLocal === null) {
      throw new ErrorMigracion(`El partido finalizado ${fila.id} no tiene marcador.`);
    }
    if (!disputado && golesLocal !== null) {
      if (golesLocal !== 0 || golesVisitante !== 0) {
        throw new ErrorMigracion(
          `El partido ${fila.id} está "${estado}" pero tiene marcador ${golesLocal}-${golesVisitante}.`,
        );
      }
      golesLocal = null;
      golesVisitante = null;
      sinDisputarConCeros++;
    }

    return {
      id: fila.id,
      jornadaId: jornada.id,
      equipoLocalId: equipos.resolver(fila.equipo_local_id, jornada.competicionId),
      equipoVisitanteId: equipos.resolver(fila.equipo_visitante_id, jornada.competicionId),
      golesLocal,
      golesVisitante,
      estado,
      fecha: fila.fecha ? aFechaHoraLiteral(fila.fecha) : null,
      campoId: fila.campo_id,
      ...marcasDesde(fila.created_at),
    };
  });
  if (sinDisputarConCeros > 0) {
    informe.avisos.push(
      `Partidos sin disputar con marcador 0-0 por defecto: ${sinDisputarConCeros}. Ahora quedan sin marcador.`,
    );
  }

  return { campos, jornadas, jornadaDescansos: [...descansos.values()], partidos };
}
