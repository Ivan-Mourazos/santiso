import "server-only";

import { schema } from "@santiso/db";
import { and, eq, gt, lt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { huellaDeToken, nuevoToken } from "@/lib/acceso/claves";
import { COOKIE_SESION, accesoActivo } from "@/lib/acceso/config";
import { enSistema, obtenerDbSinControl } from "@/lib/server/db";

export type Rol = (typeof schema.ROLES_USUARIO)[number];

export interface UsuarioSesion {
  id: string;
  usuario: string;
  nombre: string;
  rol: Rol;
}

/** Con el acceso apagado (desarrollo y pruebas) todo se hace como este administrador. */
const SIN_ACCESO: UsuarioSesion = { id: "", usuario: "local", nombre: "Local", rol: "admin" };

const DIAS_SESION = 30;

/** Se lanza cuando alguien sin sesión, o sin permiso, intenta algo. */
export class ErrorDeAcceso extends Error {}

/**
 * Quién hace la petición. `null` si no hay sesión válida. Una consulta por petición, aunque se
 * pregunte muchas veces.
 */
export const usuarioActual = cache(async (): Promise<UsuarioSesion | null> => {
  if (!accesoActivo()) return SIN_ACCESO;
  let token: string | undefined;
  try {
    token = (await cookies()).get(COOKIE_SESION)?.value;
  } catch {
    // Fuera de una petición (una tarea del propio servidor) no hay cookies ni usuario.
    return null;
  }
  if (!token) return null;
  const { db } = await obtenerDbSinControl();
  const [fila] = await db
    .select({
      id: schema.usuarios.id,
      usuario: schema.usuarios.usuario,
      nombre: schema.usuarios.nombre,
      rol: schema.usuarios.rol,
    })
    .from(schema.sesiones)
    .innerJoin(schema.usuarios, eq(schema.usuarios.id, schema.sesiones.usuarioId))
    .where(
      and(
        eq(schema.sesiones.id, huellaDeToken(token)),
        gt(schema.sesiones.expiraEn, new Date().toISOString()),
        eq(schema.usuarios.activo, true),
      ),
    );
  return fila ?? null;
});

/** Identificador (huella) de la sesión de quien hace la petición, si trae cookie. */
export async function sesionActual(): Promise<string | undefined> {
  const token = (await cookies()).get(COOKIE_SESION)?.value;
  return token ? huellaDeToken(token) : undefined;
}

/** Lo que protege la base de datos: sin sesión válida no se abre. */
export async function comprobarAcceso(): Promise<void> {
  if (!accesoActivo() || enSistema()) return;
  if (!(await usuarioActual())) throw new ErrorDeAcceso("Hay que entrar con usuario y contraseña.");
}

/** Para lo que solo puede hacer el administrador. */
export async function exigirAdmin(): Promise<void> {
  if (!accesoActivo() || enSistema()) return;
  const usuario = await usuarioActual();
  if (!usuario) throw new ErrorDeAcceso("Hay que entrar con usuario y contraseña.");
  if (usuario.rol !== "admin") throw new ErrorDeAcceso("Solo el administrador puede hacer eso.");
}

/** Abre sesión para un usuario y deja la cookie puesta. */
export async function abrirSesion(usuarioId: string): Promise<void> {
  const token = nuevoToken();
  const expira = new Date(Date.now() + DIAS_SESION * 86_400_000);
  const { db } = await obtenerDbSinControl();
  // De paso se limpian las caducadas: nadie más lo hace.
  await db.delete(schema.sesiones).where(lt(schema.sesiones.expiraEn, new Date().toISOString()));
  await db
    .insert(schema.sesiones)
    .values({ id: huellaDeToken(token), usuarioId, expiraEn: expira.toISOString() });
  // Por Tailscale llega por HTTPS; en el propio ordenador, por HTTP a 127.0.0.1.
  const https = (await headers()).get("x-forwarded-proto") === "https";
  (await cookies()).set(COOKIE_SESION, token, {
    httpOnly: true,
    secure: https,
    sameSite: "lax",
    path: "/",
    expires: expira,
  });
}

/** Cierra la sesión de quien hace la petición. */
export async function cerrarSesion(): Promise<void> {
  const almacen = await cookies();
  const token = almacen.get(COOKIE_SESION)?.value;
  if (token) {
    const { db } = await obtenerDbSinControl();
    await db.delete(schema.sesiones).where(eq(schema.sesiones.id, huellaDeToken(token)));
  }
  almacen.delete(COOKIE_SESION);
}

/** Para las rutas de `app/api` y `app/media`: la respuesta 401 si no hay sesión; si la hay, `null`. */
export async function respuestaSinSesion(): Promise<Response | null> {
  if (!accesoActivo() || (await usuarioActual())) return null;
  return Response.json({ error: "Hay que entrar con usuario y contraseña." }, { status: 401 });
}
