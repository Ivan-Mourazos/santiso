import type { CompetenciaRow } from "@/lib/competition";
import {
  cargarJornadasDeCompeticion,
  cargarPartidosDeJornada,
} from "@/lib/server/acciones/calendario";
import { cargarCompeticiones } from "@/lib/server/acciones/competiciones";
import {
  cargarEquiposDeCompeticion,
  cargarEquiposPorIds,
} from "@/lib/server/acciones/equipos";
import { cargarTemporadas } from "@/lib/server/acciones/temporadas";

export type { CompetenciaRow };

export interface Team {
  id: string;
  nombre: string;
  escudo_url?: string | null;
  categoria?: string | null;
  [key: string]: unknown;
}

export interface Season {
  id: string;
  nombre: string;
  activa?: boolean;
  created_at?: string;
}

export interface Matchday {
  id: string;
  temporada_id: string;
  categoria: string;
  numero: number;
  competicion_id?: string | null;
  competicion?: string | null;
  fecha_inicio?: string | null;
  nombre_fase?: string | null;
  [key: string]: unknown;
}

export interface LeagueMatch {
  id: string;
  jornada_id: string;
  categoria: string;
  competicion_id?: string | null;
  competicion?: string | null;
  equipo_local_id?: string | null;
  equipo_visitante_id?: string | null;
  goles_local?: number | null;
  goles_visitante?: number | null;
  estado?: string | null;
  fecha?: string | null;
  campo_id?: string | null;
  equipo_local?: Team | null;
  equipo_visitante?: Team | null;
  local?: Team | null;
  visitante?: Team | null;
  campo?: { id: string; nombre: string; poblacion?: string | null } | null;
  jornada?: Matchday | null;
  /** Join opcional desde `partidos_liga.competicion_id`. */
  competiciones?: { id: string; nombre: string } | null;
  [key: string]: unknown;
}

export async function fetchCompeticiones(): Promise<CompetenciaRow[]> {
  const resultado = await cargarCompeticiones();
  return resultado.ok ? resultado.datos : [];
}

export function sortTeamsByName<T extends { nombre?: string | null }>(
  teams: T[],
) {
  return [...teams].sort((a, b) =>
    (a.nombre || "").localeCompare(b.nombre || "", "es", {
      sensitivity: "base",
    }),
  );
}

export async function fetchSeasons() {
  const resultado = await cargarTemporadas();
  if (!resultado.ok) {
    return { data: [] as Season[], error: new Error(resultado.error), active: null };
  }
  const data = resultado.datos as Season[];
  return { data, error: null, active: data.find((t) => t.activa) ?? data[0] ?? null };
}

export async function fetchTeamsByIds(ids: string[]) {
  // `Team` arrastra un índice de cadena de la época de Supabase, donde la fila traía columnas
  // arbitrarias. `EquipoDto` es un subconjunto estricto con los mismos nombres, así que la
  // conversión es segura; desaparece cuando las Fases 4-6 retiren los DTO de compatibilidad.
  return (await cargarEquiposPorIds(ids)) as unknown as Team[];
}

/** `categoria` ya no filtra: la competición determina la categoría. Se conserva por compatibilidad. */
export async function fetchTeamsForCompetition(_categoria: string, competicionId: string) {
  // Misma conversión documentada que en `fetchTeamsByIds`.
  return (await cargarEquiposDeCompeticion(competicionId)) as unknown as Team[];
}

export async function mergeMissingTeams(current: Team[], ids: string[]) {
  const have = new Set(current.map((team) => team.id));
  const missing = ids.filter((id) => id && !have.has(id));
  if (missing.length === 0) return sortTeamsByName(current);

  const extra = await fetchTeamsByIds(missing);
  const byId = new Map(current.map((team) => [team.id, team]));
  for (const team of extra) byId.set(team.id, team);
  return sortTeamsByName([...byId.values()]);
}

/** `temporadaId` y `categoria` ya no filtran: los determina la competición. */
export async function fetchMatchdaysForCompetition(
  _temporadaId: string,
  _categoria: string,
  competicionId: string,
) {
  const jornadas = await cargarJornadasDeCompeticion(competicionId);
  // `Matchday` arrastra un índice de cadena de la época de Supabase; el DTO es un subconjunto
  // estricto con los mismos nombres, así que la conversión es segura.
  return { data: jornadas as unknown as Matchday[], error: null };
}

/**
 * `categoria` y `competicionId` ya no filtran: los determina la jornada. `embed` desaparece;
 * la pantalla resuelve equipos y campos con los catálogos que ya carga.
 */
export async function fetchMatchesForMatchday(
  jornadaId: string,
  _categoria?: string,
  _competicionId?: string,
) {
  const partidos = await cargarPartidosDeJornada(jornadaId);
  // Misma conversión documentada que en `fetchMatchdaysForCompetition`.
  return { data: partidos as unknown as LeagueMatch[], error: null };
}
