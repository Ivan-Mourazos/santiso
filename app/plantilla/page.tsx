"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

interface Jugador {
  id: string;
  nombre: string;
  apodo: string | null;
  dorsal: number;
  posicion: string;
  capitan: number;
  foto_url: string | null;
  categoria: string;
  fecha_nacimiento?: string | null;
  lugar_nacimiento?: string | null;
  altura_cm?: number | null;
  peso_kg?: number | null;
  pierna_dominante?: string | null;
  club_anterior?: string | null;
  temporada_alta?: string | null;
  historial_deportivo?: string[] | null;
  bio_deportiva?: string | null;
}

interface Staff {
  id: string;
  nombre: string;
  cargo: string;
  tipo: string;
  categoria: string | null;
  foto_url: string | null;
}

interface PlayerCardStats {
  convocado: number;
  titular: number;
  pj: number;
  goles: number;
  golesEncajados: number;
  porteriasCero: number;
  puntosConJugador: number;
  partidosTotalesCategoria: number;
}

interface Temporada {
  id: string;
  nombre: string;
}

type CardPerson = Jugador | Staff;

function isStaffMember(person: CardPerson): person is Staff {
  return "tipo" in person;
}

function isGoalkeeper(player: Jugador) {
  return player.posicion === "POR";
}

function emptyPlayerStats() {
  return {
    convocado: 0,
    titular: 0,
    suplente: 0,
    pj: 0,
    goles: 0,
    minutos: 0,
    golesEncajados: 0,
    porteriasCero: 0,
  };
}
type DetailPlayerStats = ReturnType<typeof emptyPlayerStats>;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function parseSeasonStartYear(season?: string | null) {
  if (!season) return null;
  const match = season.match(/(\d{4})/);
  return match ? Number(match[1]) : null;
}

function calculateAge(birthDate?: string | null) {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

function calculateYearsInClub(seasonStart?: string | null) {
  const startYear = parseSeasonStartYear(seasonStart);
  if (!startYear) return null;
  const nowYear = new Date().getFullYear();
  return Math.max(1, nowYear - startYear + 1);
}

function computeMatchPoints(
  match: {
    equipo_local_id?: string | null;
    goles_local?: number | null;
    goles_visitante?: number | null;
  },
  santisoIds: string[],
) {
  const santisoLocal = santisoIds.includes(match.equipo_local_id || "");
  const gf = santisoLocal
    ? Number(match.goles_local ?? 0)
    : Number(match.goles_visitante ?? 0);
  const gc = santisoLocal
    ? Number(match.goles_visitante ?? 0)
    : Number(match.goles_local ?? 0);
  if (gf > gc) return 3;
  if (gf === gc) return 1;
  return 0;
}

function calculateCardRating(player: Jugador, stats?: PlayerCardStats | null) {
  const capitanBonus = player.capitan ? 2 : 0;
  const played = stats?.pj || 0;
  const totalMatches = stats?.partidosTotalesCategoria || 0;
  const commitment = totalMatches > 0 ? played / totalMatches : 0;
  const pointsRate = played > 0 ? (stats?.puntosConJugador || 0) / (played * 3) : 0;

  if (isGoalkeeper(player)) {
    const cleanRate = played > 0 ? (stats?.porteriasCero || 0) / played : 0;
    const concededRate = played > 0 ? (stats?.golesEncajados || 0) / played : 0;
    const concededControl = 1 - clamp(concededRate / 2.5, 0, 1);
    const performance =
      cleanRate * 0.45 + pointsRate * 0.35 + concededControl * 0.2;
    return Math.max(
      45,
      Math.min(
        99,
        Math.round(
          45 +
            commitment * 35 +
            performance * 18 +
            capitanBonus,
        ),
      ),
    );
  }

  const goalRate = played > 0 ? (stats?.goles || 0) / played : 0;
  const goalImpact = clamp(goalRate / 1.2, 0, 1);
  const starterRate = played > 0 ? (stats?.titular || 0) / played : 0;
  const performance = goalImpact * 0.45 + pointsRate * 0.35 + starterRate * 0.2;
  return Math.min(
    99,
    Math.round(
      45 +
        commitment * 35 +
        performance * 18 +
        capitanBonus,
    ),
  );
}

function formatCareerTimeline(player: Jugador) {
  if (player.historial_deportivo?.length) return player.historial_deportivo;
  const items: string[] = [];
  if (player.temporada_alta) {
    items.push(`Llegada al Santiso: ${player.temporada_alta}`);
  }
  if (player.club_anterior) {
    items.push(`Club anterior: ${player.club_anterior}`);
  }
  return items;
}

function formatExtraLabel(player: Jugador) {
  if (isGoalkeeper(player)) return "PORTERÍA";
  return "RENDIMIENTO";
}

function formatMainMetric(player: Jugador, stats?: PlayerCardStats | null) {
  if (isGoalkeeper(player)) return stats?.porteriasCero || 0;
  return stats?.goles || 0;
}

function formatMainMetricLabel(player: Jugador) {
  if (isGoalkeeper(player)) return "PC";
  return "GOL";
}

function formatSecondaryMetric(player: Jugador, stats?: PlayerCardStats | null) {
  if (isGoalkeeper(player)) return stats?.golesEncajados || 0;
  return stats?.titular || 0;
}

function formatSecondaryMetricLabel(player: Jugador) {
  if (isGoalkeeper(player)) return "GC";
  return "TIT";
}

function buildCardStatsDefault(totalMatches: number): PlayerCardStats {
  return {
    convocado: 0,
    titular: 0,
    pj: 0,
    goles: 0,
    golesEncajados: 0,
    porteriasCero: 0,
    puntosConJugador: 0,
    partidosTotalesCategoria: totalMatches,
  };
}

type CardStatRow = {
  jugador_id: string;
  titular: boolean | null;
  jugo: boolean | null;
  goles: number | null;
  partidos_liga: {
    equipo_local_id?: string | null;
    equipo_visitante_id?: string | null;
    goles_local?: number | null;
    goles_visitante?: number | null;
    estado?: string | null;
    categoria?: string | null;
  } | null;
};

type TeamMatchRow = {
  id: string;
  categoria?: string | null;
  equipo_local_id?: string | null;
  goles_local?: number | null;
  goles_visitante?: number | null;
};

function getInitialCardStatsByPlayer(
  players: Jugador[],
  totalsByCategory: Map<string, number>,
) {
  return new Map(
    players.map((player) => [
      player.id,
      buildCardStatsDefault(totalsByCategory.get(player.categoria) || 0),
    ]),
  );
}

function getPlayerCategoryTotals(
  teamMatches: TeamMatchRow[],
  players: Jugador[],
) {
  const categories = new Set(players.map((player) => player.categoria));
  const totals = new Map<string, number>();
  for (const match of teamMatches) {
    const category = match.categoria || "";
    if (!category || !categories.has(category)) continue;
    totals.set(category, (totals.get(category) || 0) + 1);
  }
  return totals;
}

function updateGoalkeeperStats(
  current: PlayerCardStats,
  row: CardStatRow,
  santisoIds: string[],
) {
  const match = row.partidos_liga;
  if (!match) return;
  const santisoLocal = santisoIds.includes(match.equipo_local_id || "");
  const conceded = santisoLocal
    ? Number(match.goles_visitante ?? 0)
    : Number(match.goles_local ?? 0);
  current.golesEncajados += conceded;
  if (match.estado === "finalizado" && conceded === 0) {
    current.porteriasCero += 1;
  }
}

function applyCardStatRow(
  current: PlayerCardStats,
  row: CardStatRow,
  isKeeper: boolean,
  santisoIds: string[],
) {
  const played = Boolean(row.jugo || row.titular);
  current.convocado += 1;
  if (row.titular) current.titular += 1;
  if (!played) return;

  current.pj += 1;
  current.goles += Number(row.goles || 0);
  if (row.partidos_liga) {
    current.puntosConJugador += computeMatchPoints(row.partidos_liga, santisoIds);
  }
  if (isKeeper) {
    updateGoalkeeperStats(current, row, santisoIds);
  }
}

function toCardStatsRecord(
  statsByPlayer: Map<string, PlayerCardStats>,
) {
  return Object.fromEntries(statsByPlayer.entries());
}

function getCareerYearsLabel(player: Jugador) {
  const years = calculateYearsInClub(player.temporada_alta);
  if (!years) return "Pendiente";
  return `${years} ${years === 1 ? "año" : "años"}`;
}

function getAgeLabel(player: Jugador) {
  const age = calculateAge(player.fecha_nacimiento);
  if (!age) return "Pendiente";
  return `${age} años`;
}

function getEntrySeasonLabel(player: Jugador) {
  return player.temporada_alta || "Pendiente";
}

function getPointsWithPlayer(stats?: PlayerCardStats | null) {
  return stats?.puntosConJugador || 0;
}

function getTeamMatchesByCategory(stats?: PlayerCardStats | null) {
  return stats?.partidosTotalesCategoria || 0;
}

function getCommitmentPercent(stats?: PlayerCardStats | null) {
  const total = stats?.partidosTotalesCategoria || 0;
  if (total === 0) return 0;
  return Math.round(((stats?.pj || 0) / total) * 100);
}

function getPointsRate(stats?: PlayerCardStats | null) {
  const played = stats?.pj || 0;
  if (played === 0) return 0;
  return ((stats?.puntosConJugador || 0) / played).toFixed(2);
}

function getMainMetricFromStats(player: Jugador, stats?: PlayerCardStats | null) {
  return formatMainMetric(player, stats);
}

function getSecondaryMetricFromStats(
  player: Jugador,
  stats?: PlayerCardStats | null,
) {
  return formatSecondaryMetric(player, stats);
}

function getMainMetricLabelFromPlayer(player: Jugador) {
  return formatMainMetricLabel(player);
}

function getSecondaryMetricLabelFromPlayer(player: Jugador) {
  return formatSecondaryMetricLabel(player);
}

function getPerformanceZoneLabel(player: Jugador) {
  return formatExtraLabel(player);
}

function getAverageGoalsAgainstPerMatch(player: Jugador, stats: DetailPlayerStats) {
  if (!isGoalkeeper(player)) return 0;
  return (stats.golesEncajados / (stats.pj || 1)).toFixed(2);
}

function getAverageGoalsPerMatch(player: Jugador, stats: DetailPlayerStats) {
  if (isGoalkeeper(player)) return "0";
  return (stats.goles / (stats.pj || 1)).toFixed(2);
}

function getPointsRateDetail(stats?: PlayerCardStats | null) {
  const played = stats?.pj || 0;
  if (played === 0) return "0.00";
  return ((stats?.puntosConJugador || 0) / played).toFixed(2);
}

function getReversoHistory(player: Jugador) {
  const items = formatCareerTimeline(player);
  if (items.length > 0) return items;
  return ["Sin etapas registradas todavía."];
}

function getPlayerCardRating(player: Jugador, stats?: PlayerCardStats | null) {
  return calculateCardRating(player, stats);
}

function getCategoryMatchesLabel(stats?: PlayerCardStats | null) {
  return `${getTeamMatchesByCategory(stats)} partidos de categoría`;
}

function getCommitmentLabel(stats?: PlayerCardStats | null) {
  return `${getCommitmentPercent(stats)}% compromiso`;
}

function getPerformanceLabel(stats?: PlayerCardStats | null) {
  return `${getPointsRate(stats)} pts/jugado`;
}

function getCardLegendKey(player: Jugador) {
  return isGoalkeeper(player) ? "Portero" : "Jugador de campo";
}

function getPlayerDetailSubtitle(player: Jugador) {
  return `${player.posicion} · ${getAgeLabel(player)} · ${getCareerYearsLabel(player)}`;
}

function getLegendTextForGoalkeeper() {
  return "Media = 45 + compromiso temporada + rendimiento en portería y puntos del equipo.";
}

function getLegendTextForOutfield() {
  return "Media = 45 + compromiso temporada + impacto ofensivo + puntos por partido jugado.";
}

function getLegendTextByPlayer(player: Jugador) {
  return isGoalkeeper(player)
    ? getLegendTextForGoalkeeper()
    : getLegendTextForOutfield();
}

function calculateVeteraniaFromHistorial(player: Jugador): string {
  const h = player.historial_deportivo;
  if (!h || h.length === 0) return "Sin registrar";
  // Extract individual season codes (e.g. 2022/23) from each entry
  const seasonRegex = /(\d{4}\/(\d{2}))/g;
  const allSeasons = new Set<string>();
  for (const entry of h) {
    // Handle ranges like "2019/20 - 2021/22"
    const rangeMatch = entry.match(/(\d{4})\/(\d{2})\s*[-–]\s*(\d{4})\/(\d{2})/);
    if (rangeMatch) {
      const startYear = parseInt(rangeMatch[1]);
      const endYear = parseInt(rangeMatch[3]);
      for (let y = startYear; y <= endYear; y++) {
        allSeasons.add(`${y}/${String(y + 1).slice(-2)}`);
      }
    } else {
      const matches = entry.matchAll(seasonRegex);
      for (const m of matches) allSeasons.add(m[1]);
    }
  }
  const count = allSeasons.size || h.length;
  return `${count} ${count === 1 ? "temporada" : "temporadas"}`;
}

function getPlayerInfoRows(player: Jugador) {
  return [
    { label: "Posición", value: player.posicion },
    { label: "Edad", value: getAgeLabel(player) },
    { label: "Veteranía", value: calculateVeteraniaFromHistorial(player) },
  ];
}

function getPerformanceRows(player: Jugador, stats?: PlayerCardStats | null) {
  return [
    { label: "Compromiso", value: getCommitmentLabel(stats) },
    { label: "Partidos de categoría", value: getCategoryMatchesLabel(stats) },
    { label: "Puntos con jugador", value: `${getPointsWithPlayer(stats)} pts` },
    { label: "Puntos por partido", value: getPerformanceLabel(stats) },
    {
      label: getMainMetricLabelFromPlayer(player),
      value: String(getMainMetricFromStats(player, stats)),
    },
    {
      label: getSecondaryMetricLabelFromPlayer(player),
      value: String(getSecondaryMetricFromStats(player, stats)),
    },
  ];
}

function getPlayerCareerBio(player: Jugador) {
  return formatPlayerBio(player);
}

function getLegendHeader(player: Jugador) {
  return `Criterio ${getCardLegendKey(player)}`;
}

function getGoalkeeperExtraStatLabel(player: Jugador) {
  return isGoalkeeper(player) ? "GC / PJ" : "Media";
}

function getGoalkeeperExtraStatValue(player: Jugador, stats: DetailPlayerStats) {
  return isGoalkeeper(player)
    ? getAverageGoalsAgainstPerMatch(player, stats)
    : getAverageGoalsPerMatch(player, stats);
}

function getDetailPerformanceBlockTitle(player: Jugador) {
  return isGoalkeeper(player) ? "Portería" : "Rendimiento Goleador";
}

function getReversoLegend(player: Jugador) {
  return getLegendTextByPlayer(player);
}

function getCardMetricZone(player: Jugador) {
  return getPerformanceZoneLabel(player);
}

function getCardRatingValue(player: Jugador, stats?: PlayerCardStats | null) {
  return getPlayerCardRating(player, stats);
}

function getPlayerDetailTitle(player: Jugador) {
  return player.nombre;
}

function getPlayerNickname(player: Jugador) {
  return player.apodo || "Sin apodo";
}

function getPlayerMainLabel(player: Jugador) {
  return getDetailPerformanceBlockTitle(player);
}

function getPlayerMainAverage(player: Jugador, stats: DetailPlayerStats) {
  return getGoalkeeperExtraStatValue(player, stats);
}

function getPlayerMainAverageLabel(player: Jugador) {
  return getGoalkeeperExtraStatLabel(player);
}

function getGoalkeeperBlockVisible(player: Jugador) {
  return isGoalkeeper(player);
}

function getPlayerExtraInfoLegend(player: Jugador) {
  return getReversoLegend(player);
}

function buildPlayerCardLegend(player: Jugador) {
  return getPlayerExtraInfoLegend(player);
}

function getPlayerStatsRows(player: Jugador, stats?: PlayerCardStats | null) {
  return getPerformanceRows(player, stats);
}

function getPlayerBio(player: Jugador) {
  return getPlayerCareerBio(player);
}

function getPlayerCareerRows(player: Jugador) {
  return getReversoHistory(player);
}

function getCardDisplayZone(player: Jugador) {
  return getCardMetricZone(player);
}

function getPlayerHeaderDetail(player: Jugador) {
  return getPlayerDetailSubtitle(player);
}

function getPlayerInfoTable(player: Jugador) {
  return getPlayerInfoRows(player);
}

function getPlayerScore(player: Jugador, stats?: PlayerCardStats | null) {
  return getCardRatingValue(player, stats);
}

function getLegendLine(player: Jugador) {
  return buildPlayerCardLegend(player);
}

function formatPlayerBio(player: Jugador) {
  return player.bio_deportiva?.trim() || "Historial pendiente de completar.";
}

export default function PlantillaPage() {
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [categoriaActiva, setCategoriaActiva] = useState("Senior");
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<Jugador | null>(null);
  const [temporadaActiva, setTemporadaActiva] = useState<Temporada | null>(null);
  const [santisoTeamIds, setSantisoTeamIds] = useState<string[]>([]);
  const [cardStats, setCardStats] = useState<Record<string, PlayerCardStats>>({});
  const [faseActiva, setFaseActiva] = useState("Total");
  const [fasesDisponibles, setFasesDisponibles] = useState<string[]>([]);
  const [playerStats, setPlayerStats] = useState({ ...emptyPlayerStats() });

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const { data: temp } = await supabase
        .from("temporadas")
        .select("*")
        .eq("activa", true)
        .single();
      if (temp) setTemporadaActiva(temp);

      const { data: pData } = await supabase
        .from("jugadores")
        .select("*")
        .order("dorsal", { ascending: true });
      if (pData) setJugadores(pData);

      const { data: sData } = await supabase.from("staff_club").select("*");
      if (sData) setStaff(sData);

      const { data: santisoTeams } = await supabase
        .from("equipos")
        .select("id")
        .ilike("nombre", "%santiso%");
      const santisoIds = (santisoTeams || []).map((team: { id: string }) => team.id);
      setSantisoTeamIds(santisoIds);
      if (temp && pData) {
        await loadCardStats(temp.id, pData as Jugador[], santisoIds);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  async function loadCardStats(
    temporadaId: string,
    players: Jugador[],
    santisoIds: string[],
  ) {
    const { data: jornadas } = await supabase
      .from("jornadas")
      .select("id")
      .eq("temporada_id", temporadaId);
    const jornadaIds = jornadas?.map((j: any) => j.id) || [];
    const playerIds = players.map((player) => player.id);
    if (jornadaIds.length === 0 || playerIds.length === 0) {
      setCardStats({});
      return;
    }

    const { data: stats } = await supabase
      .from("jugador_partido_stats")
      .select(
        "jugador_id, titular, jugo, goles, partidos_liga!inner(jornada_id,equipo_local_id,equipo_visitante_id,goles_local,goles_visitante,estado)",
      )
      .in("jugador_id", playerIds)
      .in("partidos_liga.jornada_id", jornadaIds);

    const playersById = new Map(players.map((player) => [player.id, player]));
    const statRows = (stats || []) as CardStatRow[];

    const { data: teamMatchesRaw } = await supabase
      .from("partidos_liga")
      .select("id,categoria,equipo_local_id,goles_local,goles_visitante")
      .in("jornada_id", jornadaIds)
      .eq("estado", "finalizado")
      .or(
        santisoIds
          .flatMap((id: string) => [`equipo_local_id.eq.${id}`, `equipo_visitante_id.eq.${id}`])
          .join(","),
      );
    const teamMatches = (teamMatchesRaw || []) as TeamMatchRow[];
    const totalsByCategory = getPlayerCategoryTotals(teamMatches, players);
    const statsByPlayer = getInitialCardStatsByPlayer(players, totalsByCategory);

    for (const row of statRows) {
      const jugadorId = row.jugador_id;
      const current = statsByPlayer.get(jugadorId);
      const player = playersById.get(jugadorId);
      if (!player || !current) continue;
      applyCardStatRow(current, row, isGoalkeeper(player), santisoIds);
      statsByPlayer.set(jugadorId, current);
    }
    setCardStats(toCardStatsRecord(statsByPlayer));
  }

  useEffect(() => {
    const player = selectedPlayer;
    const temporada = temporadaActiva;
    if (!player || !temporada) return;

    async function getFases(categoria: string, temporadaId: string) {
      const { data: jData } = await supabase
        .from("jornadas")
        .select("competicion")
        .eq("temporada_id", temporadaId)
        .eq("categoria", categoria);

      if (jData) {
        const unicas = Array.from(
          new Set(jData.map((j: any) => String(j.competicion || "Liga"))),
        ) as string[];
        setFasesDisponibles(unicas);
      }
    }
    void getFases(player.categoria, temporada.id);
  }, [selectedPlayer, temporadaActiva]);

  useEffect(() => {
    const player = selectedPlayer;
    const temporada = temporadaActiva;
    if (!player || !temporada) return;

    async function loadDetailedStats(
      p: Jugador,
      temporadaId: string,
      fase: string,
    ) {
      let query = supabase
        .from("jornadas")
        .select("id")
        .eq("temporada_id", temporadaId)
        .eq("categoria", p.categoria);

      if (fase !== "Total") {
        query = query.eq("competicion", fase);
      }

      const { data: jornadas } = await query;
      const jornadaIds = jornadas?.map((j: any) => j.id) || [];
      if (jornadaIds.length === 0) {
        setPlayerStats(emptyPlayerStats());
        return;
      }

      const { data: stats } = await supabase
        .from("jugador_partido_stats")
        .select("*, partidos_liga!inner(*)")
        .eq("jugador_id", p.id)
        .in("partidos_liga.jornada_id", jornadaIds);

      if (stats) {
        let totalMin = 0;
        let totalGoles = 0;
        let totalEncajados = 0;
        let porteriasCero = 0;
        const conv = stats.length;
        let tit = 0;
        let sup = 0;
        let pj = 0;

        stats.forEach((s: any) => {
          const isTitular = s.titular;
          const played = s.jugo || s.titular;
          if (played) pj++;
          if (isTitular) tit++;
          else if (played) sup++;
          totalGoles += s.goles || 0;

          if (p.posicion === "POR" && played) {
            const pl = s.partidos_liga;
            const encajados = santisoTeamIds.includes(pl.equipo_local_id)
              ? Number(pl.goles_visitante ?? 0)
              : Number(pl.goles_local ?? 0);
            totalEncajados += encajados;
            if (pl.estado === "finalizado" && encajados === 0) porteriasCero++;
          }
          if (played) totalMin += isTitular ? 90 : 25;
        });

        setPlayerStats({
          convocado: conv,
          titular: tit,
          suplente: sup,
          pj: pj,
          goles: totalGoles,
          minutos: totalMin,
          golesEncajados: totalEncajados,
          porteriasCero,
        });
      }
    }
    void loadDetailedStats(player, temporada.id, faseActiva);
  }, [selectedPlayer, temporadaActiva, faseActiva, santisoTeamIds]);

  const jugadoresFiltrados = jugadores.filter(
    (j) => j.categoria === categoriaActiva,
  );
  const staffFiltrado = staff.filter(
    (s) =>
      s.tipo === "Tecnico" &&
      s.categoria?.toLowerCase() === categoriaActiva.toLowerCase(),
  );
  const directiva = staff.filter((s) => s.tipo === "Directiva");

  const Porteros = jugadoresFiltrados.filter((j) => j.posicion === "POR");
  const Defensas = jugadoresFiltrados.filter((j) =>
    ["DFC", "LD", "LI"].includes(j.posicion),
  );
  const Medios = jugadoresFiltrados.filter((j) =>
    ["MC", "MCD", "MCO", "MI", "MD"].includes(j.posicion),
  );
  const Delanteros = jugadoresFiltrados.filter((j) =>
    ["DC", "ED", "EI"].includes(j.posicion),
  );

  const renderFifaCard = (j: CardPerson, isSmall = true) => {
    const isStaff = isStaffMember(j);
    const name = isStaff ? j.nombre : j.nombre.split(" ").slice(0, 2).join(" ");
    const stats = !isStaff ? cardStats[j.id] : null;
    const rating = !isStaff ? getPlayerScore(j, stats) : null;
    const goalkeeper = !isStaff && isGoalkeeper(j);

    return (
      <div
        key={j.id}
        className={`fifa-card-container ${isSmall && !isStaff ? "clickable" : "no-scale"}`}
        onClick={isSmall && !isStaff ? () => setSelectedPlayer(j) : undefined}
      >
        <div className={`fifa-card premium-card ${categoriaActiva.toLowerCase()}`}>
          <div className="fifa-shine" />
          {!isStaff && (
            <div className="fifa-meta">
              <span className="fifa-dorsal">{rating}</span>
              <span className="fifa-pos">{j.posicion}</span>
              {(j.capitan ?? 0) > 0 && (
                <span className="fifa-capitan-indicator" title={`Capitán ${j.capitan}`}>C</span>
              )}
            </div>
          )}
          {!isStaff && <div className="fifa-shirt-badge">#{j.dorsal}</div>}
          <div className="fifa-img-box">
            {j.foto_url ? (
              <Image
                src={j.foto_url}
                alt={j.nombre}
                className="fifa-player-img"
                width={230}
                height={214}
              />
            ) : (
              <div className="fifa-placeholder">
                <svg
                  width="60"
                  height="60"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            )}
          </div>
          <div className="fifa-info">
            <h4
              className="fifa-name"
              style={{
                fontSize: name.length > 15 ? "1.1rem" : "1.4rem",
                lineHeight: 1.1,
                marginBottom: "0.1rem",
              }}
            >
              {name}
            </h4>
            {!isStaff && j.apodo && (
              <p
                className="fifa-nickname"
                style={{ fontSize: "1rem", marginTop: "-0.2rem" }}
              >
                {j.apodo}
              </p>
            )}
            {!isStaff && (
              <div className="fifa-stats-strip">
                <span>
                  <strong>{stats?.pj || 0}</strong>
                  PJ
                </span>
                {goalkeeper ? (
                  <span>
                    <strong>{getMainMetricFromStats(j, stats)}</strong>
                    GC
                  </span>
                ) : (
                  <span>
                    <strong>{getMainMetricFromStats(j, stats)}</strong>
                    GOL
                  </span>
                )}
                <span>
                  <strong>
                    {getSecondaryMetricFromStats(j, stats)}
                  </strong>
                  {goalkeeper ? "PC" : "TIT"}
                </span>
              </div>
            )}
            {isStaff && (
              <p
                className="fifa-nickname"
                style={{
                  fontSize: "0.8rem",
                  opacity: 0.8,
                  color: "var(--primary)",
                  marginTop: "-0.2rem",
                }}
              >
                {j.cargo}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSection = (titulo: string, lista: CardPerson[]) => {
    if (lista.length === 0) return null;
    return (
      <div className="pos-section">
        <h3 className="pos-title">{titulo}</h3>
        <div className="grid-pro">{lista.map((j) => renderFifaCard(j))}</div>
      </div>
    );
  };

  return (
    <main className="plantilla-page-v2">
      <div className="container">
        <div className="page-header">
          <h1 className="main-title">
            Nuestra <span className="text-primary">Plantilla</span>
          </h1>
          <p className="page-subtitle">
            Temporada {temporadaActiva?.nombre || "25/26"} - Unión Deportiva
            Santiso
          </p>
        </div>

        <div className="cat-selector">
          {["Senior", "Femenino", "Veteranos", "Directiva"].map((cat) => (
            <button
              key={cat}
              className={`cat-btn ${categoriaActiva === cat ? "active" : ""}`}
              onClick={() => setCategoriaActiva(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="rating-legend glass">
          <div>
            <p className="rating-legend__tag">Media do cromo</p>
            <h2>Cómo se calcula la puntuación</h2>
          </div>
          <div className="rating-legend__grid">
            <div>
              <strong>Jugadores de campo</strong>
              <span>Media basada en compromiso da tempada + impacto ofensivo + puntos por partido jugado.</span>
            </div>
            <div>
              <strong>Porteros</strong>
              <span>Media basada en compromiso da tempada + porterías a cero + puntos del equipo, penalizando GC/PJ.</span>
            </div>
            <div>
              <strong>Proporción por fases</strong>
              <span>Compromiso = partidos jugados / partidos totais da categoría. Así, Copa e Liga pesan según volumen real.</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Preparando los cromos...</div>
        ) : (
          <div className="squad-content">
            {categoriaActiva === "Directiva" ? (
              renderSection("Junta Directiva", directiva)
            ) : (
              <>
                {renderSection("Porteros", Porteros)}
                {renderSection("Defensas", Defensas)}
                {renderSection("Centrocampistas", Medios)}
                {renderSection("Delanteros", Delanteros)}

                {/* STAFF */}
                {renderSection("Cuerpo Técnico", staffFiltrado)}
              </>
            )}
          </div>
        )}
      </div>

      {/* MODAL DETALLE JUGADOR */}
      {selectedPlayer && (
        <div className="modal-overlay" onClick={() => setSelectedPlayer(null)}>
          <div
            className="player-detail-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close-detail"
              onClick={() => setSelectedPlayer(null)}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            <div className="detail-left">
              {renderFifaCard(selectedPlayer, false)}
              <div
                className="player-meta-badges"
                style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}
              >
                <span className="badge-premium">
                  {selectedPlayer.categoria}
                </span>
                <span
                  className="badge-premium"
                  style={{
                    borderColor: "var(--primary)",
                    color: "var(--primary)",
                  }}
                >
                  SANTISO
                </span>
              </div>
            </div>

            <div className="detail-right">
              {/* HEADER */}
              <div className="detail-header">
                <div>
                  <h2 className="detail-name">{getPlayerDetailTitle(selectedPlayer)}</h2>
                  <p className="detail-nickname">{selectedPlayer.apodo || selectedPlayer.posicion}</p>
                  <p className="detail-micro-subtitle">
                    {[
                      selectedPlayer.posicion,
                      selectedPlayer.fecha_nacimiento ? `${calculateAge(selectedPlayer.fecha_nacimiento)} años` : null,
                      selectedPlayer.temporada_alta ? `${calculateYearsInClub(selectedPlayer.temporada_alta)} en el club` : null,
                    ].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {["Total", ...fasesDisponibles].length > 2 && (
                  <div className="fase-pill-selector">
                    {["Total", ...fasesDisponibles].map((f) => (
                      <button
                        key={f}
                        className={`fase-pill ${faseActiva === f ? "active" : ""}`}
                        onClick={() => setFaseActiva(f)}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* STATS PRINCIPALES */}
              <div className="stats-hero">
                <div className="stat-hero-item">
                  <span className="stat-hero-value">{playerStats.pj}</span>
                  <span className="stat-hero-label">Partidos jugados</span>
                </div>
                <div className="stat-hero-item">
                  <span className="stat-hero-value">{playerStats.titular}</span>
                  <span className="stat-hero-label">De titular</span>
                </div>
                <div className="stat-hero-item">
                  <span className="stat-hero-value">{playerStats.suplente}</span>
                  <span className="stat-hero-label">De suplente</span>
                </div>
                {isGoalkeeper(selectedPlayer) ? (
                  <>
                    <div className="stat-hero-item accent">
                      <span className="stat-hero-value">{playerStats.porteriasCero}</span>
                      <span className="stat-hero-label">P. a cero</span>
                    </div>
                    <div className="stat-hero-item">
                      <span className="stat-hero-value">{playerStats.golesEncajados}</span>
                      <span className="stat-hero-label">G. encajados</span>
                    </div>
                  </>
                ) : (
                  <div className="stat-hero-item accent">
                    <span className="stat-hero-value">{playerStats.goles}</span>
                    <span className="stat-hero-label">Goles</span>
                  </div>
                )}
              </div>

              {/* BLOQUE RENDIMIENTO */}
              <div className="stats-secondary-grid">
                <div className="stats-block">
                  <p className="block-title">Rendimiento ({faseActiva})</p>
                  <div className="mini-box-grid">
                    <div className="mini-box">
                      <span>{getPointsWithPlayer(cardStats[selectedPlayer.id])}</span>
                      <label>Puntos totales</label>
                    </div>
                    <div className="mini-box">
                      <span>{getPointsRateDetail(cardStats[selectedPlayer.id])}</span>
                      <label>Pts / partido</label>
                    </div>
                    <div className="mini-box">
                      <span>{getCommitmentPercent(cardStats[selectedPlayer.id])}%</span>
                      <label>Compromiso</label>
                    </div>
                    <div className="mini-box">
                      <span>{playerStats.minutos}'</span>
                      <label>Minutos totales</label>
                    </div>
                    <div className="mini-box">
                      <span>{(playerStats.minutos / (playerStats.pj || 1)).toFixed(0)}'</span>
                      <label>Min / partido</label>
                    </div>
                    {isGoalkeeper(selectedPlayer) && (
                      <div className="mini-box">
                        <span>{getAverageGoalsAgainstPerMatch(selectedPlayer, playerStats)}</span>
                        <label>GC / partido</label>
                      </div>
                    )}
                  </div>
                </div>

                <div className="stats-block">
                  <p className="block-title">Perfil</p>
                  <div className="player-info-list">
                    {getPlayerInfoTable(selectedPlayer).map((row) => (
                      <div key={row.label} className="player-info-row">
                        <span className="info-label">{row.label}</span>
                        <span className="info-value">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* BIO */}
              {(selectedPlayer.bio_deportiva || (getPlayerCareerRows(selectedPlayer).length > 0 && getPlayerCareerRows(selectedPlayer)[0] !== "Sin etapas registradas todavía.")) && (
                <div className="player-bio-block">
                  <p className="block-title">Historia deportiva</p>
                  {selectedPlayer.bio_deportiva && <p className="bio-text">{selectedPlayer.bio_deportiva}</p>}
                  {getPlayerCareerRows(selectedPlayer).length > 0 && (
                    <ul className="career-list">
                      {getPlayerCareerRows(selectedPlayer).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="detail-footer">
                Datos temporada {temporadaActiva?.nombre} · {faseActiva}
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .plantilla-page-v2 {
          padding: 2rem 0 6rem;
          min-height: 100vh;
          background: radial-gradient(circle at top, #1a1a1a 0%, #000 100%);
        }
        .page-header {
          text-align: center;
          margin-bottom: 4rem;
        }
        .main-title {
          font-size: 4rem;
          font-weight: 900;
          line-height: 1;
          margin-bottom: 1rem;
        }
        .page-subtitle {
          color: #666;
          font-size: 1.2rem;
        }

        .cat-selector {
          display: flex;
          gap: 0.5rem;
          padding: 0.5rem;
          border-radius: 1rem;
          margin: 0 auto 2.5rem;
          max-width: fit-content;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .cat-btn {
          padding: 0.8rem 2rem;
          border-radius: 0.7rem;
          border: none;
          background: transparent;
          color: #666;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.3s;
          text-transform: uppercase;
          font-size: 0.8rem;
          letter-spacing: 1px;
        }
        .cat-btn.active {
          background: var(--primary);
          color: black;
          box-shadow: 0 4px 15px rgba(250, 204, 21, 0.2);
        }

        .pos-section {
          margin-bottom: 0rem;
        }
        .pos-title {
          margin-bottom: 0.5rem;
        }
        .loading-state {
          text-align: center;
          padding: 5rem;
          font-size: 1.2rem;
          color: var(--primary);
          font-style: italic;
        }

        .block-title {
          color: #71717a;
          font-weight: 700;
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin-bottom: 0.75rem;
        }

        /* Modal header */
        .detail-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1.5rem;
        }
        .detail-name {
          font-size: 2rem;
          font-weight: 900;
          margin: 0 0 0.2rem;
          line-height: 1.1;
        }
        .detail-nickname {
          color: var(--primary);
          font-size: 1rem;
          font-weight: 700;
          margin: 0 0 0.4rem;
        }
        .detail-micro-subtitle {
          color: #71717a;
          font-size: 0.85rem;
          margin: 0;
        }

        /* Stats hero row */
        .stats-hero {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
          padding: 1.25rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
        }
        .stat-hero-item {
          flex: 1;
          text-align: center;
        }
        .stat-hero-item.accent .stat-hero-value {
          color: var(--primary);
        }
        .stat-hero-value {
          display: block;
          font-size: 2rem;
          font-weight: 900;
          line-height: 1;
          color: #fff;
          margin-bottom: 0.3rem;
        }
        .stat-hero-label {
          display: block;
          font-size: 0.6rem;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: #71717a;
          font-weight: 600;
        }

        /* Secondary stats */
        .stats-secondary-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1.25rem;
        }
        .stats-block {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          padding: 1rem;
        }
        .mini-box-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
        }
        .mini-box {
          background: rgba(0, 0, 0, 0.2);
          padding: 0.6rem 0.5rem;
          border-radius: 8px;
          text-align: center;
        }
        .mini-box span {
          display: block;
          font-size: 1.2rem;
          font-weight: 900;
          color: white;
          line-height: 1;
          margin-bottom: 0.25rem;
        }
        .mini-box label {
          font-size: 0.55rem;
          text-transform: uppercase;
          color: #71717a;
          font-weight: 700;
          letter-spacing: 0.5px;
        }

        /* Player info list */
        .player-info-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .player-info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.4rem 0;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          font-size: 0.8rem;
        }
        .player-info-row:last-child { border-bottom: none; }
        .info-label { color: #71717a; }
        .info-value { font-weight: 700; color: #e4e4e7; }

        /* Bio block */
        .player-bio-block {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          padding: 1rem;
          margin-bottom: 1rem;
        }
        .bio-text {
          font-size: 0.8rem;
          color: #a1a1aa;
          line-height: 1.6;
          margin: 0 0 0.5rem;
        }
        .career-list {
          list-style: none;
          padding: 0;
          margin: 0;
          font-size: 0.8rem;
        }
        .career-list li {
          color: #a1a1aa;
          padding: 0.2rem 0;
        }
        .career-list li::before {
          content: '→ ';
          color: var(--primary);
        }

        /* Detail footer */
        .detail-footer {
          margin-top: auto;
          padding-top: 1rem;
          border-top: 1px solid rgba(255,255,255,0.05);
          font-size: 0.72rem;
          color: #52525b;
        }

        /* Fase pills */
        .fase-pill-selector {
          display: flex;
          gap: 0.4rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .fase-pill {
          padding: 0.3rem 0.7rem;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.1);
          background: transparent;
          color: #71717a;
          font-size: 0.72rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .fase-pill.active {
          background: var(--primary);
          color: #000;
          border-color: var(--primary);
        }

        @media (max-width: 768px) {
          .main-title { font-size: 3rem; }
          .stats-secondary-grid { grid-template-columns: 1fr; }
          .player-detail-card { flex-direction: column; overflow-y: auto; }
          .stats-hero { flex-wrap: wrap; }
        }
      `}</style>
    </main>
  );
}
