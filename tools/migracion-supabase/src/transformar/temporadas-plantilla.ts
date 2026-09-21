import { idDeterminista } from "../ids";
import type {
  CompeticionNueva,
  JornadaNueva,
  JugadorLegado,
  JugadorNuevo,
  JugadorTemporadaNuevo,
  ParticipacionNueva,
  PartidoNuevo,
  StaffLegado,
  StaffNuevo,
  StaffTemporadaNuevo,
  TemporadaNueva,
} from "./tipos";

/**
 * Separa cada jugador y cada miembro del staff en persona e inscripción por temporada.
 *
 * **Son las mismas reglas que el traspaso de `packages/db/migrations/0001_plantillas-por-temporada.sql`.**
 * Si cambian aquí, tienen que cambiar allí, y al revés:
 * - jugador: la última temporada (por nombre) en la que tiene convocatoria; sin ninguna, la activa;
 * - staff: la temporada anterior a la activa; si no la hay, la activa.
 * Sin temporada a la que asignar, la persona se conserva sin inscripción.
 */
export function repartirPorTemporada(entrada: {
  jugadores: JugadorLegado[];
  staff: StaffLegado[];
  temporadas: TemporadaNueva[];
  competiciones: CompeticionNueva[];
  jornadas: JornadaNueva[];
  partidos: PartidoNuevo[];
  participaciones: ParticipacionNueva[];
}): {
  jugadores: JugadorNuevo[];
  jugadoresTemporada: JugadorTemporadaNuevo[];
  staff: StaffNuevo[];
  staffTemporada: StaffTemporadaNuevo[];
} {
  const nombre = new Map(entrada.temporadas.map((t) => [t.id, t.nombre]));
  const activa = entrada.temporadas.find((t) => t.activa)?.id ?? null;

  const temporadaDeCompeticion = new Map(entrada.competiciones.map((c) => [c.id, c.temporadaId]));
  const competicionDeJornada = new Map(entrada.jornadas.map((j) => [j.id, j.competicionId]));
  const jornadaDePartido = new Map(entrada.partidos.map((p) => [p.id, p.jornadaId]));

  const ultimaConvocatoria = new Map<string, string>();
  for (const participacion of entrada.participaciones) {
    const jornada = jornadaDePartido.get(participacion.partidoId);
    const competicion = jornada ? competicionDeJornada.get(jornada) : undefined;
    const temporada = competicion ? temporadaDeCompeticion.get(competicion) : undefined;
    if (!temporada) continue;
    const actual = ultimaConvocatoria.get(participacion.jugadorId);
    if (!actual || (nombre.get(temporada) ?? "") > (nombre.get(actual) ?? "")) {
      ultimaConvocatoria.set(participacion.jugadorId, temporada);
    }
  }

  const nombreActiva = activa ? (nombre.get(activa) ?? "") : "";
  const anterior =
    entrada.temporadas
      .filter((t) => activa && t.nombre < nombreActiva)
      .sort((a, b) => b.nombre.localeCompare(a.nombre))[0]?.id ?? null;
  const temporadaStaff = anterior ?? activa;

  const jugadores: JugadorNuevo[] = [];
  const jugadoresTemporada: JugadorTemporadaNuevo[] = [];
  for (const { categoria, dorsal, posicion, capitania, foto, ...persona } of entrada.jugadores) {
    jugadores.push(persona);
    const temporadaId = ultimaConvocatoria.get(persona.id) ?? activa;
    if (!temporadaId) continue;
    jugadoresTemporada.push({
      id: idDeterminista("jugador-temporada", persona.id, temporadaId, categoria),
      temporadaId,
      jugadorId: persona.id,
      categoria,
      dorsal,
      posicion,
      capitania,
      foto,
    });
  }

  const staff: StaffNuevo[] = [];
  const staffTemporada: StaffTemporadaNuevo[] = [];
  for (const { tipo, categoria, cargo, orden, foto, ...persona } of entrada.staff) {
    staff.push(persona);
    if (!temporadaStaff) continue;
    staffTemporada.push({
      id: idDeterminista("staff-temporada", persona.id, temporadaStaff),
      temporadaId: temporadaStaff,
      staffId: persona.id,
      tipo,
      categoria,
      cargo,
      orden,
      foto,
    });
  }

  return { jugadores, jugadoresTemporada, staff, staffTemporada };
}
