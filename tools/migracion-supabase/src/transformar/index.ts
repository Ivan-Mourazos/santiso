import type { Snapshot } from "../snapshot/tipos";
import { transformarActas } from "./actas";
import { transformarCalendario } from "./calendario";
import { transformarClub } from "./club";
import { transformarCompeticiones } from "./competiciones";
import { transformarEquipos } from "./equipos";
import { transformarPlantilla } from "./plantilla";
import { transformarTemporadas } from "./temporadas";
import { crearInforme, ErrorMigracion, type Informe, type ModeloNuevo } from "./tipos";

export interface ResultadoTransformacion {
  modelo: ModeloNuevo;
  informe: Informe;
}

/** Snapshot de Supabase → modelo nuevo. Pura y determinista: misma entrada, mismos ids y filas. */
export function transformar(origen: Snapshot): ResultadoTransformacion {
  const informe = crearInforme();
  const temporadas = transformarTemporadas(origen, informe);
  const { competiciones, competicionAlias } = transformarCompeticiones(origen, temporadas, informe);
  const equipos = transformarEquipos(origen, competiciones, informe);
  const calendario = transformarCalendario(origen, competiciones, equipos, informe);
  const plantilla = transformarPlantilla(origen, informe);
  const actas = transformarActas(origen, informe);
  const club = transformarClub(origen, informe);

  const modelo: ModeloNuevo = {
    temporadas,
    competiciones,
    competicionAlias,
    equipos: equipos.equipos,
    competicionEquipos: equipos.competicionEquipos,
    jugadores: plantilla.jugadores,
    staff: plantilla.staff,
    campos: calendario.campos,
    jornadas: calendario.jornadas,
    jornadaDescansos: calendario.jornadaDescansos,
    partidos: calendario.partidos,
    partidoParticipaciones: actas.partidoParticipaciones,
    partidoEventos: actas.partidoEventos,
    patrocinadores: club.patrocinadores,
    ajustes: club.ajustes,
  };
  validarReferencias(modelo);
  return { modelo, informe };
}

/** Comprueba todas las claves foráneas en memoria para dar mensajes claros antes de tocar la BD. */
export function validarReferencias(modelo: ModeloNuevo): void {
  const ids = (filas: { id: string }[]) => new Set(filas.map((fila) => fila.id));
  const temporadas = ids(modelo.temporadas);
  const competiciones = ids(modelo.competiciones);
  const equipos = ids(modelo.equipos);
  const jugadores = ids(modelo.jugadores);
  const campos = ids(modelo.campos);
  const jornadas = ids(modelo.jornadas);
  const partidos = ids(modelo.partidos);

  const exigir = (conjunto: Set<string>, valor: string | null | undefined, contexto: string) => {
    if (valor != null && !conjunto.has(valor)) {
      throw new ErrorMigracion(`Referencia rota en ${contexto}: ${valor}.`);
    }
  };

  for (const c of modelo.competiciones)
    exigir(temporadas, c.temporadaId, `competición "${c.nombre}"`);
  for (const a of modelo.competicionAlias)
    exigir(competiciones, a.competicionId, `alias "${a.alias}"`);
  for (const r of modelo.competicionEquipos) {
    exigir(competiciones, r.competicionId, "inscripción de equipo");
    exigir(equipos, r.equipoId, "inscripción de equipo");
  }
  for (const j of modelo.jornadas) exigir(competiciones, j.competicionId, `jornada ${j.numero}`);
  for (const d of modelo.jornadaDescansos) {
    exigir(jornadas, d.jornadaId, "descanso");
    exigir(equipos, d.equipoId, "descanso");
  }
  for (const p of modelo.partidos) {
    exigir(jornadas, p.jornadaId, `partido ${p.id}`);
    exigir(equipos, p.equipoLocalId, `partido ${p.id}`);
    exigir(equipos, p.equipoVisitanteId, `partido ${p.id}`);
    exigir(campos, p.campoId, `partido ${p.id}`);
  }
  for (const x of modelo.partidoParticipaciones) {
    exigir(partidos, x.partidoId, "participación");
    exigir(jugadores, x.jugadorId, "participación");
  }
  for (const e of modelo.partidoEventos) {
    exigir(partidos, e.partidoId, `evento ${e.id}`);
    exigir(jugadores, e.jugadorId, `evento ${e.id}`);
    exigir(jugadores, e.jugadorSaleId, `evento ${e.id}`);
  }
}
