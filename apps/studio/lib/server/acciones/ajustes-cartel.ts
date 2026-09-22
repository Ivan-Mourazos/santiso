"use server";

import { schema } from "@santiso/db";
import { type ClaveAjuste, esClaveAjuste, esValorDe, ORDENES_LOGOS } from "@santiso/domain";
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

