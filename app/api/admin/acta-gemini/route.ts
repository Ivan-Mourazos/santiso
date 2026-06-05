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

function normalizeForFuzzy(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenScore(left: string, right: string) {
  const a = new Set(normalizeForFuzzy(left).split(" ").filter(Boolean));
  const b = new Set(normalizeForFuzzy(right).split(" ").filter(Boolean));
  if (a.size === 0 || b.size === 0) return 0;
  let hits = 0;
  for (const t of a) if (b.has(t)) hits++;
  return hits / Math.max(a.size, b.size);
}

function isSantisoPlayer(rawName: string, jugadores: ActaPlayerDb[]): boolean {
  const best = jugadores
    .map((p) => Math.max(
      tokenScore(rawName, p.nombre),
      p.apodo ? tokenScore(rawName, p.apodo) : 0,
    ))
    .reduce((max, s) => Math.max(max, s), 0);
  return best >= 0.4;
}

function toParsedActa(
  data: GeminiActaResponse,
  jugadores: ActaPlayerDb[],
  santisoLocal: boolean,
): ParsedActa {
  const playersById = new Map(jugadores.map((player) => [player.id, player]));
  const warnings: string[] = Array.isArray(data.warnings) ? data.warnings.map(String) : [];

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

  const filterSantisoOnly = (players: GeminiActaPlayer[], section: string) => {
    const valid: GeminiActaPlayer[] = [];
    for (const p of players) {
      const hasValidId = Boolean(p.jugadorId && playersById.has(p.jugadorId));
      const rawName = safeString(p.rawName);
      const nameMatchesSantiso = rawName ? isSantisoPlayer(rawName, jugadores) : false;
      if (hasValidId || nameMatchesSantiso) {
        valid.push(p);
      } else {
        warnings.push(`⚠ Jugador descartado (probable rival en ${section}): dorsal ${p.dorsal ?? "?"} "${rawName}"`);
      }
    }
    return valid.map(makePlayerRef);
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
      ? filterSantisoOnly(data.titulares, "titulares")
      : [],
    suplentes: Array.isArray(data.suplentes)
      ? filterSantisoOnly(data.suplentes, "suplentes")
      : [],
    eventos: Array.isArray(data.eventos)
      ? (() => {
          const result = [];
          for (const event of data.eventos) {
            const isRival = Boolean(event.isRival);
            const tipo = event.tipo;
            const minutoRaw = safeString(event.minuto).replace(/[^0-9]/g, "");
            const minutoNum = parseInt(minutoRaw, 10);
            const validMinuto = !isNaN(minutoNum) && minutoNum >= 1 && minutoNum <= 999;

            if (!validMinuto) {
              warnings.push(`⚠ Evento descartado (minuto inválido "${event.minuto}"): ${tipo}`);
              continue;
            }

            // Rival: solo goles y tarjetas. Cambios rival → fuera.
            if (isRival && tipo === "cambio") {
              continue;
            }

            result.push({
              id: crypto.randomUUID(),
              tipo,
              minuto: minutoRaw,
              isRival,
              esPropia: Boolean(event.esPropia) || undefined,
              jugador: makeEventPlayer(event.jugadorId),
              jugadorSale: makeEventPlayer(event.jugadorSaleId),
              jugadorEntra: makeEventPlayer(event.jugadorEntraId),
              nombreRival: safeString(event.nombreRival) || undefined,
              scoreAfter: safeString(event.scoreAfter) || undefined,
              confidence: event.confidence || "media",
            });
          }
          // Ordenar por minuto
          result.sort((a, b) => parseInt(a.minuto, 10) - parseInt(b.minuto, 10));

          // Validar que los goles de Santiso coinciden con el marcador
          const santisoGoals = result.filter((e) => e.tipo === "gol" && !e.isRival).length;
          const expectedSantisoGoals = parseInt(
            santisoLocal ? data.marcadorLocal : data.marcadorVisitante,
            10,
          );
          if (!isNaN(expectedSantisoGoals) && santisoGoals !== expectedSantisoGoals) {
            warnings.push(
              `⚠ Goles Santiso detectados (${santisoGoals}) no coinciden con marcador (${expectedSantisoGoals})`,
            );
          }

          return result;
        })()


      : [],
    warnings,
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
Lee TODO el documento completo (todas las páginas si hay varias) y devuelve SOLO JSON válido, sin markdown.

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
Reglas CRÍTICAS DE EQUIPO:
- Santiso es el equipo "${santisoLocal ? match.equipo_local?.nombre : match.equipo_visitante?.nombre}".
- En la imagen del acta, LOCAL está a la izquierda y VISITANTE a la derecha. 
- Santiso juega como ${santisoLocal ? "LOCAL" : "VISITANTE"}. 
- LOCALIZA los nombres de los equipos en el acta. EXTRAE ÚNICAMENTE los jugadores que están bajo el bando de Santiso.
- PROHIBIDO: No incluyas jugadores del equipo rival (${santisoLocal ? match.equipo_visitante?.nombre : match.equipo_local?.nombre}) en titulares o suplentes.
- VALIDACIÓN: Si un dorsal detectado en el acta NO tiene un nombre que coincida razonablemente con la lista de "Jugadores Santiso disponibles", NO lo incluyas en la plantilla de Santiso (podría ser del rival).

REGLAS DE EVENTOS — LEE CON ATENCIÓN:

SUSTITUCIONES (tipo "cambio"):
- En el acta, cada sustitución ocupa DOS líneas:
    Línea 1: [dorsal_entra] [NOMBRE_ENTRA]         ←
    Línea 2: [dorsal_sale]  [NOMBRE_SALE] (minuto') →
- La flecha ← indica el jugador que ENTRA → jugadorEntraId
- La flecha → indica el jugador que SALE  → jugadorSaleId
- El MINUTO está siempre junto al jugador que SALE (línea 2, con →)
- Si hay varios cambios consecutivos (ej. dos al minuto 90'), empareja cada línea-1 con su línea-2 inmediata en el orden visual. NO mezcles pares entre cambios distintos.
- Para cambios del rival: isRival=true, no incluyas jugadorEntraId ni jugadorSaleId.

GOLES (tipo "gol"):
- Los goles aparecen en la SECCIÓN CENTRAL del acta, no bajo ningún equipo.
- Cada línea de gol muestra el marcador acumulado y el goleador: "X-Y NOMBRE (minuto')"
- Deduce quién marcó comparando el marcador anterior con el nuevo:
    Si aumenta el número LOCAL (izquierda): gol del equipo LOCAL
    Si aumenta el número VISITANTE (derecha): gol del equipo VISITANTE
- Santiso juega como ${santisoLocal ? "LOCAL" : "VISITANTE"}.
    Gol del LOCAL → isRival=${santisoLocal ? "false" : "true"}
    Gol del VISITANTE → isRival=${santisoLocal ? "true" : "false"}
- Si el goleador es del Santiso: usa jugadorId (busca en la lista de jugadores).
- Si el goleador es del rival: usa nombreRival con su nombre completo tal como aparece.
- GOL EN PROPIA DEL SANTISO ("p.p." en columna de Santiso, o goleador de Santiso que aumenta marcador del rival): isRival=true, nombreRival="En propia". No uses jugadorId.
- GOL EN PROPIA DEL RIVAL ("p.p." en columna rival, o jugador rival que aumenta marcador de Santiso): isRival=false, esPropia=true, nombreRival=nombre del jugador rival si aparece (si no, omítelo). No uses jugadorId.

TARJETAS (tipo "tarjeta_amarilla" / "tarjeta_roja"):
- Identifica el equipo por la columna visual en que aparecen o el encabezado de sección.
- Tarjeta del rival: isRival=true, nombreRival con el nombre del sancionado.
- Tarjeta a técnico del rival: isRival=true, nombreRival con su nombre.
- Tarjeta al Santiso: isRival=false, jugadorId del sancionado.

OTROS:
- tipo debe ser exactamente: "gol", "tarjeta_amarilla", "tarjeta_roja" o "cambio"
- minuto: texto numérico, conserva 999 si aparece en el acta
- Eventos ordenados por minuto ascendente
- Si hay duda sobre un evento, ponlo con confidence: "baja" y añade un warning
- Si no estás seguro de un jugador Santiso, deja jugadorId vacío y añade warning

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
    { "tipo": "cambio", "minuto": "60", "isRival": false, "jugadorSaleId": "uuid", "jugadorEntraId": "uuid", "confidence": "alta" },
    { "tipo": "tarjeta_amarilla", "minuto": "75", "isRival": true, "nombreRival": "García Pérez", "confidence": "alta" }
  ],
  "warnings": []
}
`;
}

function getModelCandidates() {
  const preferred = process.env.GEMINI_MODEL?.trim();
  return [
    preferred,
    "gemini-3.5-flash",
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
        // Prefiere versiones más nuevas y no-lite (mayor calidad para análisis completo)
        const version = model.includes("3.5") ? 0 : model.includes("3.") ? 1 : model.includes("2.5") ? 2 : 3;
        const lite = model.includes("flash-lite") ? 10 : 0;
        const preview = model.includes("preview") ? 5 : 0;
        return version + lite + preview;
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

  const santisoLocal = match.equipo_local?.nombre?.toLowerCase().includes("santiso") ?? false;

  try {
    const parsed = JSON.parse(stripJsonFence(text)) as GeminiActaResponse;
    return Response.json({
      acta: toParsedActa(parsed, jugadores, santisoLocal),
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
