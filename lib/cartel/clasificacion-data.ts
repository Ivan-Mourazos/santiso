import { supabase } from "@/lib/supabase-browser";
import { fetchTeamsForCompetition, mergeMissingTeams } from "@/lib/supabase-queries";

function isCompletedMatch(match: any) {
  const estado = String(match.estado || "").toLowerCase().trim();
  const hasScore = match.goles_local !== null
    && match.goles_local !== undefined
    && match.goles_visitante !== null
    && match.goles_visitante !== undefined;

  if (estado === "finalizado") return true;
  if (estado === "cancelado" || estado === "aplazado") return false;
  return hasScore;
}

export async function getClasificacionData(categoria: string, competicionId: string) {
  const [{ data: compData }, { data: partidosData }, baseTeams, { data: activeSeason }, { data: jornadasData }] = await Promise.all([
    supabase.from("competiciones").select("formato").eq("id", competicionId).single(),
    supabase
      .from("partidos_liga")
      .select("*, equipo_local:equipo_local_id(*), equipo_visitante:equipo_visitante_id(*)")
      .eq("categoria", categoria)
      .eq("competicion_id", competicionId)
      // Eliminamos el eq("estado", "finalizado") para la copa, para mostrar partidos pendientes
      // Para la liga lo filtramos luego
      .order("fecha", { ascending: true }),
    fetchTeamsForCompetition(categoria, competicionId),
    supabase.from("temporadas").select("id").eq("activa", true).maybeSingle(),
    supabase.from("jornadas").select("*").eq("competicion_id", competicionId).order("numero", { ascending: true })
  ]);

  const formato = compData?.formato || "liga";

  // Si es COPA (eliminatoria), devolvemos las rondas
  if (formato === "eliminatoria") {
    const treeRounds = (jornadasData || []).map((j: any) => {
      const matches = (partidosData || []).filter((p: any) => p.jornada_id === j.id);
      return {
        id: j.id,
        numero: j.numero,
        nombre: j.nombre_fase || `Ronda ${j.numero}`,
        partidos: matches,
      };
    });
    return { formato, equipos: treeRounds, reglas: [] };
  }

  // Si es LIGA, computamos partidos con resultado aunque el estado venga sin actualizar.
  const partidosFinalizados = (partidosData || []).filter(isCompletedMatch);

  let fetchedRules: any[] = [];
  if (activeSeason?.id) {
    const { data: rulesRow } = await supabase
      .from("reglas_liga")
      .select("reglas")
      .eq("temporada_id", activeSeason.id)
      .eq("categoria", categoria)
      .eq("competicion_id", competicionId)
      .maybeSingle();

    if (rulesRow?.reglas && Array.isArray(rulesRow.reglas)) {
      fetchedRules = rulesRow.reglas;
    }
  }

  const matchTeamIds = (partidosData || []).flatMap((p: any) => [
    p.equipo_local_id,
    p.equipo_visitante_id,
  ]);
  const teamsData = await mergeMissingTeams(baseTeams, matchTeamIds);

  if (!teamsData || teamsData.length === 0) return { formato, equipos: [], reglas: fetchedRules };

  const withStats = teamsData.map((team: any) => {
    const teamMatches = (partidosFinalizados || []).filter((p: any) =>
      p.equipo_local_id === team.id || p.equipo_visitante_id === team.id
    );

    const pj = teamMatches.length;
    let pg = 0, pe = 0, pp = 0, gf = 0, gc = 0;

    teamMatches.forEach((p: any) => {
      const isLocal = p.equipo_local_id === team.id;
      const favor = isLocal ? (p.goles_local || 0) : (p.goles_visitante || 0);
      const contra = isLocal ? (p.goles_visitante || 0) : (p.goles_local || 0);
      gf += favor;
      gc += contra;
      if (favor > contra) pg += 1;
      else if (favor === contra) pe += 1;
      else pp += 1;
    });

    return {
      equipo_id: team.id,
      nombre: team.nombre,
      escudo_url: team.escudo_url,
      pj, pg, pe, pp, gf, gc,
      pts: pg * 3 + pe,
    };
  });

  const sorted = [...withStats].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;

    if (partidosFinalizados.length > 0) {
      const directMatches = partidosFinalizados.filter((p: any) => 
        (p.equipo_local_id === a.equipo_id && p.equipo_visitante_id === b.equipo_id) ||
        (p.equipo_local_id === b.equipo_id && p.equipo_visitante_id === a.equipo_id)
      );
      
      if (directMatches.length > 0) {
        let ptsA = 0, ptsB = 0, gfA = 0, gfB = 0;
        directMatches.forEach((p: any) => {
          const aIsLocal = p.equipo_local_id === a.equipo_id;
          const gA = aIsLocal ? p.goles_local : p.goles_visitante;
          const gB = aIsLocal ? p.goles_visitante : p.goles_local;
          
          if (gA > gB) ptsA += 3;
          else if (gB > gA) ptsB += 3;
          else { ptsA += 1; ptsB += 1; }
          
          gfA += gA; gfB += gB;
        });
        
        if (ptsA !== ptsB) return ptsB - ptsA;
        if (gfA - gfB !== 0) return (gfB - gfA);
      }
    }

    const diffA = a.gf - a.gc;
    const diffB = b.gf - b.gc;
    if (diffB !== diffA) return diffB - diffA;
    return b.gf - a.gf;
  });

  return { formato, equipos: sorted, reglas: fetchedRules };
}
