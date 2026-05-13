/**
 * lib/cartel/instagram.ts
 * Generator of Instagram post captions for UD Santiso.
 */

import type { CronEvent, NextMatch } from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CAT_EMOJI: Record<string, string> = {
  Veteranos: "👴",
  Femenino:  "👧",
  Senior:    "👱‍♂️",
  Feminino:  "👧",
  "Sénior":  "👱‍♂️",
};

const CAT_LABEL: Record<string, string> = {
  Veteranos: "VETERANOS",
  Femenino:  "FEMININO",
  Senior:    "SÉNIOR",
  Feminino:  "FEMININO",
  "Sénior":  "SÉNIOR",
};

const CAT_HASHTAG: Record<string, string> = {
  Veteranos: "#Veteranos",
  Femenino:  "#Feminino",
  Senior:    "#Senior",
  Feminino:  "#Feminino",
  "Sénior":  "#Senior",
};

function fmtDateLong(dateStr: string): string {
  if (!dateStr) return "— — — — — — —";
  const cleanDate = dateStr.split("T")[0];
  const d = new Date(cleanDate + "T12:00:00Z");
  return d.toLocaleDateString("gl-ES", {
    timeZone: "UTC",
    weekday: "long", day: "2-digit", month: "2-digit", year: "numeric"
  })
    .replace(",", "")
    .replace(/\//g, " / ");
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function extractCompetitionShort(competicion: string): string {
  // Try to extract a short label from the competition string
  if (competicion.toLowerCase().includes("copa"))    return "Copa";
  if (competicion.toLowerCase().includes("honra"))   return "División da Honra";
  if (competicion.toLowerCase().includes("segunda")) return "Segunda División";
  if (competicion.toLowerCase().includes("terceira")) return "Terceira Galicia";
  return competicion;
}

// ─── Próximos Partidos ────────────────────────────────────────────────────────

export interface ProximosParams {
  matches: (NextMatch & { rivalEscudoUrl?: string })[];
}

export function generateProximosText(params: ProximosParams): string {
  const { matches } = params;
  const validMatches = matches.filter(m => m.rival && m.rival.trim() !== "");

  if (!validMatches.length) return "";

  const lines: string[] = ["📅 AXENDA DA FIN DE SEMANA", ""];

  for (const m of validMatches) {
    const catEmoji = CAT_EMOJI[m.categoria] ?? "⚽";
    const catLabel = CAT_LABEL[m.categoria] ?? m.categoria.toUpperCase();
    const dateStr  = fmtDateLong(m.fecha);
    const hora     = m.hora || "—:—";
    const rival    = m.rival;
    const estadio  = m.lugar || "—";

    // Build versus line depending on santisoSide
    const santisoSide = m.santisoSide || "right";
    const santisoName = m.categoria === "Veteranos" ? "UD Santiso FC Solaina" : "UD Santiso FC";
    const versusLine = santisoSide === "left"
      ? `🆚 ${santisoName} vs ${rival}`
      : `🆚 ${rival} vs ${santisoName}`;

    lines.push(`${catEmoji} ${catLabel}:`);
    lines.push("");
    lines.push(versusLine);
    lines.push(`📅 ${capitalizeFirst(dateStr)}`);
    lines.push(`⏰ ${hora}h`);
    if (estadio && estadio !== "—") lines.push(`🏟️ ${estadio}`);
    lines.push("");
  }

  lines.push("#UDSantiso #AxendaDeportiva #FutbolGalego #Santiso #FamiliaAurinegra");

  return lines.join("\n");
}

// ─── Resultado Xornada ────────────────────────────────────────────────────────

export interface ResultadoParams {
  categoria:    string;
  competicion:  string;
  jornada:      string;
  fecha:        string;
  estadio:      string;
  rivalNombre:  string;
  golesLocal:   string;
  golesRival:   string;
  santisoSide:  "left" | "right";
  events:       CronEvent[];
}

export function generateResultadoText(p: ResultadoParams): string {
  const santisoName = p.categoria === "Veteranos" ? "UD Santiso FC Solaina" : "UD Santiso FC";
  const compShort   = extractCompetitionShort(p.competicion);
  const catLabel    = CAT_LABEL[p.categoria] ?? p.categoria.toUpperCase();
  const dateStr     = fmtDateLong(p.fecha);

  const localGoles  = parseInt(p.golesLocal  || "0");
  const rivalGoles  = parseInt(p.golesRival  || "0");

  // Determine result label
  const isSantisoLocal = p.santisoSide === "left";
  const santisoScore = isSantisoLocal ? localGoles : rivalGoles;
  const rivalScore   = isSantisoLocal ? rivalGoles : localGoles;
  const resultLabel  =
    santisoScore > rivalScore ? "✅ VITORIA" :
    santisoScore < rivalScore ? "❌ DERROTA" : "🤝 EMPATE";

  const lines: string[] = [];

  // Header
  lines.push(`${resultLabel} | ${catLabel} (${compShort.toUpperCase()})`);
  lines.push("");
  lines.push(`📅 ${capitalizeFirst(dateStr)}`);
  lines.push("");

  // Score line
  if (isSantisoLocal) {
    lines.push(`🏟️ ${santisoName} ${localGoles} - ${rivalGoles} ${p.rivalNombre}`);
  } else {
    lines.push(`🏟️ ${p.rivalNombre} ${localGoles} - ${rivalGoles} ${santisoName}`);
  }
  lines.push("");

  // Goals — 'local' in form = Santiso, 'rival' in form = opponent
  const GOAL_TIPOS = ["gol", "penalti", "propia"];
  const allGoals = p.events.filter(e => GOAL_TIPOS.includes(e.tipo));

  const santisoGoals = allGoals.filter(e => e.equipo === "local");
  const rivalGoals   = allGoals.filter(e => e.equipo === "rival");

  if (allGoals.length > 0) {
    lines.push("⚽ Goles:");
    lines.push("");
    if (santisoGoals.length > 0) {
      const golesStr = fmtGoalList(santisoGoals);
      lines.push(`${santisoName}: ${golesStr}.`);
    }
    if (rivalGoals.length > 0) {
      const golesStr = fmtGoalList(rivalGoals);
      lines.push(`${p.rivalNombre || "Rival"}: ${golesStr}.`);
    }
    lines.push("");
  }

  // Cards — 'local' = Santiso, 'rival' = opponent
  const cards = p.events.filter(e => e.tipo === "amarela" || e.tipo === "doble_amarela" || e.tipo === "vermella");
  const santisoCards = cards.filter(e => e.equipo === "local");
  const rivalCards   = cards.filter(e => e.equipo === "rival");

  if (cards.length > 0) {
    lines.push("🟨 Tarxetas:");
    lines.push("");
    if (santisoCards.length > 0) {
      const cardsStr = santisoCards.map(e => `${e.jugador} (${e.minuto}')`).join(", ");
      lines.push(`${cardsStr} pola nosa parte.`);
    }
    if (rivalCards.length > 0) {
      const cardsStr = rivalCards.map(e => `${e.jugador} (${e.minuto}')`).join(", ");
      lines.push(`${cardsStr} (rival).`);
    }
    lines.push("");
  }

  lines.push("👉 Desliza para ver o noso once inicial e máis a cronoloxía completa.");
  lines.push("");

  // Hashtags
  const catTag = CAT_HASHTAG[p.categoria] ?? "";
  const competTag = compShort.toLowerCase().includes("copa") ? "#Copa" : "";
  lines.push(`#UDSantiso ${catTag} ${competTag} #FutbolGalego #Resultados #Santiso #FamiliaAurinegra`.replace(/\s+/g, " ").trim());

  return lines.join("\n");
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function fmtGoalList(events: CronEvent[]): string {
  // Group by player, accumulate minutes
  const grouped: Map<string, string[]> = new Map();
  for (const e of events) {
    const player = e.jugador || "—";
    const suffix = e.tipo === "penalti" ? " (p)" : e.tipo === "propia" ? " (en propia)" : "";
    const key = player + suffix;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(`${e.minuto}'`);
  }

  const parts: string[] = [];
  grouped.forEach((mins, player) => {
    parts.push(`${player} (${mins.join(", ")})`);
  });

  // Oxford-ish join with "e"
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return parts.slice(0, -1).join(", ") + " e " + parts[parts.length - 1];
}
