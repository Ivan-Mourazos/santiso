import { MAX_CAPTURAS } from "@/lib/actas/capturas";

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
  // Con varias capturas la cabecera puede estar en cualquiera: van todas.
  const archivos = formData
    .getAll("image")
    .filter((valor): valor is File => valor instanceof File)
    .slice(0, MAX_CAPTURAS);
  if (archivos.length === 0) {
    return Response.json({ error: "Falta imagen" }, { status: 400 });
  }

  const imagenes = await Promise.all(
    archivos.map(async (archivo) => ({
      inlineData: {
        mimeType: archivo.type || "application/pdf",
        data: Buffer.from(await archivo.arrayBuffer()).toString("base64"),
      },
    })),
  );

  const prompt = `Eres un lector de cabeceras de actas de Futgal.
Lee el documento (puede llegar como varias capturas de la misma acta) y extrae SOLO los siguientes campos del encabezado. Devuelve SOLO JSON válido, sin markdown:
{
  "jornada": 30,
  "localTeam": "U.D. SANTISO F.C.",
  "visitorTeam": "C.F. CAÑIZA",
  "categoria": "Senior",
  "competicion": "TERCEIRA FUTGAL (GRUPO 3)",
  "fecha": "2026-05-31"
}

Reglas:
- categoria debe ser exactamente "Senior" o "Veteranos":
    Si el título contiene "VETERAN" → "Veteranos"
    En otro caso → "Senior"
- jornada: número entero
- localTeam y visitorTeam: nombres exactos como aparecen en el acta (equipo LOCAL a la izquierda, VISITANTE a la derecha)
- fecha: formato YYYY-MM-DD
- competicion: texto exacto de la competición tal como aparece
- Si son capturas de la app de la federación: en la cabecera el LOCAL es el escudo de la izquierda y el VISITANTE el de la derecha; la fecha viene como DD-MM-YYYY y la jornada como "Jornada 2". Si ninguna captura muestra la cabecera, devuelve jornada null.`;

  const detectModels = ["gemini-3.1-flash-lite", "gemini-2.5-flash-lite"];
  const requestBody = JSON.stringify({
    generationConfig: { temperature: 0, responseMimeType: "application/json" },
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          ...imagenes,
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
