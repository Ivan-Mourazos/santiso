function stripJsonFence(value: string) {
  return value
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Falta GEMINI_API_KEY" }, { status: 500 });
  }

  const formData = await request.formData();
  const image = formData.get("image");
  if (!(image instanceof File)) {
    return Response.json({ error: "Falta imagen" }, { status: 400 });
  }

  const bytes = Buffer.from(await image.arrayBuffer());
  const base64 = bytes.toString("base64");

  const prompt = `Eres un lector de cabeceras de actas de Futgal.
Lee el documento y extrae SOLO los siguientes campos del encabezado. Devuelve SOLO JSON válido, sin markdown:
{
  "jornada": 30,
  "localTeam": "U.D. SANTISO F.C.",
  "visitorTeam": "C.F. CAÑIZA",
  "categoria": "Femenino",
  "competicion": "SEGUNDA DIVISIÓN GALEGA (LGF 2º DIVISIÓN | GRUPO 2)",
  "fecha": "2026-05-31"
}

Reglas:
- categoria debe ser exactamente "Senior", "Femenino" o "Veteranos":
    Si el título contiene "FEMENIN" → "Femenino"
    Si contiene "VETERAN" → "Veteranos"
    En otro caso → "Senior"
- jornada: número entero
- localTeam y visitorTeam: nombres exactos como aparecen en el acta (equipo LOCAL a la izquierda, VISITANTE a la derecha)
- fecha: formato YYYY-MM-DD
- competicion: texto exacto de la competición tal como aparece`;

  const detectModels = ["gemini-3.1-flash-lite", "gemini-2.5-flash-lite"];
  const requestBody = JSON.stringify({
    generationConfig: { temperature: 0, responseMimeType: "application/json" },
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { mimeType: image.type || "application/pdf", data: base64 } },
        ],
      },
    ],
  });

  try {
    let response: Response | null = null;
    for (const model of detectModels) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: requestBody },
      );
      if (res.ok || res.status !== 404) {
        response = res;
        break;
      }
    }

    if (!response) {
      return Response.json({ error: "Ningún modelo de detección disponible" }, { status: 502 });
    }

    if (!response.ok) {
      const detail = await response.text();
      return Response.json(
        { error: `Gemini error ${response.status}`, detail },
        { status: 502 },
      );
    }

    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return Response.json({ error: "Sin respuesta de Gemini" }, { status: 502 });
    }

    const data = JSON.parse(stripJsonFence(text));
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Error de detección" },
      { status: 502 },
    );
  }
}
