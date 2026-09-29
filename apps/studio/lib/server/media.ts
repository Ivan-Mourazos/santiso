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
/**
 * Fotos de personas: en «O noso 11» el jugador ocupa casi todo el alto del cartel, que se
 * exporta a 2700 px. Con 1200 px se veía ampliada y blanda.
 */
const LADO_MAXIMO_FOTOS = 2400;
const ladoMaximo = (carpeta: CarpetaMedia) =>
  carpeta === "jugadores" || carpeta === "staff" ? LADO_MAXIMO_FOTOS : LADO_MAXIMO;
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
 * máximo de 1200 px en WebP (2400 px las fotos de jugadores y staff).
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
    .resize(ladoMaximo(carpeta), ladoMaximo(carpeta), {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer();

  const clave = `${carpeta}/${randomUUID()}.webp`;
  await mkdir(path.join(raiz, carpeta), { recursive: true });
  await writeFile(path.join(raiz, clave), salida);
  return clave;
}

/** Lado mayor de las fotos de partido: el cartel se exporta a 2160 × 2700 y se recorta. */
const LADO_MAXIMO_PARTIDO = 3000;
/** Proporción del cartel (4:5): el foco se busca para ese recorte. */
const PROPORCION_CARTEL = 4 / 5;

export interface FotoGuardada {
  clave: string;
  ancho: number;
  alto: number;
  /** Punto de interés (0–1) según el recorte automático de sharp («attention»). */
  focoX: number;
  focoY: number;
}

/**
 * Punto de interés de una foto para un recorte 4:5: sharp elige la ventana con más «atención»
 * (piel, contraste, saturación) y el foco es su centro. En el eje que no se recorta queda al
 * centro (0,5) o, en vertical sin recorte, algo por encima (0,4), donde suelen ir las caras.
 */
export async function focoDeFoto(bytes: Uint8Array): Promise<{ focoX: number; focoY: number }> {
  const muestra = await sharp(bytes)
    .rotate()
    .resize(480, 480, { fit: "inside" })
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = muestra.info;
  const horizontal = w / h > PROPORCION_CARTEL;
  const ventana = horizontal
    ? { width: Math.max(1, Math.round(h * PROPORCION_CARTEL)), height: h }
    : { width: w, height: Math.max(1, Math.round(w / PROPORCION_CARTEL)) };
  if (ventana.width >= w && ventana.height >= h) return { focoX: 0.5, focoY: 0.4 };
  const { info } = await sharp(muestra.data)
    .resize({ ...ventana, fit: "cover", position: sharp.strategy.attention })
    .toBuffer({ resolveWithObject: true });
  const izquierda = Math.abs(info.cropOffsetLeft ?? 0);
  const arriba = Math.abs(info.cropOffsetTop ?? 0);
  const limitar = (v: number) => Math.min(1, Math.max(0, Math.round(v * 1000) / 1000));
  return horizontal
    ? { focoX: limitar((izquierda + ventana.width / 2) / w), focoY: 0.5 }
    : { focoX: 0.5, focoY: limitar((arriba + ventana.height / 2) / h) };
}

/**
 * Foto de un partido: sin recortar ni añadir margen (es una foto, no un logo), orientada según
 * su EXIF, reducida a 3000 px de lado mayor y en WebP de buena calidad. Devuelve su foco.
 */
export async function guardarFotoPartido(
  bytes: Uint8Array,
  raiz = DIR_MEDIA,
): Promise<FotoGuardada> {
  const { data, info } = await sharp(bytes)
    .rotate()
    .resize(LADO_MAXIMO_PARTIDO, LADO_MAXIMO_PARTIDO, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 88 })
    .toBuffer({ resolveWithObject: true });
  const foco = await focoDeFoto(bytes);
  const clave = `partidos/${randomUUID()}.webp`;
  await mkdir(path.join(raiz, "partidos"), { recursive: true });
  await writeFile(path.join(raiz, clave), data);
  return { clave, ancho: info.width, alto: info.height, ...foco };
}

/**
 * Anchos que sirve `/media/...?ancho=`: vista previa pequeña, cartel a 1× y a 2× (exportación).
 * Una lista cerrada: cualquier otro ancho pedido se sube al siguiente de la lista.
 */
export const ANCHOS_VARIANTE = [480, 1080, 2160] as const;

export function anchoDeVariante(pedido: number): number {
  return ANCHOS_VARIANTE.find((a) => a >= pedido) ?? ANCHOS_VARIANTE[ANCHOS_VARIANTE.length - 1];
}

/** La imagen reducida a `ancho` (sin ampliar), en WebP. */
export async function varianteDeImagen(contenido: Uint8Array, ancho: number): Promise<Buffer> {
  return await sharp(contenido)
    .resize({ width: anchoDeVariante(ancho), withoutEnlargement: true })
    .webp({ quality: 86 })
    .toBuffer();
}

/** Extrae y valida la imagen de un campo de formulario enviado a una acción de servidor. */
export async function leerImagenDeFormulario(
  formulario: FormData,
  campo: string,
): Promise<Resultado<Uint8Array>> {
  return await leerImagen(formulario.get(campo));
}

/** Valida un valor de formulario como imagen (tipo y 15 MB como mucho) y devuelve sus bytes. */
export async function leerImagen(valor: FormDataEntryValue | null): Promise<Resultado<Uint8Array>> {
  if (!(valor instanceof File) || valor.size === 0) return fallo("Selecciona una imagen.");
  if (!valor.type.startsWith("image/")) return fallo("El fichero debe ser una imagen.");
  if (valor.size > MAX_BYTES_IMAGEN) return fallo("La imagen supera los 15 MB.");
  return exito(new Uint8Array(await valor.arrayBuffer()));
}
