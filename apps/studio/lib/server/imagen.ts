import "server-only";
import { exito, fallo, type Resultado } from "@/lib/resultado";
import { type CarpetaMedia, guardarImagen, leerImagenDeFormulario } from "@/lib/server/media";

/**
 * Guarda la imagen de un campo de formulario, si la hay.
 * Devuelve la clave relativa, o `null` cuando el campo viene vacío: en los formularios de
 * edición eso significa «no cambies la imagen actual», que es distinto de un fichero inválido.
 * `raiz` solo se usa en las pruebas; en producción se guarda en `data/media`.
 */
export async function guardarImagenOpcional(
  formulario: FormData,
  campo: string,
  carpeta: CarpetaMedia,
  raiz?: string,
): Promise<Resultado<string | null>> {
  const valor = formulario.get(campo);
  if (!(valor instanceof File) || valor.size === 0) return exito(null);

  const leida = await leerImagenDeFormulario(formulario, campo);
  if (!leida.ok) return leida;

  try {
    return exito(await guardarImagen(leida.datos, carpeta, raiz));
  } catch (error) {
    console.error("guardarImagenOpcional", error);
    return fallo("No se pudo procesar la imagen. Comprueba que el fichero es una imagen válida.");
  }
}
