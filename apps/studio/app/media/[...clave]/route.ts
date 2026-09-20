import { readFile } from "node:fs/promises";
import { resolverRutaMedia, tipoMedia } from "@/lib/server/media";

const noEncontrado = () => new Response("No encontrado", { status: 404 });

const esFicheroInexistente = (error: unknown) =>
  error instanceof Error && "code" in error && (error.code === "ENOENT" || error.code === "EISDIR");

/** Sirve `data/media/<clave>`. Revalida también claves heredadas que conservan el nombre tras una restauración. */
export async function GET(
  _solicitud: Request,
  { params }: { params: Promise<{ clave: string[] }> },
) {
  const { clave } = await params;
  const ruta = resolverRutaMedia(clave);
  const tipo = ruta ? tipoMedia(ruta) : null;
  if (!ruta || !tipo) return noEncontrado();
  try {
    const contenido = await readFile(ruta);
    return new Response(new Uint8Array(contenido), {
      headers: {
        "Content-Type": tipo,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    if (esFicheroInexistente(error)) return noEncontrado();
    throw error;
  }
}
