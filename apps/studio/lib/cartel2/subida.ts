/** Lado mayor de una foto subida: el del cartel exportado (1080 px a doble resolución). */
const LADO_MAXIMO = 2160;

function leerEntera(fichero: Blob): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result));
    lector.onerror = () => rechazar(new Error("No se pudo leer la foto."));
    lector.readAsDataURL(fichero);
  });
}

/**
 * Prepara una foto subida a mano para el cartel: la reduce al tamaño que de verdad se imprime
 * y la devuelve como `data:` (lo que abre el Chromium de la exportación). Así una foto del
 * móvil de 10 o 20 MB no desborda la petición. Si el navegador no puede redibujarla, va entera.
 */
export async function prepararFotoSubida(fichero: File): Promise<string> {
  if (!fichero.type.startsWith("image/")) throw new Error("Elige una imagen.");
  try {
    const imagen = await createImageBitmap(fichero, { imageOrientation: "from-image" });
    const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(imagen.width * escala);
    lienzo.height = Math.round(imagen.height * escala);
    const contexto = lienzo.getContext("2d");
    if (!contexto) throw new Error("sin lienzo");
    contexto.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    imagen.close();
    // Un PNG con transparencia (jugador recortado) debe seguir siéndolo.
    const conAlfa = fichero.type === "image/png" || fichero.type === "image/webp";
    return lienzo.toDataURL(conAlfa ? "image/png" : "image/jpeg", 0.9);
  } catch {
    return leerEntera(fichero);
  }
}
