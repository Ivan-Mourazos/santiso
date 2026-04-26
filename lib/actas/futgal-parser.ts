import type { ActaEvent, ActaPlayerRef, ParsedActa } from "./types";

function newId() {
  return crypto.randomUUID();
}

function cleanText(value: string) {
  return value
    .replace(/[|•·]/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’`´]/g, "'")
    .replace(/\bO\s*-\s*(\d)\b/g, "0-$1")
    .replace(/\b(\d)\s*-\s*O\b/g, "$1-0")
    .replace(/\bOO\b/g, "00")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function toTitleCase(value: string) {
  return cleanText(value)
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function displayActaName(rawName: string) {
  const cleaned = cleanText(rawName.replace(/\([^)]*\)/g, ""));
  if (!cleaned.includes(",")) return toTitleCase(cleaned);

  const [surnamePart, namePart] = cleaned.split(",", 2);
  const name = toTitleCase(namePart || "");
  const surnames = toTitleCase(surnamePart || "");
  return cleanText(`${name} ${surnames}`);
}

function lineLooksLikeSection(line: string) {
  const normalized = normalizeForSearch(line);
  return [
    "titulares",
    "suplentes",
    "cuerpo tecnico",
    "arbitros",
    "goles",
    "tarjetas",
    "cambios",
    "estadio",
    "ciudad",
    "del campo",
    "del equipo",
    "entrenador",
  ].some((section) => normalized.includes(section));
}

function normalizeOcrText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g, "$1\n$2")
    .replace(/(Titulares|Suplentes|Cuerpo Técnico|Arbitros|Árbitros|Goles|Tarjetas|Cambios|Estadio|Ciudad)\s*/gi, "\n$1\n")
    .replace(/([⚽🟨🟥])/g, "\n$1 ")
    .replace(/(\d{1,2}\s*-\s*\d{1,2})/g, "\n$1 ")
    .replace(/\((\d{1,3}|999)\s*['’]?\)/g, "($1')")
    .replace(/(\d{1,3}|999)\s*['’]/g, "($1')")
    .replace(/\n{2,}/g, "\n");
}

function sectionLines(lines: string[], startWords: string[], endWords: string[]) {
  const start = lines.findIndex((line) => {
    const normalized = normalizeForSearch(line);
    return startWords.some((word) => normalized.includes(word));
  });
  if (start < 0) return [];

  const out: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const normalized = normalizeForSearch(line);
    if (endWords.some((word) => normalized.includes(word))) break;
    out.push(line);
  }
  return out;
}

function parsePlayerLine(line: string): ActaPlayerRef | null {
  const cleaned = cleanText(line.replace(/^[^\d]+/, ""));
  const match = cleaned.match(/^(\d{1,3})\s+(.+)$/);
  if (!match) return null;

  const dorsal = match[1];
  const rawName = displayActaName(match[2]);
  if (!rawName || lineLooksLikeSection(rawName)) return null;

  return {
    id: newId(),
    dorsal,
    rawName,
  };
}

function parsePlayers(lines: string[]) {
  return lines.map(parsePlayerLine).filter((player): player is ActaPlayerRef =>
    Boolean(player),
  );
}

function parseScore(text: string) {
  const match = normalizeOcrText(text).match(/(?:^|\s)(\d{1,2})\s*-\s*(\d{1,2})(?:\s|$)/);
  return {
    marcadorLocal: match?.[1] || "0",
    marcadorVisitante: match?.[2] || "0",
  };
}

function parseCampo(lines: string[]) {
  const estadioLine = lines.find((line) =>
    normalizeForSearch(line).startsWith("estadio"),
  );
  const ciudadLine = lines.find((line) =>
    normalizeForSearch(line).startsWith("ciudad"),
  );

  const campoNombre = estadioLine
    ? cleanText(estadioLine.replace(/estadio\s*:?/i, "").replace(/^:\s*/, ""))
    : "";
  const campoPoblacion = ciudadLine
    ? cleanText(ciudadLine.replace(/ciudad\s*:?/i, "").replace(/^:\s*/, ""))
    : "";

  return { campoNombre, campoPoblacion };
}

function parseEventMinute(line: string) {
  const match = line.match(/\(?(\d{1,3}|999)\s*['’]?\)?/);
  return match?.[1] || "";
}

function parseScorePrefix(line: string) {
  const match = line.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})/);
  if (!match) return null;
  return {
    local: Number(match[1]),
    visitante: Number(match[2]),
    text: `${match[1]}-${match[2]}`,
  };
}

function removeEventNoise(line: string) {
  return cleanText(
    line
      .replace(/[⚽🟨🟥]/g, " ")
      .replace(/\d{1,2}\s*-\s*\d{1,2}/, " ")
      .replace(/\(?(\d{1,3}|999)\s*['’]?\)?/, " "),
  );
}

function findPlayerByName(name: string, players: ActaPlayerRef[]) {
  const normalized = normalizeForSearch(name);
  return players.find((player) => {
    const raw = normalizeForSearch(player.rawName);
    return raw.includes(normalized) || normalized.includes(raw);
  });
}

function parseGoals(
  lines: string[],
  santisoIsLocal: boolean,
  santisoPlayers: ActaPlayerRef[],
) {
  const eventos: ActaEvent[] = [];
  let previousLocal = 0;
  let previousVisitante = 0;

  for (const line of lines) {
    const minute = parseEventMinute(line);
    const score = parseScorePrefix(line);
    const rawName = removeEventNoise(line);
    if (!minute || !rawName) continue;

    let isRival = true;
    if (score) {
      const localScored = score.local > previousLocal;
      const visitanteScored = score.visitante > previousVisitante;
      const santisoScored = santisoIsLocal ? localScored : visitanteScored;
      isRival = !santisoScored;
      previousLocal = score.local;
      previousVisitante = score.visitante;
    }

    const jugador = isRival ? undefined : findPlayerByName(rawName, santisoPlayers);
    eventos.push({
      id: newId(),
      tipo: "gol",
      minuto: minute,
      isRival,
      jugador,
      nombreRival: isRival ? displayActaName(rawName) : undefined,
      scoreAfter: score?.text,
      confidence: jugador || isRival ? "media" : "baja",
    });
  }

  return eventos;
}

function parseCards(lines: string[], santisoPlayers: ActaPlayerRef[]) {
  const eventos: ActaEvent[] = [];

  for (const line of lines) {
    const minute = parseEventMinute(line);
    const rawName = removeEventNoise(line);
    if (!minute || !rawName) continue;

    const isRed = normalizeForSearch(line).includes("roja");
    const jugador = findPlayerByName(rawName, santisoPlayers);
    eventos.push({
      id: newId(),
      tipo: isRed ? "tarjeta_roja" : "tarjeta_amarilla",
      minuto: minute,
      isRival: false,
      jugador,
      confidence: jugador ? "media" : "baja",
    });
  }

  return eventos;
}

function parseChanges(lines: string[], santisoPlayers: ActaPlayerRef[]) {
  const eventos: ActaEvent[] = [];

  for (const line of lines) {
    const minute = parseEventMinute(line);
    if (!minute) continue;

    const normalized = normalizeForSearch(line);
    const parts = normalized.includes("entra")
      ? line.split(/entra/i)
      : normalized.includes("sale")
        ? line.split(/sale/i)
        : [];
    if (parts.length < 2) continue;

    const jugadorSale = findPlayerByName(removeEventNoise(parts[0]), santisoPlayers);
    const jugadorEntra = findPlayerByName(removeEventNoise(parts[1]), santisoPlayers);
    eventos.push({
      id: newId(),
      tipo: "cambio",
      minuto: minute,
      isRival: false,
      jugadorSale,
      jugadorEntra,
      confidence: jugadorSale && jugadorEntra ? "media" : "baja",
    });
  }

  return eventos;
}

export function parseFutgalActaText(text: string, santisoIsLocal: boolean): ParsedActa {
  const normalizedText = normalizeOcrText(text);
  const lines = normalizedText
    .split(/\r?\n/)
    .map(cleanText)
    .filter(Boolean);

  const titulares = parsePlayers(
    sectionLines(lines, ["titulares"], ["suplentes", "cuerpo tecnico", "arbitros", "goles"]),
  );
  const suplentes = parsePlayers(
    sectionLines(lines, ["suplentes"], ["cuerpo tecnico", "arbitros", "goles", "tarjetas"]),
  );
  const santisoPlayers = [...titulares, ...suplentes];

  const goalLines = sectionLines(lines, ["goles"], ["estadio", "ciudad", "tarjetas", "cambios"]);
  const cardLines = sectionLines(lines, ["tarjetas"], ["cambios", "observaciones", "estadio"]);
  const changeLines = sectionLines(lines, ["cambios"], ["tarjetas", "observaciones", "estadio"]);

  const eventos = [
    ...parseGoals(goalLines, santisoIsLocal, santisoPlayers),
    ...parseCards(cardLines, santisoPlayers),
    ...parseChanges(changeLines, santisoPlayers),
  ].sort((a, b) => Number(a.minuto) - Number(b.minuto));

  const warnings: string[] = [];
  if (titulares.length === 0) warnings.push("No se detectaron titulares.");
  if (eventos.length === 0) warnings.push("No se detectaron eventos.");
  if (eventos.some((event) => event.confidence === "baja")) {
    warnings.push("Hay eventos sin jugador Santiso reconocido. Revísalos antes de insertar.");
  }

  return {
    ...parseScore(normalizedText),
    ...parseCampo(lines),
    titulares,
    suplentes,
    eventos,
    warnings,
    rawText: normalizedText,
  };
}
