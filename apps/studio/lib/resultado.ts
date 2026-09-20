import type { z } from "zod";

/** Salida de toda acción de servidor: nunca lanza hacia el cliente. */
export type Resultado<T> =
  { ok: true; datos: T } | { ok: false; error: string; campos?: Record<string, string> };

export type Fallo = Extract<Resultado<unknown>, { ok: false }>;

export const exito = <T>(datos: T): Resultado<T> => ({ ok: true, datos });

export const fallo = (error: string, campos?: Record<string, string>): Fallo =>
  campos ? { ok: false, error, campos } : { ok: false, error };

/** Valida la entrada de una acción. De cada campo se devuelve el primer mensaje, con su ruta. */
export function validar<T>(esquema: z.ZodType<T>, entrada: unknown): Resultado<T> {
  const resultado = esquema.safeParse(entrada);
  if (resultado.success) return exito(resultado.data);
  const campos: Record<string, string> = {};
  for (const problema of resultado.error.issues) {
    const campo = problema.path.map(String).join(".") || "_";
    campos[campo] ??= problema.message;
  }
  return fallo("Revisa los datos del formulario.", campos);
}

/** Ejecuta una operación de servidor y convierte cualquier excepción en un fallo con mensaje para el usuario. */
export async function capturar<T>(
  mensajeError: string,
  operacion: () => Promise<T>,
): Promise<Resultado<T>> {
  try {
    return exito(await operacion());
  } catch (error) {
    console.error(mensajeError, error);
    return fallo(mensajeError);
  }
}
