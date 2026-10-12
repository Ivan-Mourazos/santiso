/**
 * Mínimo de caracteres de una contraseña: vale un PIN de 4 cifras (decisión de Iván, 12/10/2026).
 * Lo compensan que solo se llega por Tailscale y el freno de intentos de `intentos.ts`.
 * Va aparte de `claves.ts`, que usa `node:crypto` y no puede ir al navegador.
 */
export const LARGO_MINIMO_CLAVE = 4;
