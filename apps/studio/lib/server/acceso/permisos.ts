import "server-only";

import { accesoActivo } from "@/lib/acceso/config";
import { fallo, type Fallo } from "@/lib/resultado";
import { enSistema } from "@/lib/server/db";

/**
 * Para las acciones que solo puede hacer el administrador (temporadas, competiciones, ajustes,
 * borrar equipos): el fallo que hay que devolver si quien la pide no lo es; si lo es, `null`.
 */
export async function soloAdmin(): Promise<Fallo | null> {
  if (!accesoActivo() || enSistema()) return null;
  // Importado aquí: `next/headers` solo existe dentro del servidor de Next, no en las pruebas.
  const { usuarioActual } = await import("./sesion");
  const usuario = await usuarioActual();
  if (!usuario) return fallo("Hay que entrar con usuario y contraseña.");
  return usuario.rol === "admin" ? null : fallo("Solo el administrador puede hacer eso.");
}
