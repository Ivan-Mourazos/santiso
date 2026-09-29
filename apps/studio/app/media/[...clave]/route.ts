import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { resolverRutaMedia, tipoMedia, varianteDeImagen } from "@/lib/server/media";

const noEncontrado = () => new Response("No encontrado", { status: 404 });

const esFicheroInexistente = (error: unknown) =>
  error instanceof Error && "code" in error && (error.code === "ENOENT" || error.code === "EISDIR");

/**
 * Sirve `data/media/<clave>`. Revalida también claves heredadas que conservan el nombre tras una restauración.
 * Con `?recorte=1` devuelve la imagen recortada a su contenido (PNG): los logos se guardan
 * centrados en un cuadrado con margen, y en un cartel un logo ancho se veía diminuto.
 * Con `?ancho=N`, una versión reducida en WebP (ver `ANCHOS_VARIANTE`): las fotos de partido
 * se guardan grandes y la vista previa no necesita cargarlas enteras.
 */
export async function GET(
  solicitud: Request,
  { params }: { params: Promise<{ clave: string[] }> },
) {
  const { clave } = await params;
  const ruta = resolverRutaMedia(clave);
  const tipo = ruta ? tipoMedia(ruta) : null;
  if (!ruta || !tipo) return noEncontrado();
  try {
    const contenido = await readFile(ruta);
    const parametros = new URL(solicitud.url).searchParams;
    const ancho = Number(parametros.get("ancho"));
    if (ancho > 0) {
      const variante = await varianteDeImagen(contenido, ancho);
      return new Response(new Uint8Array(variante), {
        headers: { "Content-Type": "image/webp", "Cache-Control": "no-cache" },
      });
    }
    if (parametros.has("recorte")) {
      const recortada = await sharp(contenido).trim().png().toBuffer();
      return new Response(new Uint8Array(recortada), {
        headers: { "Content-Type": "image/png", "Cache-Control": "no-cache" },
      });
    }
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
