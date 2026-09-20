"use client";

/**
 * Prepara una imagen antes de enviarla al servidor. Solo convierte HEIC (iPhone) a JPEG:
 * el `sharp` precompilado no decodifica HEVC, así que esa conversión tiene que ocurrir aquí.
 * El recorte, el cuadrado y la compresión a WebP los hace el servidor en `guardarImagen`.
 */
export async function prepararImagen(fichero: File): Promise<File> {
  const esHeic =
    fichero.type === "image/heic" ||
    fichero.type === "image/heif" ||
    /\.hei[cf]$/i.test(fichero.name);
  if (!esHeic) return fichero;

  const heic2any = (await import("heic2any")).default;
  const convertido = await heic2any({ blob: fichero, toType: "image/jpeg", quality: 0.92 });
  const blob = Array.isArray(convertido) ? convertido[0] : convertido;
  if (!blob) return fichero;
  return new File([blob], fichero.name.replace(/\.[^/.]+$/, ".jpg"), { type: "image/jpeg" });
}
