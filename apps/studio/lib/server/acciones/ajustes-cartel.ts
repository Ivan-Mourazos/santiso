"use server";

import { schema } from "@santiso/db";
import {
  type ClaveAjuste,
  claveNombre,
  esClaveAjuste,
  esValorDe,
  ORDENES_LOGOS,
} from "@santiso/domain";
import { eq, max } from "drizzle-orm";
import type { AjustesCartelDto } from "@/lib/dto";
import { urlMedia } from "@/lib/media";
import { capturar, exito, fallo, type Resultado } from "@/lib/resultado";
import { leerAjuste } from "@/lib/server/consultas/ajustes";
import { listarPatrocinadores } from "@/lib/server/consultas/patrocinadores";
import { obtenerDb } from "@/lib/server/db";
import { guardarImagenOpcional } from "@/lib/server/imagen";

const ORDEN_POR_DEFECTO = "xunta_izquierda";

/** Escribe un ajuste global, creándolo si no existía. */
async function escribirAjuste(clave: ClaveAjuste, valor: unknown): Promise<void> {
  const { db } = await obtenerDb();
  await db
    .insert(schema.ajustes)
    .values({ id: clave, valor })
    .onConflictDoUpdate({ target: schema.ajustes.id, set: { valor } });
}

/**
 * Todo lo que pinta la pantalla del generador, en una sola acción: Next despacha las acciones
 * del cliente de una en una, así que cinco llamadas serían cinco viajes en serie.
 */
export async function cargarAjustesCartel(): Promise<Resultado<AjustesCartelDto>> {
  return capturar("No se pudieron cargar los ajustes de carteles.", async () => {
    const [escudo, xunta, rfgf, orden, patrocinadores] = await Promise.all([
      leerAjuste("club.escudo"),
      leerAjuste("cartel.logo_xunta"),
      leerAjuste("cartel.logo_rfgf"),
      leerAjuste("cartel.orden_logos"),
      listarPatrocinadores(true),
    ]);
    return {
      escudoClub: escudo ? urlMedia(escudo) : null,
      logoXunta: xunta ? urlMedia(xunta) : null,
      logoRfgf: rfgf ? urlMedia(rfgf) : null,
      ordenLogos: orden ?? ORDEN_POR_DEFECTO,
      patrocinadores,
    };
  });
}

/** Guarda una imagen y la deja apuntada en un ajuste (`club.escudo`, `cartel.logo_*`). */
export async function guardarLogoAjuste(
  clave: string,
  formulario: FormData,
): Promise<Resultado<string>> {
  if (!esClaveAjuste(clave)) return fallo("Ajuste desconocido.");
  const imagen = await guardarImagenOpcional(formulario, "imagen", "cartel");
  if (!imagen.ok) return imagen;
  if (!imagen.datos) return fallo("Selecciona una imagen.");

  const clavePendiente = imagen.datos;
  const resultado = await capturar("No se pudo guardar la imagen.", async () => {
    await escribirAjuste(clave, clavePendiente);
    return null;
  });
  return resultado.ok ? exito(urlMedia(clavePendiente)) : resultado;
}

export async function guardarOrdenLogos(orden: string): Promise<Resultado<null>> {
  if (!esValorDe(ORDENES_LOGOS, orden)) return fallo("Orden de logos desconocido.");
  const resultado = await capturar("No se pudo guardar el orden de los logos.", async () => {
    await escribirAjuste("cartel.orden_logos", orden);
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}

/**
 * Alta de un logo que se pinta en los carteles: es un patrocinador con `enCarteles`.
 *
 * **Un nombre ya usado se rechaza.** Antes se hacía `update` por clave, así que subir aquí un
 * logo con el nombre de un patrocinador del catálogo le cambiaba la imagen y lo sacaba de su
 * pantalla sin avisar. La comprobación va antes de guardar el fichero para no dejar media
 * huérfana. La 6D retira esta acción al mover la gestión al catálogo único.
 */
export async function guardarLogoPatrocinador(formulario: FormData): Promise<Resultado<null>> {
  const nombre = String(formulario.get("nombre") ?? "").trim();
  if (!nombre) return fallo("El nombre es obligatorio.", { nombre: "Obligatorio" });

  const clave = claveNombre(nombre);
  const { db } = await obtenerDb();
  const [existente] = await db
    .select({ id: schema.patrocinadores.id })
    .from(schema.patrocinadores)
    .where(eq(schema.patrocinadores.clave, clave));
  if (existente) {
    return fallo("Ya existe un patrocinador o logo con ese nombre. Edítalo desde su ficha.", {
      nombre: "Repetido",
    });
  }

  const imagen = await guardarImagenOpcional(formulario, "logo", "cartel");
  if (!imagen.ok) return imagen;
  if (!imagen.datos) return fallo("Selecciona una imagen.");

  const logo = imagen.datos;
  const resultado = await capturar("No se pudo guardar el logo.", async () => {
    const [ultimo] = await db
      .select({ orden: max(schema.patrocinadores.orden) })
      .from(schema.patrocinadores)
      .where(eq(schema.patrocinadores.enCarteles, true));
    await db
      .insert(schema.patrocinadores)
      .values({ nombre, clave, logo, enCarteles: true, orden: (ultimo?.orden ?? -1) + 1 });
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}

export async function borrarLogoPatrocinador(id: string): Promise<Resultado<null>> {
  const { db } = await obtenerDb();
  const resultado = await capturar("No se pudo borrar el logo.", async () => {
    await db.delete(schema.patrocinadores).where(eq(schema.patrocinadores.id, id));
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}

/** Intercambia el `orden` con el vecino. En los extremos no hace nada y tampoco falla. */
export async function moverLogoPatrocinador(
  id: string,
  direccion: -1 | 1,
): Promise<Resultado<null>> {
  const logos = await listarPatrocinadores(true);
  const indice = logos.findIndex((l) => l.id === id);
  const destino = indice + direccion;
  if (indice < 0 || destino < 0 || destino >= logos.length) return exito(null);

  const actual = logos[indice];
  const vecino = logos[destino];
  if (!actual || !vecino) return exito(null);

  const { db } = await obtenerDb();
  const resultado = await capturar("No se pudo reordenar los logos.", async () => {
    await db.transaction(async (tx) => {
      await tx
        .update(schema.patrocinadores)
        .set({ orden: vecino.orden })
        .where(eq(schema.patrocinadores.id, actual.id));
      await tx
        .update(schema.patrocinadores)
        .set({ orden: actual.orden })
        .where(eq(schema.patrocinadores.id, vecino.id));
    });
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}
