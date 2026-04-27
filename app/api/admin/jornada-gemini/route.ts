interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

interface GeminiModelListResponse {
  models?: Array<{
    name?: string;
    supportedGenerationMethods?: string[];
  }>;
}

export interface JornadaMatchExtracted {
  localNombre: string;
  visitanteNombre: string;
  golesLocal: string;
  golesVisitante: string;
  descansa?: boolean;
  fecha?: string;
  hora?: string;
  arbitro?: string;
  campoNombre?: string;
  campoPoblacion?: string;
  confidence: "alta" | "media" | "baja";
}

export interface JornadaGeminiResponse {
  jornada?: string;
  competicion?: string;
  temporada?: string;
  partidos: JornadaMatchExtracted[];
  warnings?: string[];
}

function stripJsonFence(value: string) {
  return value
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function getModelCandidates() {
  const preferred = process.env.GEMINI_MODEL?.trim();
  return [
    preferred,
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
  ].filter(
    (model, index, models): model is string =>
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
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => m.name?.replace(/^models\//, ""))
    .filter((m): m is string => Boolean(m))
    .filter((m) => m.includes("gemini") && m.includes("flash"))
    .filter((m) => !m.includes("2.0"))
    .sort((a, b) => {
      const rank = (m: string) => {
        if (m.includes("flash-lite") && !m.includes("preview")) return 0;
        if (m.includes("flash-lite")) return 1;
        if (m.includes("flash") && !m.includes("preview")) return 2;
        return 3;
      };
      return rank(a) - rank(b);
    });
}

function buildPrompt(equiposDB: string[]) {
  const listaEquipos = equiposDB.length
    ? `\nEquipos registrados en nuestra BD (usa estos nombres exactos si coinciden):\n${equiposDB.map((e) => `- ${e}`).join("\n")}`
    : "";

  return `Eres un extractor de datos de resultados de jornada de fútbol gallego (RFGF/Futgal).
Analiza la imagen completa y extrae TODOS los partidos que aparecen.
Devuelve SOLO JSON válido, sin markdown.
${listaEquipos}

Extrae para cada partido:
- localNombre: nombre equipo local exactamente como aparece en imagen
- visitanteNombre: nombre equipo visitante
- golesLocal: goles del local como string, "" si no jugado
- golesVisitante: goles del visitante como string, "" si no jugado  
- descansa: true si el equipo aparece como "Descansa" sin rival
- fecha: fecha en formato YYYY-MM-DD si aparece, sino ""
- hora: hora en formato HH:MM si aparece, sino ""
- arbitro: apellidos árbitro si aparece, sino ""
- campoNombre: nombre del campo si aparece, sino ""
- campoPoblacion: localidad del campo si aparece, sino ""
- confidence: "alta" si datos claros, "media" si algo dudoso, "baja" si muy incierto

También extrae si aparece:
- jornada: número de jornada como string
- competicion: nombre de la competición
- temporada: temporada (ej "2025-2026")

Formato exacto:
{
  "jornada": "26",
  "competicion": "LGF 2ª División",
  "temporada": "2025-2026",
  "partidos": [
    {
      "localNombre": "C.D. VALLADARES",
      "visitanteNombre": "JUVENTUD CAMBADOS",
      "golesLocal": "2",
      "golesVisitante": "0",
      "descansa": false,
      "fecha": "2026-04-26",
      "hora": "11:00",
      "arbitro": "VEIGA BARCIELA, JOSE ROGELIO",
      "campoNombre": "A Gándara",
      "campoPoblacion": "Valladares",
      "confidence": "alta"
    },
    {
      "localNombre": "SPORTING CLUB SAN MATEO",
      "visitanteNombre": "",
      "golesLocal": "",
      "golesVisitante": "",
      "descansa": true,
      "fecha": "",
      "hora": "",
      "arbitro": "",
      "campoNombre": "",
      "campoPoblacion": "",
      "confidence": "alta"
    }
  ],
  "warnings": []
}`;
}

async function generateWithFallback(
  apiKey: string,
  base64: string,
  mimeType: string,
  equiposDB: string[],
) {
  const body = JSON.stringify({
    generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
    contents: [
      {
        role: "user",
        parts: [
          { text: buildPrompt(equiposDB) },
          { inlineData: { mimeType: mimeType || "image/png", data: base64 } },
        ],
      },
    ],
  });

  const errors: string[] = [];
  const hardcodedCandidates = getModelCandidates();
  const candidates = [...hardcodedCandidates];

  try {
    const available = await getAvailableGenerateContentModels(apiKey);
    for (const m of available) {
      if (!candidates.includes(m)) candidates.push(m);
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  for (const model of candidates) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body },
    );
    if (res.ok) {
      return { model, payload: (await res.json()) as GeminiGenerateResponse };
    }
    const detail = await res.text();
    errors.push(`${model}: ${res.status} ${detail}`);
    if (res.status === 401 || res.status === 403 || res.status === 429) break;
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
  const equiposRaw = formData.get("equipos");

  if (!(image instanceof File)) {
    return Response.json({ error: "Falta imagen" }, { status: 400 });
  }

  const equiposDB: string[] = equiposRaw
    ? (JSON.parse(String(equiposRaw)) as string[])
    : [];

  const bytes = Buffer.from(await image.arrayBuffer());
  const base64 = bytes.toString("base64");

  let result: { model: string; payload: GeminiGenerateResponse };
  try {
    result = await generateWithFallback(
      apiKey,
      base64,
      image.type || "image/png",
      equiposDB,
    );
  } catch (error) {
    return Response.json(
      {
        error: "Gemini no pudo analizar la imagen.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }

  const text =
    result.payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return Response.json(
      { error: "Gemini no devolvió texto", detail: result.payload },
      { status: 502 },
    );
  }

  try {
    const parsed = JSON.parse(stripJsonFence(text)) as JornadaGeminiResponse;
    return Response.json({ data: parsed, model: result.model });
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
