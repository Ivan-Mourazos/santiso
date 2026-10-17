import "server-only";

declare global {
  // Compartido por acciones, programador y recargas del servidor en desarrollo.
  var santisoRedRfgfEnMarcha: boolean | undefined;
}

export const AVISO_RFGF_OCUPADA =
  "Ya hay una operación con la federación en marcha. Espera a que termine.";

/** Reserva toda la operación, sin esperar ni encolar. `null` significa que no llegó a empezar. */
export async function conCandadoRfgf<T>(operacion: () => Promise<T>): Promise<T | null> {
  if (globalThis.santisoRedRfgfEnMarcha) return null;
  globalThis.santisoRedRfgfEnMarcha = true;
  try {
    return await operacion();
  } finally {
    globalThis.santisoRedRfgfEnMarcha = false;
  }
}
