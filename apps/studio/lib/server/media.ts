import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DIR_MEDIA } from "@santiso/db";
import sharp from "sharp";
import { exito, fallo, type Resultado } from "@/lib/resultado";

export type CarpetaMedia = "escudos" | "jugadores" | "staff" | "sponsors" | "cartel";

const TIPOS_MEDIA: Readonly<Record<string, string>> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

const MAX_BYTES_IMAGEN = 15 * 1024 * 1024;
const LADO_MAXIMO = 1200;
const UMBRAL_ALFA = 15;
const MARGEN = 0.05;
const TRANSPARENTE = { r: 0, g: 0, b: 0, alpha: 0 };

/**
 * Ruta absoluta de una clave de media, o `null` si la clave no es segura.
 * Cada segmento debe ser un nombre simple: sin separadores, sin `.`/`..`, sin unidad de Windows
 * (`C:`) y sin byte nulo. Además, el resultado debe quedar dentro de la raíz.
 */
export function resolverRutaMedia(segmentos: readonly string[], raiz = DIR_MEDIA): string | null {
  if (segmentos.length === 0) return null;
  const inseguro = (segmento: string) =>
    segmento === "" || segmento === "." || segmento === ".." || /[\\/:\0]/.test(segmento);
  if (segmentos.some(inseguro)) return null;
  const ruta = path.resolve(raiz, ...segmentos);
  const relativa = path.relative(raiz, ruta);
  if (relativa === "" || relativa.startsWith("..") || path.isAbsolute(relativa)) return null;
  return ruta;
}

/** Tipo MIME de los ficheros que se sirven; `null` para cualquier otro. SVG queda fuera a propósito. */
export const tipoMedia = (ruta: string): string | null =>
  TIPOS_MEDIA[path.extname(ruta).toLowerCase()] ?? null;

/**
 * Normaliza una imagen y la guarda en `<raiz>/<carpeta>/<uuid>.webp`. Devuelve la clave relativa.
 * Mismo resultado que el antiguo proceso del navegador: recorta los bordes transparentes
 * (alfa > 15), la centra en un cuadrado con un 5 % de margen transparente y la reduce a un
 * máximo de 1200 px en WebP.
 */
export async function guardarImagen(
  bytes: Uint8Array,
  carpeta: CarpetaMedia,
  raiz = DIR_MEDIA,
): Promise<string> {
  const { data, info } = await sharp(bytes)
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((data[(y * width + x) * channels + 3] ?? 0) > UMBRAL_ALFA) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  let imagen = sharp(data, { raw: { width, height, channels } });
  if (maxX >= minX && maxY >= minY) {
    const ancho = maxX - minX + 1;
    const alto = maxY - minY + 1;
    const lado = Math.max(ancho, alto) + 2 * Math.floor(Math.max(ancho, alto) * MARGEN);
    const izquierda = Math.floor((lado - ancho) / 2);
    const arriba = Math.floor((lado - alto) / 2);
    // Se materializa el cuadrado antes de redimensionar: sharp aplica `extend` después de `resize`.
    const cuadrada = await imagen
      .extract({ left: minX, top: minY, width: ancho, height: alto })
      .extend({
        left: izquierda,
        right: lado - ancho - izquierda,
        top: arriba,
        bottom: lado - alto - arriba,
        background: TRANSPARENTE,
      })
      .raw()
      .toBuffer({ resolveWithObject: true });
    imagen = sharp(cuadrada.data, {
      raw: {
        width: cuadrada.info.width,
        height: cuadrada.info.height,
        channels: cuadrada.info.channels,
      },
    });
  }

  const salida = await imagen
    .resize(LADO_MAXIMO, LADO_MAXIMO, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  const clave = `${carpeta}/${randomUUID()}.webp`;
  await mkdir(path.join(raiz, carpeta), { recursive: true });
  await writeFile(path.join(raiz, clave), salida);
  return clave;
}

/** Extrae y valida la imagen de un campo de formulario enviado a una acción de servidor. */
export async function leerImagenDeFormulario(
  formulario: FormData,
  campo: string,
): Promise<Resultado<Uint8Array>> {
  const valor = formulario.get(campo);
  if (!(valor instanceof File) || valor.size === 0) return fallo("Selecciona una imagen.");
  if (!valor.type.startsWith("image/")) return fallo("El fichero debe ser una imagen.");
  if (valor.size > MAX_BYTES_IMAGEN) return fallo("La imagen supera los 15 MB.");
  return exito(new Uint8Array(await valor.arrayBuffer()));
}
