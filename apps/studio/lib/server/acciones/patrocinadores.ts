"use server";

import { schema } from "@santiso/db";
import { claveNombre } from "@santiso/domain";
import { eq, max } from "drizzle-orm";
import type { PatrocinadorDto } from "@/lib/dto";
import { urlMedia } from "@/lib/media";
import { capturar, exito, fallo, type Resultado } from "@/lib/resultado";
import { listarPatrocinadores } from "@/lib/server/consultas/patrocinadores";
import { obtenerDb } from "@/lib/server/db";
import { guardarImagenOpcional } from "@/lib/server/imagen";

/** Solo los de la web; los logos de cartel se gestionan en la pantalla del generador. */
export async function cargarPatrocinadores(): Promise<PatrocinadorDto[]> {
  return listarPatrocinadores(false);
}

export async function guardarPatrocinador(
  formulario: FormData,
): Promise<Resultado<PatrocinadorDto>> {
  const id = String(formulario.get("id") ?? "").trim();
  const nombre = String(formulario.get("nombre") ?? "").trim();
  if (!nombre) return fallo("El nombre es obligatorio.", { nombre: "Obligatorio" });
  const webUrl = String(formulario.get("webUrl") ?? "").trim() || null;
  const clave = claveNombre(nombre);

  const { db } = await obtenerDb();
  const [chocante] = await db
    .select({ id: schema.patrocinadores.id })
    .from(schema.patrocinadores)
    .where(eq(schema.patrocinadores.clave, clave));
  if (chocante && chocante.id !== id) {
    return fallo("Ya existe un patrocinador con ese nombre.", { nombre: "Repetido" });
  }

  const imagen = await guardarImagenOpcional(formulario, "logo", "sponsors");
  if (!imagen.ok) return imagen;

  return capturar("No se pudo guardar el patrocinador.", async () => {
    const columnas = {
      id: schema.patrocinadores.id,
      nombre: schema.patrocinadores.nombre,
      logo: schema.patrocinadores.logo,
      webUrl: schema.patrocinadores.webUrl,
      orden: schema.patrocinadores.orden,
      enCarteles: schema.patrocinadores.enCarteles,
    };
    let fila;
    if (id) {
      [fila] = await db
        .update(schema.patrocinadores)
        .set({ nombre, clave, webUrl, ...(imagen.datos ? { logo: imagen.datos } : {}) })
        .where(eq(schema.patrocinadores.id, id))
        .returning(columnas);
    } else {
      const [ultimo] = await db
        .select({ orden: max(schema.patrocinadores.orden) })
        .from(schema.patrocinadores)
        .where(eq(schema.patrocinadores.enCarteles, false));
      [fila] = await db
        .insert(schema.patrocinadores)
        .values({
          nombre,
          clave,
          webUrl,
          enCarteles: false,
          orden: (ultimo?.orden ?? 0) + 1,
          ...(imagen.datos ? { logo: imagen.datos } : {}),
        })
        .returning(columnas);
    }
    if (!fila) throw new Error("La operación no devolvió ninguna fila");
    return {
      id: fila.id,
      nombre: fila.nombre,
      logo_url: fila.logo ? urlMedia(fila.logo) : null,
      web_url: fila.webUrl,
      orden: fila.orden,
      en_carteles: fila.enCarteles,
    };
  });
}

export async function borrarPatrocinador(id: string): Promise<Resultado<null>> {
  const { db } = await obtenerDb();
  const resultado = await capturar("No se pudo borrar el patrocinador.", async () => {
    await db.delete(schema.patrocinadores).where(eq(schema.patrocinadores.id, id));
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}
