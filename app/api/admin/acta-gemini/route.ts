import type {
  ActaCampoDb,
  ActaEventType,
  ActaMatchDb,
  ActaPlayerDb,
  ParsedActa,
} from "@/lib/actas/types";

interface GeminiActaPlayer {
  dorsal?: string;
  rawName?: string;
  jugadorId?: string;
}

interface GeminiActaEvent {
  tipo: ActaEventType;
  minuto: string;
  isRival: boolean;
  jugadorId?: string;
  jugadorSaleId?: string;
  jugadorEntraId?: string;
  nombreRival?: string;
  scoreAfter?: string;
  confidence?: "alta" | "media" | "baja";
}

interface GeminiActaResponse {
  marcadorLocal: string;
  marcadorVisitante: string;
  campoId?: string;
  campoNombre: string;
  campoPoblacion: string;
  titulares: GeminiActaPlayer[];
  suplentes: GeminiActaPlayer[];
  eventos: GeminiActaEvent[];
  warnings?: string[];
}

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

interface GeminiModelListResponse {
  models?: Array<{
    name?: string;
    supportedGenerationMethods?: string[];
  }>;
}

function stripJsonFence(value: string) {
  return value
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function getDisplayName(player: ActaPlayerDb) {
  if (player.apodo?.trim()) return player.apodo.trim();
  const parts = player.nombre.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[1]}` : player.nombre;
}

function safeString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function toParsedActa(
  data: GeminiActaResponse,
  jugadores: ActaPlayerDb[],
): ParsedActa {
  const playersById = new Map(jugadores.map((player) => [player.id, player]));
  const makePlayerRef = (player: GeminiActaPlayer) => {
    const dbPlayer = player.jugadorId ? playersById.get(player.jugadorId) : null;
    return {
      id: crypto.randomUUID(),
      dorsal: safeString(player.dorsal || dbPlayer?.dorsal?.toString() || ""),
      rawName: safeString(player.rawName || dbPlayer?.nombre || ""),
      jugadorId: dbPlayer?.id,
      displayName: dbPlayer ? getDisplayName(dbPlayer) : undefined,
    };
  };

  const makeEventPlayer = (playerId?: string, rawName?: string) => {
    if (!playerId) return undefined;
    const dbPlayer = playersById.get(playerId);
    if (!dbPlayer) return undefined;
    return makePlayerRef({
      jugadorId: dbPlayer.id,
      dorsal: dbPlayer.dorsal?.toString() || "",
      rawName: rawName || dbPlayer.nombre,
    });
  };

  return {
    campoId: safeString(data.campoId) || undefined,
    marcadorLocal: safeString(data.marcadorLocal),
    marcadorVisitante: safeString(data.marcadorVisitante),
    campoNombre: safeString(data.campoNombre),
    campoPoblacion: safeString(data.campoPoblacion),
    titulares: Array.isArray(data.titulares)
      ? data.titulares.map(makePlayerRef)
      : [],
    suplentes: Array.isArray(data.suplentes)
      ? data.suplentes.map(makePlayerRef)
      : [],
    eventos: Array.isArray(data.eventos)
      ? data.eventos.map((event) => ({
          id: crypto.randomUUID(),
          tipo: event.tipo,
          minuto: safeString(event.minuto),
          isRival: Boolean(event.isRival),
          jugador: makeEventPlayer(event.jugadorId),
          jugadorSale: makeEventPlayer(event.jugadorSaleId),
          jugadorEntra: makeEventPlayer(event.jugadorEntraId),
          nombreRival: safeString(event.nombreRival) || undefined,
          scoreAfter: safeString(event.scoreAfter) || undefined,
          confidence: event.confidence || "media",
        }))
      : [],
    warnings: Array.isArray(data.warnings) ? data.warnings.map(String) : [],
    rawText: "Analizado con Gemini",
  };
}

function buildPrompt({
  match,
  jugadores,
  campos,
}: {
  match: ActaMatchDb;
  jugadores: ActaPlayerDb[];
  campos: ActaCampoDb[];
}) {
  const santisoLocal = match.equipo_local?.nombre
    ?.toLowerCase()
    .includes("santiso");

  return `
Eres un extractor de datos de actas de Futgal para U.D. Santiso.
Lee la imagen completa y devuelve SOLO JSON válido, sin markdown.

Partido seleccionado:
${JSON.stringify({
  id: match.id,
  categoria: match.categoria,
  local: match.equipo_local?.nombre,
  visitante: match.equipo_visitante?.nombre,
  santisoSide: santisoLocal ? "local" : "visitante",
  jornada: match.jornada?.numero,
}, null, 2)}

Jugadores Santiso disponibles en BD. Para cualquier jugador del Santiso usa SOLO uno de estos jugadorId. No inventes ids:
${JSON.stringify(jugadores.map((player) => ({
  jugadorId: player.id,
  dorsal: player.dorsal,
  nombre: player.nombre,
  apodo: player.apodo,
  display: getDisplayName(player),
})), null, 2)}

Campos existentes. Si el campo del acta coincide razonablemente con uno, usa su campoId. Si no, deja campoId vacío y propone campoNombre/campoPoblacion:
${JSON.stringify(campos.map((campo) => ({
  campoId: campo.id,
  nombre: campo.nombre,
  poblacion: campo.poblacion,
})), null, 2)}

Extrae:
- marcadorLocal y marcadorVisitante.
- campoId si coincide con campos existentes; si no campoNombre y campoPoblacion.
- titulares y suplentes del Santiso con dorsal, rawName y jugadorId de la lista.
- eventos: goles, tarjetas amarillas/rojas y cambios.

Reglas:
- tipo debe ser: "gol", "tarjeta_amarilla", "tarjeta_roja" o "cambio".
- minuto debe ser texto numérico, conserva 999 si aparece.
- isRival=true solo para eventos del rival.
- En goles/tarjetas del Santiso usa jugadorId.
- En cambios del Santiso usa jugadorSaleId y jugadorEntraId.
- En eventos del rival usa nombreRival y no uses jugadorId.
- Si no estás seguro, deja el jugadorId vacío y añade warning.
- No uses nombres del acta para jugadores del Santiso si puedes enlazar con BD.

Formato exacto:
{
  "marcadorLocal": "1",
  "marcadorVisitante": "2",
  "campoId": "",
  "campoNombre": "",
  "campoPoblacion": "",
  "titulares": [{ "dorsal": "27", "rawName": "texto acta", "jugadorId": "uuid" }],
  "suplentes": [{ "dorsal": "4", "rawName": "texto acta", "jugadorId": "uuid" }],
  "eventos": [
    { "tipo": "gol", "minuto": "18", "isRival": false, "jugadorId": "uuid", "scoreAfter": "1-1", "confidence": "alta" },
    { "tipo": "cambio", "minuto": "60", "isRival": false, "jugadorSaleId": "uuid", "jugadorEntraId": "uuid", "confidence": "alta" }
  ],
  "warnings": []
}
`;
}

function getModelCandidates() {
  const preferred = process.env.GEMINI_MODEL?.trim();
  return [
    preferred,
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
  ].filter((model, index, models): model is string =>
    Boolean(model && models.indexOf(model) === index),
  );
}

async function getAvailableGenerateContentModels(apiKey: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`models.list: ${response.status} ${detail}`);
  }

  const payload = (await response.json()) as GeminiModelListResponse;
  return (payload.models || [])
    .filter((model) => model.supportedGenerationMethods?.includes("generateContent"))
    .map((model) => model.name?.replace(/^models\//, ""))
    .filter((model): model is string => Boolean(model))
    .filter((model) => model.includes("gemini") && model.includes("flash"))
    .filter((model) => !model.includes("2.0"))
    .sort((a, b) => {
      const rank = (model: string) => {
        if (model.includes("flash-lite") && !model.includes("preview")) return 0;
        if (model.includes("flash-lite")) return 1;
        if (model.includes("flash") && !model.includes("preview")) return 2;
        return 3;
      };
      return rank(a) - rank(b);
    });
}

function buildGeminiBody({
  match,
  jugadores,
  campos,
  image,
  base64,
}: {
  match: ActaMatchDb;
  jugadores: ActaPlayerDb[];
  campos: ActaCampoDb[];
  image: File;
  base64: string;
}) {
  return JSON.stringify({
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
    contents: [
      {
        role: "user",
        parts: [
          { text: buildPrompt({ match, jugadores, campos }) },
          {
            inlineData: {
              mimeType: image.type || "image/png",
              data: base64,
            },
          },
        ],
      },
    ],
  });
}

async function generateWithFallback({
  apiKey,
  match,
  jugadores,
  campos,
  image,
  base64,
}: {
  apiKey: string;
  match: ActaMatchDb;
  jugadores: ActaPlayerDb[];
  campos: ActaCampoDb[];
  image: File;
  base64: string;
}) {
  const errors: string[] = [];
  const body = buildGeminiBody({ match, jugadores, campos, image, base64 });
  const hardcodedCandidates = getModelCandidates();
  const candidates = [...hardcodedCandidates];

  try {
    const availableModels = await getAvailableGenerateContentModels(apiKey);
    for (const model of availableModels) {
      if (!candidates.includes(model)) candidates.push(model);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  for (const model of candidates) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      },
    );

    if (response.ok) {
      return { model, payload: await response.json() };
    }

    const detail = await response.text();
    errors.push(`${model}: ${response.status} ${detail}`);

    // Try the discovered candidates on 404/model mismatch. Stop on auth/quota.
    if (response.status === 401 || response.status === 403 || response.status === 429) {
      break;
    }
  }

  throw new Error(errors.join("\n\n"));
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Falta GEMINI_API_KEY en .env.local" },
      { status: 500 },
    );
  }

  const formData = await request.formData();
  const image = formData.get("image");
  const matchRaw = formData.get("match");
  const jugadoresRaw = formData.get("jugadores");
  const camposRaw = formData.get("campos");

  if (!(image instanceof File) || !matchRaw || !jugadoresRaw || !camposRaw) {
    return Response.json({ error: "Petición incompleta" }, { status: 400 });
  }

  const match = JSON.parse(String(matchRaw)) as ActaMatchDb;
  const jugadores = JSON.parse(String(jugadoresRaw)) as ActaPlayerDb[];
  const campos = JSON.parse(String(camposRaw)) as ActaCampoDb[];
  const bytes = Buffer.from(await image.arrayBuffer());
  const base64 = bytes.toString("base64");

  let result: { model: string; payload: GeminiGenerateResponse };
  try {
    result = await generateWithFallback({
      apiKey,
      match,
      jugadores,
      campos,
      image,
      base64,
    });
  } catch (error) {
    return Response.json(
      {
        error: "Gemini no pudo analizar el acta. Revisa cuota/billing de Google AI Studio.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }

  const payload = result.payload;
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text || typeof text !== "string") {
    return Response.json(
      { error: "Gemini no devolvió texto estructurado", detail: payload },
      { status: 502 },
    );
  }

  try {
    const parsed = JSON.parse(stripJsonFence(text)) as GeminiActaResponse;
    return Response.json({
      acta: toParsedActa(parsed, jugadores),
      raw: parsed,
      model: result.model,
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "JSON inválido",
        detail: text,
      },
      { status: 502 },
    );
  }
}
