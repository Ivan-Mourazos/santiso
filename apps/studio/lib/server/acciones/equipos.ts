"use server";

import type { EquipoDto } from "@/lib/dto";
import { equiposDeCompeticion, equiposPorIds } from "@/lib/server/consultas/equipos";

/**
 * Envoltorios de servidor para los componentes cliente. Las funciones de `consultas/` llevan
 * `server-only` y no pueden importarse desde el navegador: el cliente entra siempre por aquí.
 * Devuelven la lista directamente (y no `Resultado<T>`) porque los consumidores heredados
 * esperan un array; un fallo de lectura propaga la excepción y la registra el propio Next.
 */
export async function cargarEquiposDeCompeticion(competicionId: string): Promise<EquipoDto[]> {
  return equiposDeCompeticion(competicionId);
}

export async function cargarEquiposPorIds(ids: string[]): Promise<EquipoDto[]> {
  return equiposPorIds(ids);
}
