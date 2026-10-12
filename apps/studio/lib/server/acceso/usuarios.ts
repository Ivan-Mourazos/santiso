import "server-only";

import { type ConexionDb, schema } from "@santiso/db";
import { and, asc, count, eq, ne } from "drizzle-orm";
import {
  claveCorrecta,
  errorDeClave,
  errorDeUsuario,
  hashDeClave,
  normalizarUsuario,
} from "@/lib/acceso/claves";

type Db = ConexionDb["db"];
export type Rol = (typeof schema.ROLES_USUARIO)[number];

export interface UsuarioDto {
  id: string;
  usuario: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
}

/** Error con un mensaje que se puede enseñar tal cual a quien usa la pantalla. */
export class ErrorDeUsuario extends Error {}

const columnas = {
  id: schema.usuarios.id,
  usuario: schema.usuarios.usuario,
  nombre: schema.usuarios.nombre,
  rol: schema.usuarios.rol,
  activo: schema.usuarios.activo,
};

export async function hayUsuarios(db: Db): Promise<boolean> {
  const [fila] = await db.select({ total: count() }).from(schema.usuarios);
  return (fila?.total ?? 0) > 0;
}

export function listarUsuarios(db: Db): Promise<UsuarioDto[]> {
  return db.select(columnas).from(schema.usuarios).orderBy(asc(schema.usuarios.nombre));
}

export async function crearUsuario(
  db: Db,
  entrada: { usuario: string; nombre: string; rol: Rol; clave: string },
): Promise<UsuarioDto> {
  const usuario = normalizarUsuario(entrada.usuario);
  const nombre = entrada.nombre.trim();
  const problema = errorDeUsuario(usuario) ?? errorDeClave(entrada.clave);
  if (problema) throw new ErrorDeUsuario(problema);
  if (!nombre) throw new ErrorDeUsuario("Falta el nombre.");
  const [repetido] = await db
    .select({ id: schema.usuarios.id })
    .from(schema.usuarios)
    .where(eq(schema.usuarios.usuario, usuario));
  if (repetido) throw new ErrorDeUsuario("Ya hay alguien con ese usuario.");
  const [creado] = await db
    .insert(schema.usuarios)
    .values({ usuario, nombre, rol: entrada.rol, claveHash: await hashDeClave(entrada.clave) })
    .returning(columnas);
  if (!creado) throw new Error("La inserción no devolvió ninguna fila");
  return creado;
}

// Se comprueba una contraseña aunque el usuario no exista: así responder tarda lo mismo y no
// se puede averiguar qué usuarios hay midiendo el tiempo.
const HASH_DE_RELLENO = hashDeClave("relleno-para-usuarios-que-no-existen");

/** El usuario si las credenciales valen y está activo; `null` en cualquier otro caso. */
export async function comprobarCredenciales(
  db: Db,
  usuario: string,
  clave: string,
): Promise<UsuarioDto | null> {
  const [fila] = await db
    .select({ ...columnas, claveHash: schema.usuarios.claveHash })
    .from(schema.usuarios)
    .where(eq(schema.usuarios.usuario, normalizarUsuario(usuario)));
  const buena = await claveCorrecta(clave, fila?.claveHash ?? (await HASH_DE_RELLENO));
  if (!fila || !buena || !fila.activo) return null;
  return { id: fila.id, usuario: fila.usuario, nombre: fila.nombre, rol: fila.rol, activo: true };
}

/**
 * Cambia la contraseña y cierra las sesiones abiertas de ese usuario, salvo `conservarSesion`
 * (la de quien se cambia la suya): si se cambia porque alguien la sabía, deja de servirle.
 */
export async function cambiarClave(
  db: Db,
  usuarioId: string,
  clave: string,
  conservarSesion?: string,
): Promise<void> {
  const problema = errorDeClave(clave);
  if (problema) throw new ErrorDeUsuario(problema);
  const cambiados = await db
    .update(schema.usuarios)
    .set({ claveHash: await hashDeClave(clave) })
    .where(eq(schema.usuarios.id, usuarioId))
    .returning({ id: schema.usuarios.id });
  if (!cambiados.length) throw new ErrorDeUsuario("Ese usuario ya no existe.");
  await db
    .delete(schema.sesiones)
    .where(
      conservarSesion
        ? and(eq(schema.sesiones.usuarioId, usuarioId), ne(schema.sesiones.id, conservarSesion))
        : eq(schema.sesiones.usuarioId, usuarioId),
    );
}

/** Da o quita el acceso. Quitarlo cierra sus sesiones. Siempre queda un administrador activo. */
export async function activarUsuario(db: Db, usuarioId: string, activo: boolean): Promise<void> {
  const [actual] = await db
    .select(columnas)
    .from(schema.usuarios)
    .where(eq(schema.usuarios.id, usuarioId));
  if (!actual) throw new ErrorDeUsuario("Ese usuario ya no existe.");
  if (!activo && actual.rol === "admin") {
    const [otros] = await db
      .select({ total: count() })
      .from(schema.usuarios)
      .where(
        and(
          eq(schema.usuarios.rol, "admin"),
          eq(schema.usuarios.activo, true),
          ne(schema.usuarios.id, usuarioId),
        ),
      );
    if (!otros?.total) throw new ErrorDeUsuario("Tiene que quedar un administrador con acceso.");
  }
  await db.update(schema.usuarios).set({ activo }).where(eq(schema.usuarios.id, usuarioId));
  if (!activo) await db.delete(schema.sesiones).where(eq(schema.sesiones.usuarioId, usuarioId));
}
