"use server";

import { crearFreno } from "@/lib/acceso/intentos";
import { exito, fallo, type Resultado } from "@/lib/resultado";
import {
  abrirSesion,
  cerrarSesion,
  ErrorDeAcceso,
  exigirAdmin,
  sesionActual,
  usuarioActual,
} from "@/lib/server/acceso/sesion";
import {
  activarUsuario,
  cambiarClave,
  comprobarCredenciales,
  crearUsuario,
  ErrorDeUsuario,
  hayUsuarios,
  listarUsuarios,
  type Rol,
  type UsuarioDto,
} from "@/lib/server/acceso/usuarios";
import { obtenerDb, obtenerDbSinControl } from "@/lib/server/db";

declare global {
  var santisoFrenoAcceso: ReturnType<typeof crearFreno> | undefined;
}
const freno = (globalThis.santisoFrenoAcceso ??= crearFreno());

/** Los errores con mensaje para el usuario salen tal cual; el resto, con uno genérico. */
async function intentar<T>(mensaje: string, operacion: () => Promise<T>): Promise<Resultado<T>> {
  try {
    return exito(await operacion());
  } catch (error) {
    if (error instanceof ErrorDeUsuario || error instanceof ErrorDeAcceso) {
      return fallo(error.message);
    }
    console.error(mensaje, error);
    return fallo(mensaje);
  }
}

/** Entra con usuario y contraseña. Es pública: no pasa por el control de acceso. */
export async function entrar(usuario: string, clave: string): Promise<Resultado<null>> {
  const quien = usuario.trim().toLowerCase();
  if (!quien || !clave) return fallo("Escribe tu usuario y tu contraseña.");
  const espera = freno.espera(quien);
  if (espera > 0) {
    return fallo(
      `Demasiados intentos. Espera ${Math.ceil(espera / 60_000)} min y vuelve a probar.`,
    );
  }
  return intentar("No se pudo entrar. Vuelve a intentarlo.", async () => {
    const { db } = await obtenerDbSinControl();
    const encontrado = await comprobarCredenciales(db, quien, clave);
    if (!encontrado) {
      freno.fallo(quien);
      // Sin decir cuál de las dos cosas falla.
      throw new ErrorDeUsuario("Usuario o contraseña incorrectos.");
    }
    freno.acierto(quien);
    await abrirSesion(encontrado.id);
    return null;
  });
}

/**
 * Crea el administrador la primera vez. Es pública, pero solo funciona mientras no exista
 * ningún usuario: en cuanto hay uno, deja de servir.
 */
export async function crearPrimerAdministrador(entrada: {
  usuario: string;
  nombre: string;
  clave: string;
}): Promise<Resultado<null>> {
  return intentar("No se pudo crear el administrador.", async () => {
    const { db } = await obtenerDbSinControl();
    if (await hayUsuarios(db)) throw new ErrorDeUsuario("Ya hay un administrador. Entra con él.");
    const creado = await crearUsuario(db, { ...entrada, rol: "admin" });
    await abrirSesion(creado.id);
    return null;
  });
}

export async function salir(): Promise<Resultado<null>> {
  return intentar("No se pudo cerrar la sesión.", async () => {
    await cerrarSesion();
    return null;
  });
}

export async function cargarUsuarios(): Promise<Resultado<UsuarioDto[]>> {
  return intentar("No se pudieron cargar los usuarios.", async () => {
    await exigirAdmin();
    const { db } = await obtenerDb();
    return listarUsuarios(db);
  });
}

export async function crearUsuarioNuevo(entrada: {
  usuario: string;
  nombre: string;
  rol: Rol;
  clave: string;
}): Promise<Resultado<UsuarioDto>> {
  return intentar("No se pudo crear el usuario.", async () => {
    await exigirAdmin();
    if (entrada.rol !== "admin" && entrada.rol !== "tecnico") {
      throw new ErrorDeUsuario("Ese tipo de usuario no existe.");
    }
    const { db } = await obtenerDb();
    return crearUsuario(db, entrada);
  });
}

/** El administrador pone una contraseña nueva a otro: le cierra todas las sesiones. */
export async function ponerClave(usuarioId: string, clave: string): Promise<Resultado<null>> {
  return intentar("No se pudo cambiar la contraseña.", async () => {
    await exigirAdmin();
    const { db } = await obtenerDb();
    const yo = await usuarioActual();
    await cambiarClave(db, usuarioId, clave, yo?.id === usuarioId ? await sesionActual() : undefined);
    return null;
  });
}

export async function darAcceso(usuarioId: string, activo: boolean): Promise<Resultado<null>> {
  return intentar("No se pudo cambiar el acceso.", async () => {
    await exigirAdmin();
    const yo = await usuarioActual();
    if (!activo && yo?.id === usuarioId) {
      throw new ErrorDeUsuario("No puedes quitarte el acceso a ti mismo.");
    }
    const { db } = await obtenerDb();
    await activarUsuario(db, usuarioId, activo);
    return null;
  });
}

/** Cada uno se cambia la suya, dando antes la actual. */
export async function cambiarMiClave(actual: string, nueva: string): Promise<Resultado<null>> {
  return intentar("No se pudo cambiar la contraseña.", async () => {
    const yo = await usuarioActual();
    if (!yo?.id) throw new ErrorDeAcceso("Hay que entrar con usuario y contraseña.");
    const { db } = await obtenerDb();
    if (!(await comprobarCredenciales(db, yo.usuario, actual))) {
      throw new ErrorDeUsuario("La contraseña actual no es esa.");
    }
    await cambiarClave(db, yo.id, nueva, await sesionActual());
    return null;
  });
}
