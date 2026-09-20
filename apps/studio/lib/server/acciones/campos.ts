"use server";

import { schema } from "@santiso/db";
import { claveNombre } from "@santiso/domain";
import { eq } from "drizzle-orm";
import type { CampoDto } from "@/lib/dto";
import { capturar, fallo, type Resultado } from "@/lib/resultado";
import { buscarCampoPorNombre, listarCampos } from "@/lib/server/consultas/campos";
import { obtenerDb } from "@/lib/server/db";

export async function cargarCampos(): Promise<Resultado<CampoDto[]>> {
  return capturar("No se pudieron cargar los campos.", listarCampos);
}

/**
 * Devuelve el campo con ese nombre, creándolo si no existe. Si el campo ya estaba pero sin
 * población y ahora llega una, la rellena; nunca sobrescribe una población ya registrada.
 */
export async function asegurarCampo(
  nombre: string,
  poblacion: string | null,
): Promise<Resultado<CampoDto>> {
  const limpio = nombre.trim();
  if (!limpio) return fallo("El nombre del campo es obligatorio.", { nombre: "Obligatorio" });
  const poblacionLimpia = poblacion?.trim() || null;

  return capturar("No se pudo guardar el campo.", async () => {
    const { db } = await obtenerDb();
    const existente = await buscarCampoPorNombre(limpio);
    if (existente) {
      if (!existente.poblacion && poblacionLimpia) {
        await db
          .update(schema.campos)
          .set({ poblacion: poblacionLimpia })
          .where(eq(schema.campos.id, existente.id));
        return { ...existente, poblacion: poblacionLimpia };
      }
      return existente;
    }
    const [creado] = await db
      .insert(schema.campos)
      .values({ nombre: limpio, clave: claveNombre(limpio), poblacion: poblacionLimpia })
      .returning({
        id: schema.campos.id,
        nombre: schema.campos.nombre,
        poblacion: schema.campos.poblacion,
      });
    if (!creado) throw new Error("La inserción no devolvió ninguna fila");
    return creado;
  });
}
