/** Nombre de la cookie de sesión. */
export const COOKIE_SESION = "santiso_sesion";

/**
 * El acceso con usuario y contraseña solo se enciende con `STUDIO_ACCESO=1`, que lleva la copia
 * de uso diario (la que sale por Tailscale). En desarrollo y en las pruebas no se pide nada.
 */
export function accesoActivo(): boolean {
  return process.env.STUDIO_ACCESO === "1";
}
