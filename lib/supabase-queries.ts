import {
  getCompeticionLabelsForQuery,
  getMainCompetitionForCategory,
} from "@/lib/competition";
import { supabase } from "@/lib/supabase";

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
  competicion?: string | null;
  fecha_inicio?: string | null;
  [key: string]: unknown;
}

export interface LeagueMatch {
  id: string;
  jornada_id: string;
  categoria: string;
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
  [key: string]: unknown;
}

export function getCompetitionQueryLabels(
  categoria: string,
  competicion: string,
) {
  const labels = new Set(getCompeticionLabelsForQuery(categoria, competicion));
  if (competicion === getMainCompetitionForCategory(categoria)) {
    labels.add("Liga principal");
  }
  return [...labels].filter(Boolean);
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
  const { data, error } = await supabase
    .from("temporadas")
    .select("*")
    .order("created_at", { ascending: false });

  return {
    data: (data || []) as Season[],
    error,
    active: ((data || []).find((t: Season) => t.activa) ||
      data?.[0] ||
      null) as Season | null,
  };
}

export async function fetchTeamsByIds(ids: string[]) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return [] as Team[];

  const { data, error } = await supabase
    .from("equipos")
    .select("*")
    .in("id", uniqueIds)
    .order("nombre", { ascending: true });

  if (error || !data) return [] as Team[];
  return data as Team[];
}

export async function fetchTeamsForCompetition(
  categoria: string,
  competicion: string,
) {
  const labels = getCompetitionQueryLabels(categoria, competicion);
  
  // Obtenemos los IDs de los equipos vinculados a estas etiquetas de competición
  const { data: relations, error: relErr } = await supabase
    .from("equipo_competiciones")
    .select("equipo_id")
    .in("competicion", labels);

  if (relErr || !relations) return [];
  const teamIds = relations.map(r => r.equipo_id);
  
  if (teamIds.length === 0) return [];

  // Ahora obtenemos los datos de esos equipos
  const { data: teams, error: teamsErr } = await supabase
    .from("equipos")
    .select("*")
    .in("id", teamIds)
    .order("nombre", { ascending: true });

  if (teamsErr || !teams) return [];
  return teams as Team[];
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

export async function fetchMatchdaysForCompetition(
  temporadaId: string,
  categoria: string,
  competicion: string,
) {
  const labels = getCompetitionQueryLabels(categoria, competicion);
  const { data, error } = await supabase
    .from("jornadas")
    .select("*")
    .eq("temporada_id", temporadaId)
    .eq("categoria", categoria)
    .in("competicion", labels)
    .order("numero", { ascending: true });

  return { data: (data || []) as Matchday[], error };
}

export async function fetchMatchesForMatchday(
  jornadaId: string,
  categoria: string,
  competicion: string,
  options: { embed?: boolean; jornadaCompeticion?: string | null } = {},
) {
  const labels = new Set(getCompetitionQueryLabels(categoria, competicion));
  if (options.jornadaCompeticion) labels.add(options.jornadaCompeticion);

  const select = options.embed
    ? "*,equipo_local:equipo_local_id(*),equipo_visitante:equipo_visitante_id(*),campo:campo_id(*)"
    : "*";

  const { data, error } = await supabase
    .from("partidos_liga")
    .select(select)
    .eq("jornada_id", jornadaId)
    .eq("categoria", categoria)
    .in("competicion", [...labels])
    .order("fecha", { ascending: true });

  return { data: (data || []) as unknown as LeagueMatch[], error };
}

export async function fetchCurrentSantisoMatches() {
  const { active } = await fetchSeasons();
  const today = new Date().toISOString();

  const { data: santisoTeams } = await supabase
    .from("equipos")
    .select("id, categoria")
    .ilike("nombre", "%santiso%");

  const teamIds = (santisoTeams || []).map((team: { id: string }) => team.id);
  if (teamIds.length === 0) return [] as LeagueMatch[];

  let query = supabase
    .from("partidos_liga")
    .select(
      `
      *,
      local:equipo_local_id(nombre, escudo_url),
      visitante:equipo_visitante_id(nombre, escudo_url),
      jornada:jornada_id(id, temporada_id, numero, competicion)
    `,
    )
    .gte("fecha", today)
    .order("fecha", { ascending: true });

  const teamFilters = teamIds
    .flatMap((id) => [
      `equipo_local_id.eq.${id}`,
      `equipo_visitante_id.eq.${id}`,
    ])
    .join(",");

  query = query.or(teamFilters);

  const { data } = await query;
  const matches = ((data || []) as LeagueMatch[]).filter((match) =>
    active?.id ? match.jornada?.temporada_id === active.id : true,
  );

  const firstByCategory = new Map<string, LeagueMatch>();
  for (const match of matches) {
    const key = match.categoria;
    if (key && !firstByCategory.has(key)) firstByCategory.set(key, match);
  }

  return [...firstByCategory.values()].sort(
    (a, b) =>
      new Date(a.fecha || 0).getTime() - new Date(b.fecha || 0).getTime(),
  );
}
