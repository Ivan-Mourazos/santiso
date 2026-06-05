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
  amarillas: number;
  rojas: number;
  maxStreak: number;
  currentStreak: number;
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

function getInitials(nombre: string) {
  return nombre
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0] || "")
    .join("")
    .toUpperCase();
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
    puntosConJugador: 0,
    partidosTotalesCategoria: 0,
    maxStreak: 0,
    currentStreak: 0,
    amarillas: 0,
    rojas: 0,
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
  const cardsPenalty = ((stats?.amarillas || 0) * 0.2) + ((stats?.rojas || 0) * 1.0);

  if (played === 0) return 45;

  const pointsRate = (stats?.puntosConJugador || 0) / (played * 3);
  const starterRate = (stats?.titular || 0) / played;
  let performance = 0;

  if (isGoalkeeper(player)) {
    const cleanRate = (stats?.porteriasCero || 0) / played;
    const cleanImpact = clamp(cleanRate / 0.20, 0, 1);
    const concededRate = (stats?.golesEncajados || 0) / played;
    const concededControl = 1 - clamp((concededRate - 1.2) / 2.8, 0, 1);
    performance = cleanImpact * 0.15 + concededControl * 0.25 + pointsRate * 0.50 + starterRate * 0.10;
  } else if (["DFC", "LD", "LI"].includes(player.posicion)) {
    const cleanRate = (stats?.porteriasCero || 0) / played;
    const cleanImpact = clamp(cleanRate / 0.20, 0, 1);
    const concededRate = (stats?.golesEncajados || 0) / played;
    const concededControl = 1 - clamp((concededRate - 1.2) / 2.8, 0, 1);
    performance =
      cleanImpact * 0.15 +
      concededControl * 0.25 +
      pointsRate * 0.40 +
      starterRate * 0.20;
  } else if (["MC", "MCD", "MCO", "MI", "MD"].includes(player.posicion)) {
    const goalRate = (stats?.goles || 0) / played;
    const goalImpact = clamp(goalRate / 0.25, 0, 1);
    const cleanRate = (stats?.porteriasCero || 0) / played;
    const cleanImpact = clamp(cleanRate / 0.20, 0, 1);
    performance =
      pointsRate * 0.45 +
      starterRate * 0.20 +
      goalImpact * 0.20 +
      cleanImpact * 0.15;
  } else {
    const goalRate = (stats?.goles || 0) / played;
    const goalImpact = clamp(goalRate / 1.0, 0, 1);
    performance = goalImpact * 0.50 + pointsRate * 0.30 + starterRate * 0.20;
  }

  const totalMatches = stats?.partidosTotalesCategoria || 1;
  const participationRate = clamp(played / totalMatches, 0, 1);
  const maxStreak = stats?.maxStreak || 0;
  const convocados = stats?.convocado || 0;
  const streakConsistency = convocados > 0 ? maxStreak / convocados : 0;
  const starterFactor = convocados > 0 ? (stats?.titular || 0) / convocados : 0;

  // 50% peso base/participación, 30% consistencia de racha convocado, 20% factor titular
  const commitmentFactor = Math.pow(participationRate, 1.3) * (0.5 + 0.3 * streakConsistency + 0.2 * starterFactor);
  const commitmentBonus = commitmentFactor * 25;
  const performanceBonus = performance * 20;

  const finalRating = Math.round(50 + commitmentBonus + performanceBonus + capitanBonus - cardsPenalty);
  return Math.max(45, Math.min(99, finalRating));
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
    amarillas: 0,
    rojas: 0,
    maxStreak: 0,
    currentStreak: 0,
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
    jornada_id?: string | null;
  } | null;
};

type TeamMatchRow = {
  id: string;
  categoria?: string | null;
  equipo_local_id?: string | null;
  goles_local?: number | null;
  goles_visitante?: number | null;
  jornada_id?: string | null;
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
  // Map lowercase → original category string from jugadores (single source of truth for casing)
  const catNorm = new Map<string, string>();
  for (const p of players) catNorm.set(p.categoria.toLowerCase(), p.categoria);
  const totals = new Map<string, number>();
  for (const match of teamMatches) {
    const matchCat = (match.categoria || "").toLowerCase();
    const playerCat = catNorm.get(matchCat);
    if (!playerCat) continue;
    totals.set(playerCat, (totals.get(playerCat) || 0) + 1);
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
  trackGoalStats: boolean, // true for keepers AND defenders
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
  if (trackGoalStats) updateGoalkeeperStats(current, row, santisoIds);
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
  return "Media = 50 (base) + 25 (compromiso no lineal por % de PJ, racha de convocatorias y titularidades) + 20 (rendimiento: 50% ptos equipo, 25% GC, 15% PC, 10% titular) + 2 (capitán) - tarjetas.";
}

function getLegendTextForOutfield() {
  return "Media = 50 (base) + 25 (compromiso no lineal por % de PJ, racha de convocatorias y titularidades) + 20 (rendimiento: DF 40% ptos/25% GC/15% PC/20% tit; MC 45% ptos/20% tit/20% gol/15% PC; DL 50% gol/30% ptos/20% tit) + 2 (capitán) - tarjetas.";
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
  const [activeTab, setActiveTab] = useState<"rendimiento" | "perfil" | "trayectoria">("rendimiento");

  useEffect(() => {
    if (selectedPlayer) {
      setActiveTab("rendimiento");
    }
  }, [selectedPlayer]);

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
      .select("id, numero")
      .eq("temporada_id", temporadaId);
    const jornadaIds = jornadas?.map((j: any) => j.id) || [];
    const playerIds = players.map((player) => player.id);
    if (jornadaIds.length === 0 || playerIds.length === 0) {
      setCardStats({});
      return;
    }

    const jornadaNumberMap = new Map<string, number>();
    jornadas?.forEach((j: any) => {
      jornadaNumberMap.set(j.id, j.numero || 0);
    });

    // Fetch all player-match rows with pagination to avoid the default 1000-row server limit.
    // Card stats use one big query (all players); without pagination, row limits
    // silently truncate results so some players show wrong stats.
    const PAGE = 1000;
    const allStatRows: CardStatRow[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const { data: page } = await supabase
        .from("jugador_partido_stats")
        .select(
          "jugador_id, titular, jugo, goles, partidos_liga!inner(jornada_id,equipo_local_id,equipo_visitante_id,goles_local,goles_visitante,estado)",
        )
        .in("jugador_id", playerIds)
        .in("partidos_liga.jornada_id", jornadaIds)
        .range(offset, offset + PAGE - 1);
      if (!page || page.length === 0) break;
      allStatRows.push(...(page as CardStatRow[]));
      if (page.length < PAGE) break;
    }

    const playersById = new Map(players.map((player) => [player.id, player]));
    const statRows = allStatRows;

    // Derive Santiso team IDs from match frequency data.
    // Each Santiso player appears once per player-match pair in statRows.
    // Their own team ID accumulates far more hits than any rival
    // (N_players × N_matches vs 1 × N_matches for rivals).
    const teamMatchFreq = new Map<string, number>();
    for (const row of statRows) {
      const m = row.partidos_liga;
      if (!m) continue;
      if (m.equipo_local_id) teamMatchFreq.set(m.equipo_local_id, (teamMatchFreq.get(m.equipo_local_id) || 0) + 1);
      if (m.equipo_visitante_id) teamMatchFreq.set(m.equipo_visitante_id, (teamMatchFreq.get(m.equipo_visitante_id) || 0) + 1);
    }
    const numCats = Math.max(new Set(players.map(p => p.categoria)).size, 1);
    const derivedIds = [...teamMatchFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, numCats)
      .map(([id]) => id);
    const effectiveSantisoIds = [...new Set([...santisoIds, ...derivedIds])];

    if (effectiveSantisoIds.length === 0) {
      setCardStats({});
      return;
    }

    const { data: teamMatchesRaw } = await supabase
      .from("partidos_liga")
      .select("id,categoria,equipo_local_id,goles_local,goles_visitante,jornada_id")
      .in("jornada_id", jornadaIds)
      .eq("estado", "finalizado")
      .or(
        effectiveSantisoIds
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
      const trackGoalStats = isGoalkeeper(player) || ["DFC", "LD", "LI"].includes(player.posicion);
      applyCardStatRow(current, row, trackGoalStats, effectiveSantisoIds);
      statsByPlayer.set(jugadorId, current);
    }

    const playerConvocatedJornadas = new Map<string, Set<string>>();
    for (const row of statRows) {
      if (row.partidos_liga?.jornada_id) {
        if (!playerConvocatedJornadas.has(row.jugador_id)) {
          playerConvocatedJornadas.set(row.jugador_id, new Set());
        }
        playerConvocatedJornadas.get(row.jugador_id)!.add(row.partidos_liga.jornada_id);
      }
    }

    // Build category name normalizer (lowercase → player.categoria casing)
    const catNormMap = new Map<string, string>();
    for (const p of players) catNormMap.set(p.categoria.toLowerCase(), p.categoria);

    const categoryFinishedJornadas = new Map<string, string[]>();
    const matchesByCategory = new Map<string, TeamMatchRow[]>();
    for (const match of teamMatches) {
      const rawCat = match.categoria || "";
      if (!rawCat) continue;
      // Normalize to player-side casing so lookups always match
      const cat = catNormMap.get(rawCat.toLowerCase()) || rawCat;
      if (!matchesByCategory.has(cat)) matchesByCategory.set(cat, []);
      matchesByCategory.get(cat)!.push(match);
    }

    for (const [cat, matches] of matchesByCategory.entries()) {
      const sortedJornadaIds = matches
        .map((m) => ({
          jornadaId: m.jornada_id || "",
          numero: m.jornada_id ? (jornadaNumberMap.get(m.jornada_id) || 0) : 0,
        }))
        .filter((item) => item.jornadaId !== "")
        .sort((a, b) => a.numero - b.numero)
        .map((item) => item.jornadaId);

      categoryFinishedJornadas.set(cat, sortedJornadaIds);
    }

    for (const player of players) {
      const convocatedJornadas = playerConvocatedJornadas.get(player.id) || new Set<string>();
      const finishedJornadas = categoryFinishedJornadas.get(player.categoria) || [];
      
      let maxStreak = 0;
      let currentStreak = 0;
      
      for (const jId of finishedJornadas) {
        if (convocatedJornadas.has(jId)) {
          currentStreak += 1;
          if (currentStreak > maxStreak) {
            maxStreak = currentStreak;
          }
        } else {
          currentStreak = 0;
        }
      }
      
      const currentStats = statsByPlayer.get(player.id);
      if (currentStats) {
        currentStats.maxStreak = maxStreak;
        currentStats.currentStreak = currentStreak;
      }
    }

    const { data: cardsData } = await supabase
      .from("partido_eventos_santiso")
      .select("jugador_id, tipo, partidos_liga!inner(jornada_id)")
      .in("jugador_id", playerIds)
      .in("partidos_liga.jornada_id", jornadaIds)
      .in("tipo", ["tarjeta_amarilla", "tarjeta_roja"]);

    if (cardsData) {
      for (const card of cardsData) {
        if (!card.jugador_id) continue;
        const current = statsByPlayer.get(card.jugador_id);
        if (current) {
          if (card.tipo === "tarjeta_amarilla") {
            current.amarillas += 1;
          } else if (card.tipo === "tarjeta_roja") {
            current.rojas += 1;
          }
          statsByPlayer.set(card.jugador_id, current);
        }
      }
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
        .select("id, numero")
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

      const jornadaNumberMap = new Map<string, number>();
      jornadas?.forEach((j: any) => {
        jornadaNumberMap.set(j.id, j.numero || 0);
      });

      const { data: stats } = await supabase
        .from("jugador_partido_stats")
        .select("*, partidos_liga!inner(*)")
        .eq("jugador_id", p.id)
        .in("partidos_liga.jornada_id", jornadaIds);

      if (stats) {
        // Derive this player's Santiso team ID from their match frequency.
        // Their team appears once per row; rivals appear once per match total.
        const detailTeamFreq = new Map<string, number>();
        stats.forEach((s: any) => {
          const pl = s.partidos_liga;
          if (!pl) return;
          if (pl.equipo_local_id) detailTeamFreq.set(pl.equipo_local_id, (detailTeamFreq.get(pl.equipo_local_id) || 0) + 1);
          if (pl.equipo_visitante_id) detailTeamFreq.set(pl.equipo_visitante_id, (detailTeamFreq.get(pl.equipo_visitante_id) || 0) + 1);
        });
        const topTeamEntry = [...detailTeamFreq.entries()].sort((a, b) => b[1] - a[1])[0];
        const effectiveSantisoIds = [
          ...new Set([...santisoTeamIds, ...(topTeamEntry ? [topTeamEntry[0]] : [])]),
        ];

        let totalMin = 0;
        let totalGoles = 0;
        let totalEncajados = 0;
        let porteriasCero = 0;
        let totalPoints = 0;
        const conv = stats.length;
        let tit = 0;
        let sup = 0;
        let pj = 0;

        const convocatedJornadaIds = new Set<string>();

        stats.forEach((s: any) => {
          const isTitular = s.titular;
          const played = s.jugo || s.titular;
          if (played) pj++;
          if (isTitular) tit++;
          else if (played) sup++;
          totalGoles += s.goles || 0;

          if (s.partidos_liga?.jornada_id) {
            convocatedJornadaIds.add(s.partidos_liga.jornada_id);
          }

          if ((p.posicion === "POR" || ["DFC", "LD", "LI"].includes(p.posicion)) && played) {
            const pl = s.partidos_liga;
            const encajados = effectiveSantisoIds.includes(pl.equipo_local_id)
               ? Number(pl.goles_visitante ?? 0)
               : Number(pl.goles_local ?? 0);
            totalEncajados += encajados;
            if (pl.estado === "finalizado" && encajados === 0) porteriasCero++;
          }
          if (played && s.partidos_liga) {
            totalPoints += computeMatchPoints(s.partidos_liga, effectiveSantisoIds);
          }
          if (played) totalMin += isTitular ? 90 : 25;
        });

        const orFilter = effectiveSantisoIds
          .flatMap((id: string) => [`equipo_local_id.eq.${id}`, `equipo_visitante_id.eq.${id}`])
          .join(",");

        const { data: teamMatchesRaw } = orFilter
          ? await supabase
              .from("partidos_liga")
              .select("id,categoria,equipo_local_id,goles_local,goles_visitante,jornada_id")
              .in("jornada_id", jornadaIds)
              .eq("estado", "finalizado")
              .or(orFilter)
          : { data: null };
        const teamMatches = (teamMatchesRaw || []) as TeamMatchRow[];
        const pCatLower = p.categoria.toLowerCase();
        const partidosTotalesCategoria = teamMatches.filter(
          (m) => (m.categoria || "").toLowerCase() === pCatLower,
        ).length;

        const finishedJornadas = teamMatches
          .filter((m) => (m.categoria || "").toLowerCase() === pCatLower)
          .map((m) => ({
            jornadaId: m.jornada_id || "",
            numero: m.jornada_id ? (jornadaNumberMap.get(m.jornada_id) || 0) : 0,
          }))
          .filter((item) => item.jornadaId !== "")
          .sort((a, b) => a.numero - b.numero)
          .map((item) => item.jornadaId);

        let maxStreak = 0;
        let currentStreak = 0;
        for (const jId of finishedJornadas) {
          if (convocatedJornadaIds.has(jId)) {
            currentStreak += 1;
            if (currentStreak > maxStreak) {
              maxStreak = currentStreak;
            }
          } else {
            currentStreak = 0;
          }
        }

        const { data: cardsDetail } = await supabase
          .from("partido_eventos_santiso")
          .select("tipo, partidos_liga!inner(jornada_id)")
          .eq("jugador_id", p.id)
          .in("partidos_liga.jornada_id", jornadaIds)
          .in("tipo", ["tarjeta_amarilla", "tarjeta_roja"]);

        let amarillas = 0;
        let rojas = 0;
        if (cardsDetail) {
          for (const card of cardsDetail) {
            if (card.tipo === "tarjeta_amarilla") amarillas++;
            else if (card.tipo === "tarjeta_roja") rojas++;
          }
        }

        setPlayerStats({
          convocado: conv,
          titular: tit,
          suplente: sup,
          pj: pj,
          goles: totalGoles,
          minutos: totalMin,
          golesEncajados: totalEncajados,
          porteriasCero,
          puntosConJugador: totalPoints,
          partidosTotalesCategoria,
          maxStreak,
          currentStreak,
          amarillas,
          rojas,
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
    const nameFontSize =
      name.length > 22 ? "0.78rem" :
      name.length > 18 ? "0.9rem"  :
      name.length > 14 ? "1.05rem" :
      name.length > 10 ? "1.25rem" :
      "1.4rem";
    const hasDiscipline = !isStaff && ((stats?.amarillas || 0) > 0 || (stats?.rojas || 0) > 0);

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
              <span className="fifa-ovr-label">OVR</span>
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
              <div className="fifa-initials-placeholder">
                <span>{getInitials(j.nombre)}</span>
              </div>
            )}
          </div>
          {/* Discipline badges — absolute overlay over bottom of image, above info */}
          {hasDiscipline && (
            <div className="fifa-discipline-strip">
              {(stats?.amarillas || 0) > 0 && (
                <span className="disc-amarilla">
                  <span className="disc-card" />
                  {stats!.amarillas}
                </span>
              )}
              {(stats?.rojas || 0) > 0 && (
                <span className="disc-roja">
                  <span className="disc-card" />
                  {stats!.rojas}
                </span>
              )}
            </div>
          )}
          <div className="fifa-info">
            <h4
              className="fifa-name"
              style={{
                fontSize: nameFontSize,
                lineHeight: name.length > 18 ? 1.15 : 1.1,
                marginBottom: "0.1rem",
                wordBreak: "break-word",
              }}
            >
              {name}
            </h4>
            {!isStaff && j.apodo && (
              <p
                className="fifa-nickname"
                style={{ fontSize: "0.9rem", marginTop: "-0.2rem" }}
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
                <span>
                  <strong>{getMainMetricFromStats(j, stats)}</strong>
                  {getMainMetricLabelFromPlayer(j)}
                </span>
                <span>
                  <strong>{getSecondaryMetricFromStats(j, stats)}</strong>
                  {getSecondaryMetricLabelFromPlayer(j)}
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
              <span>Rendimiento diferenciado por rol (Defensas: porterías a cero y goles encajados. Medios: ptos, titularidades, goles y porterías a cero. Delanteros: goles y ptos).</span>
            </div>
            <div>
              <strong>Porteros</strong>
              <span>Media basada en porterías a cero (15%), promedio de goles encajados (25%), puntos del equipo (50%) y titularidades (10%).</span>
            </div>
            <div>
              <strong>Compromiso y Disciplina</strong>
              <span>Base de 50. Bono de compromiso (hasta +25) que premia la participación, la racha consecutiva de convocatorias y la titularidad. Bono de rendimiento (hasta +20). Capitán (+2), amarillas (-0.2) y rojas (-1.0).</span>
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

              {/* TABS DE NAVEGACIÓN */}
              <div className="detail-tabs-nav">
                <button
                  className={`detail-tab-btn ${activeTab === "rendimiento" ? "active" : ""}`}
                  onClick={() => setActiveTab("rendimiento")}
                >
                  Rendimiento
                </button>
                <button
                  className={`detail-tab-btn ${activeTab === "perfil" ? "active" : ""}`}
                  onClick={() => setActiveTab("perfil")}
                >
                  Perfil
                </button>
                <button
                  className={`detail-tab-btn ${activeTab === "trayectoria" ? "active" : ""}`}
                  onClick={() => setActiveTab("trayectoria")}
                >
                  Trayectoria
                </button>
              </div>

              {/* CONTENIDO DE LA PESTAÑA: RENDIMIENTO */}
              {activeTab === "rendimiento" && (
                <div className="tab-content">
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
                    ) : ["DFC", "LD", "LI"].includes(selectedPlayer.posicion) ? (
                      <>
                        <div className="stat-hero-item accent">
                          <span className="stat-hero-value">{playerStats.porteriasCero}</span>
                          <span className="stat-hero-label">P. a cero</span>
                        </div>
                        <div className="stat-hero-item">
                          <span className="stat-hero-value">{playerStats.golesEncajados}</span>
                          <span className="stat-hero-label">G. encajados</span>
                        </div>
                        <div className="stat-hero-item accent">
                          <span className="stat-hero-value">{playerStats.goles}</span>
                          <span className="stat-hero-label">Goles</span>
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
                    <div className="stats-block-premium">
                      <p className="block-title">Rendimiento detallado</p>
                      <div className="premium-box-grid">
                        <div className="premium-stat-card">
                          <div className="stat-card-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34M12 2a4 4 0 0 0-4 4v5a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4z"/>
                            </svg>
                          </div>
                          <div className="stat-card-info">
                            <span>{playerStats.puntosConJugador}</span>
                            <label>Puntos totales</label>
                          </div>
                        </div>

                        <div className="premium-stat-card">
                          <div className="stat-card-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="20" x2="18" y2="10"/>
                              <line x1="12" y1="20" x2="12" y2="4"/>
                              <line x1="6" y1="20" x2="6" y2="14"/>
                            </svg>
                          </div>
                          <div className="stat-card-info">
                            <span>{(playerStats.puntosConJugador / (playerStats.pj || 1)).toFixed(2)}</span>
                            <label>Pts / partido</label>
                          </div>
                        </div>

                        <div className="premium-stat-card">
                          <div className="stat-card-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                              <polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                          </div>
                          <div className="stat-card-info">
                            <span>{playerStats.partidosTotalesCategoria > 0 ? Math.round((playerStats.pj / playerStats.partidosTotalesCategoria) * 100) : 0}%</span>
                            <label>Compromiso</label>
                          </div>
                        </div>

                        <div className="premium-stat-card">
                          <div className="stat-card-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10"/>
                              <polyline points="12 6 12 12 16 14"/>
                            </svg>
                          </div>
                          <div className="stat-card-info">
                            <span>{playerStats.minutos}'</span>
                            <label>Minutos totales</label>
                          </div>
                        </div>

                        <div className="premium-stat-card">
                          <div className="stat-card-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 8v4l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
                            </svg>
                          </div>
                          <div className="stat-card-info">
                            <span>{(playerStats.minutos / (playerStats.pj || 1)).toFixed(0)}'</span>
                            <label>Min / partido</label>
                          </div>
                        </div>

                        <div className="premium-stat-card">
                          <div className="stat-card-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
                            </svg>
                          </div>
                          <div className="stat-card-info">
                            <span>{playerStats.maxStreak}</span>
                            <label>Racha máx.</label>
                          </div>
                        </div>

                        <div className="premium-stat-card">
                          <div className="stat-card-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z"/>
                              <path d="M15 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
                            </svg>
                          </div>
                          <div className="stat-card-info">
                            <span>{playerStats.currentStreak}</span>
                            <label>Racha actual</label>
                          </div>
                        </div>

                        {(isGoalkeeper(selectedPlayer) || ["DFC", "LD", "LI"].includes(selectedPlayer.posicion)) && (
                          <div className="premium-stat-card">
                            <div className="stat-card-icon">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                              </svg>
                            </div>
                            <div className="stat-card-info">
                              <span>{(playerStats.golesEncajados / (playerStats.pj || 1)).toFixed(2)}</span>
                              <label>GC / partido</label>
                            </div>
                          </div>
                        )}

                        <div className="premium-stat-card discipline-amarilla">
                          <div className="stat-card-icon discipline-icon-amarilla">
                            <span className="discipline-square" />
                          </div>
                          <div className="stat-card-info">
                            <span>{playerStats.amarillas}</span>
                            <label>Tarjetas amarillas</label>
                          </div>
                        </div>

                        <div className="premium-stat-card discipline-roja">
                          <div className="stat-card-icon discipline-icon-roja">
                            <span className="discipline-square" />
                          </div>
                          <div className="stat-card-info">
                            <span>{playerStats.rojas}</span>
                            <label>Tarjetas rojas</label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CONTENIDO DE LA PESTAÑA: PERFIL */}
              {activeTab === "perfil" && (
                <div className="tab-content">
                  <div className="stats-secondary-grid">
                    <div className="stats-block-premium full-width">
                      <p className="block-title">Ficha técnica</p>
                      <div className="perfil-grid">
                        <div className="perfil-item">
                          <span className="perfil-label">Posición</span>
                          <span className="perfil-value">{selectedPlayer.posicion}</span>
                        </div>
                        <div className="perfil-item">
                          <span className="perfil-label">Edad</span>
                          <span className="perfil-value">{getAgeLabel(selectedPlayer)}</span>
                        </div>
                        <div className="perfil-item">
                          <span className="perfil-label">Nacimiento</span>
                          <span className="perfil-value">
                            {[
                              selectedPlayer.fecha_nacimiento ? new Date(selectedPlayer.fecha_nacimiento).toLocaleDateString("es-ES") : null,
                              selectedPlayer.lugar_nacimiento || null
                            ].filter(Boolean).join(" · ") || "No registrado"}
                          </span>
                        </div>
                        <div className="perfil-item">
                          <span className="perfil-label">Altura</span>
                          <span className="perfil-value">{selectedPlayer.altura_cm ? `${selectedPlayer.altura_cm} cm` : "No registrado"}</span>
                        </div>
                        <div className="perfil-item">
                          <span className="perfil-label">Peso</span>
                          <span className="perfil-value">{selectedPlayer.peso_kg ? `${selectedPlayer.peso_kg} kg` : "No registrado"}</span>
                        </div>
                        <div className="perfil-item">
                          <span className="perfil-label">Pierna dominante</span>
                          <span className="perfil-value">{selectedPlayer.pierna_dominante || "No registrado"}</span>
                        </div>
                        <div className="perfil-item">
                          <span className="perfil-label">Procedencia</span>
                          <span className="perfil-value">{selectedPlayer.club_anterior || "Ninguno"}</span>
                        </div>
                        <div className="perfil-item">
                          <span className="perfil-label">Alta en club</span>
                          <span className="perfil-value">{selectedPlayer.temporada_alta || "No registrado"}</span>
                        </div>
                        <div className="perfil-item">
                          <span className="perfil-label">Veteranía</span>
                          <span className="perfil-value">{calculateVeteraniaFromHistorial(selectedPlayer)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CONTENIDO DE LA PESTAÑA: TRAYECTORIA */}
              {activeTab === "trayectoria" && (
                <div className="tab-content">
                  {selectedPlayer.bio_deportiva && (
                    <div className="bio-card-premium">
                      <div className="bio-quote-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9.9 21c-1.9 0-3.4-1.5-3.4-3.4 0-1.8 1.4-3.2 3.2-3.2.3 0 .5.1.7.1-.6-1.5-2.1-2.5-3.8-2.5V10c3.3 0 6 2.7 6 6s-2.7 5-6 5zm11 0c-1.9 0-3.4-1.5-3.4-3.4 0-1.8 1.4-3.2 3.2-3.2.3 0 .5.1.7.1-.6-1.5-2.1-2.5-3.8-2.5V10c3.3 0 6 2.7 6 6s-2.7 5-6 5z" />
                        </svg>
                      </div>
                      <p className="bio-text-premium">{selectedPlayer.bio_deportiva}</p>
                    </div>
                  )}

                  <div className="timeline-block-premium">
                    <p className="block-title">Historial deportivo</p>
                    {getPlayerCareerRows(selectedPlayer).length > 0 && getPlayerCareerRows(selectedPlayer)[0] !== "Sin etapas registradas todavía." ? (
                      <div className="timeline-container">
                        {getPlayerCareerRows(selectedPlayer).map((item, idx) => {
                          const parts = item.split(":");
                          const period = parts.length > 1 ? parts[0].trim() : "";
                          const detail = parts.length > 1 ? parts.slice(1).join(":").trim() : item;
                          const isSantiso = detail.toLowerCase().includes("santiso");

                          return (
                            <div key={idx} className={`timeline-node ${isSantiso ? "active" : ""}`}>
                              <div className="timeline-badge">
                                {period || idx + 1}
                              </div>
                              <div className="timeline-content">
                                <h4>{detail}</h4>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="timeline-empty">Sin etapas registradas todavía en la historia deportiva.</div>
                    )}
                  </div>
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

        /* Secondary stats & layout */
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

        /* PREMIUM REDESIGN STYLES */
        .player-detail-card {
          animation: modalScaleUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes modalScaleUp {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .badge-premium {
          padding: 0.4rem 1.2rem;
          border-radius: 2rem;
          font-weight: 800;
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 1.5px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: rgba(255, 255, 255, 0.05);
          color: #a1a1aa;
        }

        .detail-tabs-nav {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 2rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 2px;
        }
        .detail-tab-btn {
          background: transparent;
          border: none;
          color: #71717a;
          font-weight: 700;
          font-size: 0.95rem;
          padding: 0.75rem 1.25rem;
          cursor: pointer;
          position: relative;
          transition: color 0.2s;
          outline: none;
        }
        .detail-tab-btn:hover {
          color: #e4e4e7;
        }
        .detail-tab-btn.active {
          color: var(--primary);
        }
        .detail-tab-btn.active::after {
          content: "";
          position: absolute;
          bottom: -2px;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--primary);
          box-shadow: 0 0 10px rgba(250, 204, 21, 0.5);
          border-radius: 2px;
        }

        .tab-content {
          animation: tabFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes tabFadeIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .stats-block-premium {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 1.5rem;
          grid-column: 1 / -1;
          position: relative;
          overflow: hidden;
          backdrop-filter: blur(10px);
        }

        .premium-box-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
        }
        @media (min-width: 640px) {
          .premium-box-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        @media (min-width: 1024px) {
          .premium-box-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }

        .premium-stat-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem 1.25rem;
          background: rgba(0, 0, 0, 0.25);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.04);
          transition: all 0.2s ease-in-out;
        }
        .premium-stat-card:hover {
          transform: translateY(-2px);
          border-color: rgba(250, 204, 21, 0.3);
          background: rgba(250, 204, 21, 0.02);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
        }
        .stat-card-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: rgba(250, 204, 21, 0.08);
          color: var(--primary);
          flex-shrink: 0;
          transition: all 0.2s;
        }
        .premium-stat-card:hover .stat-card-icon {
          background: var(--primary);
          color: #000;
          box-shadow: 0 0 10px rgba(250, 204, 21, 0.4);
        }
        .stat-card-info {
          display: flex;
          flex-direction: column;
        }
        .stat-card-info span {
          font-size: 1.4rem;
          font-weight: 900;
          color: #fff;
          line-height: 1.1;
        }
        .stat-card-info label {
          font-size: 0.65rem;
          text-transform: uppercase;
          color: #71717a;
          font-weight: 700;
          letter-spacing: 0.5px;
          margin-top: 0.15rem;
        }

        .perfil-grid {
          display: grid;
          grid-template-columns: repeat(1, 1fr);
          gap: 1.25rem;
        }
        @media (min-width: 640px) {
          .perfil-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (min-width: 1024px) {
          .perfil-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        .perfil-item {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          padding: 0.8rem 1rem;
          background: rgba(0, 0, 0, 0.15);
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.03);
          transition: all 0.2s;
        }
        .perfil-item:hover {
          border-color: rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.02);
        }
        .perfil-label {
          font-size: 0.65rem;
          text-transform: uppercase;
          color: #71717a;
          font-weight: 700;
          letter-spacing: 0.8px;
        }
        .perfil-value {
          font-size: 1rem;
          font-weight: 700;
          color: #e4e4e7;
        }

        .bio-card-premium {
          display: flex;
          gap: 1.25rem;
          padding: 1.25rem 1.5rem;
          background: linear-gradient(90deg, rgba(250, 204, 21, 0.05) 0%, transparent 100%);
          border-left: 3px solid var(--primary);
          border-radius: 0 12px 12px 0;
          margin-bottom: 2rem;
          box-shadow: inset 0 0 15px rgba(250, 204, 21, 0.02);
        }
        .bio-quote-icon {
          color: var(--primary);
          opacity: 0.5;
          flex-shrink: 0;
          display: flex;
          align-items: flex-start;
          margin-top: 0.2rem;
        }
        .bio-text-premium {
          font-size: 0.95rem;
          color: #d4d4d8;
          line-height: 1.6;
          font-style: italic;
          margin: 0;
        }

        .timeline-block-premium {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 1.5rem;
          backdrop-filter: blur(10px);
        }
        .timeline-container {
          position: relative;
          padding-left: 2rem;
          margin: 1.5rem 0 0 0.75rem;
          border-left: 2px solid rgba(255, 255, 255, 0.08);
          display: flex;
          flex-direction: column;
          gap: 1.75rem;
        }
        .timeline-node {
          position: relative;
        }
        .timeline-badge {
          position: absolute;
          left: calc(-2rem - 7px);
          top: 3px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #27272a;
          border: 2px solid #52525b;
          font-size: 0;
          z-index: 2;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .timeline-node.active .timeline-badge {
          background: var(--primary);
          border-color: var(--primary);
          box-shadow: 0 0 10px var(--primary);
          transform: scale(1.3);
        }
        .timeline-content {
          padding-left: 0.5rem;
        }
        .timeline-content h4 {
          font-size: 0.95rem;
          font-weight: 700;
          color: #a1a1aa;
          margin: 0;
          transition: color 0.3s;
        }
        .timeline-node.active .timeline-content h4 {
          color: #fff;
          font-weight: 800;
        }
        .timeline-empty {
          font-size: 0.9rem;
          color: #71717a;
          text-align: center;
          padding: 3rem 1rem;
          font-style: italic;
        }

        .detail-right {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
        }
        .detail-right::-webkit-scrollbar {
          width: 6px;
        }
        .detail-right::-webkit-scrollbar-track {
          background: transparent;
        }
        .detail-right::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }
        .detail-right::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .discipline-amarilla {
          border-color: rgba(234, 179, 8, 0.15) !important;
        }
        .discipline-amarilla:hover {
          border-color: rgba(234, 179, 8, 0.4) !important;
          background: rgba(234, 179, 8, 0.04) !important;
        }
        .discipline-amarilla:hover .stat-card-icon {
          background: rgba(234, 179, 8, 0.9) !important;
          box-shadow: 0 0 10px rgba(234, 179, 8, 0.4) !important;
        }
        .discipline-roja {
          border-color: rgba(239, 68, 68, 0.15) !important;
        }
        .discipline-roja:hover {
          border-color: rgba(239, 68, 68, 0.4) !important;
          background: rgba(239, 68, 68, 0.04) !important;
        }
        .discipline-roja:hover .stat-card-icon {
          background: rgba(239, 68, 68, 0.9) !important;
          box-shadow: 0 0 10px rgba(239, 68, 68, 0.4) !important;
        }
        .discipline-icon-amarilla {
          background: rgba(234, 179, 8, 0.12) !important;
          color: #fbbf24 !important;
        }
        .discipline-icon-roja {
          background: rgba(239, 68, 68, 0.12) !important;
          color: #f87171 !important;
        }
        .discipline-square {
          display: inline-block;
          width: 10px;
          height: 14px;
          border-radius: 2px;
          background: currentColor;
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
