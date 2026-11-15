/** Descarga cada fichero como si se pulsara un enlace (en el PC, a Descargas). */
export function descargarArchivos(archivos: File[]) {
  for (const archivo of archivos) {
    const url = URL.createObjectURL(archivo);
    const a = document.createElement("a");
    a.href = url;
    a.download = archivo.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/**
 * Abre la hoja de compartir del sistema con todos los ficheros juntos (un carrusel en
 * Instagram); donde no se puede, los descarga. Cancelar la hoja no es un fallo.
 */
export async function compartirArchivos(
  archivos: File[],
  titulo: string,
  texto: string,
): Promise<"compartido" | "descargado" | "cancelado"> {
  try {
    if (navigator.share && navigator.canShare?.({ files: archivos })) {
      await navigator.share({ files: archivos, title: titulo, text: texto });
      return "compartido";
    }
    descargarArchivos(archivos);
    return "descargado";
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return "cancelado";
    descargarArchivos(archivos);
    return "descargado";
  }
}
