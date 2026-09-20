"use server";

import { schema } from "@santiso/db";
import { normalizarNombreTemporada } from "@santiso/domain";
import { count, eq, ne } from "drizzle-orm";
import type { TemporadaDto } from "@/lib/dto";
import { capturar, exito, fallo, type Resultado } from "@/lib/resultado";
import { listarTemporadas } from "@/lib/server/consultas/temporadas";
import { obtenerDb } from "@/lib/server/db";

export async function cargarTemporadas(): Promise<Resultado<TemporadaDto[]>> {
  return capturar("No se pudieron cargar las temporadas.", listarTemporadas);
}

export async function crearTemporada(nombre: string): Promise<Resultado<TemporadaDto>> {
  let normalizado: string;
  try {
    normalizado = normalizarNombreTemporada(nombre);
  } catch {
    return fallo("El nombre debe tener la forma 2025/26.", { nombre: "Formato no válido" });
  }

  const { db } = await obtenerDb();
  const [existente] = await db
    .select({ id: schema.temporadas.id })
    .from(schema.temporadas)
    .where(eq(schema.temporadas.nombre, normalizado));
  if (existente) return fallo("Ya existe una temporada con ese nombre.");

  return capturar("No se pudo crear la temporada.", async () => {
    // La primera temporada del sistema queda activa; las siguientes se activan a mano.
    const [total] = await db.select({ n: count() }).from(schema.temporadas);
    const activa = (total?.n ?? 0) === 0;
    const [creada] = await db
      .insert(schema.temporadas)
      .values({ nombre: normalizado, activa })
      .returning({
        id: schema.temporadas.id,
        nombre: schema.temporadas.nombre,
        activa: schema.temporadas.activa,
        creadoEn: schema.temporadas.creadoEn,
      });
    if (!creada) throw new Error("La inserción no devolvió ninguna fila");
    return {
      id: creada.id,
      nombre: creada.nombre,
      activa: creada.activa,
      created_at: creada.creadoEn,
    };
  });
}

/**
 * Cambia la temporada vigente. Va en transacción y desactiva antes de activar: el índice parcial
 * `temporadas_una_activa_uq` rechaza que haya dos activas ni siquiera a mitad de operación.
 */
export async function activarTemporada(id: string): Promise<Resultado<null>> {
  const { db } = await obtenerDb();
  const [existe] = await db
    .select({ id: schema.temporadas.id })
    .from(schema.temporadas)
    .where(eq(schema.temporadas.id, id));
  if (!existe) return fallo("Esa temporada ya no existe.");

  const resultado = await capturar("No se pudo activar la temporada.", async () => {
    await db.transaction(async (tx) => {
      await tx.update(schema.temporadas).set({ activa: false }).where(ne(schema.temporadas.id, id));
      await tx.update(schema.temporadas).set({ activa: true }).where(eq(schema.temporadas.id, id));
    });
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}
