"use server";
import { capturar, fallo } from "@/lib/resultado";
import { previasCartel } from "@/lib/server/consultas/previa-cartel";

export async function cargarPreviasCartel(ids: string[]) {
  if (
    !Array.isArray(ids) ||
    ids.length > 4 ||
    ids.some((id) => typeof id !== "string" || !id || id.length > 100)
  )
    return fallo("Elige como máximo cuatro partidos.");
  return capturar("No se pudo cargar la previa.", () => previasCartel([...new Set(ids)]));
}
