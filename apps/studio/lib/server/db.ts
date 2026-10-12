import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync } from "node:fs";
import { abrirDb, type ConexionDb, RUTA_BD, urlArchivo } from "@santiso/db";
import { accesoActivo } from "@/lib/acceso/config";

declare global {
  // Una conexión por proceso, guardada en globalThis para sobrevivir a la recarga en caliente.
  // `var` es obligatorio: las declaraciones globales de TypeScript no admiten let/const.
  var santisoConexionDb: Promise<ConexionDb> | undefined;
  // También en globalThis: el programador y las acciones deben compartir el mismo almacén.
  var santisoSistema: AsyncLocalStorage<true> | undefined;
}

const sistema = (globalThis.santisoSistema ??= new AsyncLocalStorage<true>());

/**
 * Ejecuta `tarea` como el propio servidor, sin usuario: las tareas programadas (federación,
 * copia diaria) no vienen de ninguna petición. Nunca debe envolver algo que pida un usuario.
 */
export function comoSistema<T>(tarea: () => Promise<T>): Promise<T> {
  return sistema.run(true, tarea);
}

/** Si lo que se está ejecutando es una tarea del propio servidor. */
export function enSistema(): boolean {
  return sistema.getStore() === true;
}

/** La conexión, sin mirar quién la pide. Solo para el propio control de acceso. */
export function obtenerDbSinControl(): Promise<ConexionDb> {
  if (!globalThis.santisoConexionDb) {
    if (!existsSync(RUTA_BD)) {
      return Promise.reject(
        new Error(`No existe la base de datos ${RUTA_BD}. Ejecuta pnpm migracion:importar.`),
      );
    }
    globalThis.santisoConexionDb = abrirDb(urlArchivo(RUTA_BD)).catch((error: unknown) => {
      globalThis.santisoConexionDb = undefined;
      throw error;
    });
  }
  return globalThis.santisoConexionDb;
}

/**
 * Conexión única a `data/santiso.db` para Server Components, acciones y route handlers.
 * Con el acceso encendido solo se entrega a quien tiene sesión: es el punto por el que pasa
 * toda lectura y escritura, así que ninguna acción queda sin proteger por descuido.
 */
export function obtenerDb(): Promise<ConexionDb> {
  if (!accesoActivo() || enSistema()) return obtenerDbSinControl();
  return conSesion();
}

async function conSesion(): Promise<ConexionDb> {
  await exigirSesion();
  return obtenerDbSinControl();
}

/**
 * Falla si quien hace la petición no ha entrado. Para lo que deja rastro fuera de la base de
 * datos (guardar una imagen en disco): las acciones de servidor se pueden llamar desde cualquier
 * página, también desde la de entrada, y no todo pasa antes por `obtenerDb`.
 */
export async function exigirSesion(): Promise<void> {
  if (!accesoActivo() || enSistema()) return;
  // Importado aquí: `next/headers` solo existe dentro del servidor de Next, no en las pruebas.
  const { comprobarAcceso } = await import("@/lib/server/acceso/sesion");
  await comprobarAcceso();
}
