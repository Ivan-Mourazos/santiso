import { claveNombre } from "@santiso/domain";
import type { PatrocinadorDto } from "@/lib/dto";

/**
 * Lógica pura del catálogo de patrocinadores y logos: filtros, orden visible y borrador del
 * editor. Sin React ni servidor, para poder probarla sola.
 */

export type FiltroPatrocinadores = "todos" | "en-carteles" | "fuera-carteles" | "sin-logo";

/** Cuántos logos caben en la barra del cartel (`lib/cartel/shared.ts`). */
export const LOGOS_EN_CARTEL = 5;

export interface BorradorPatrocinador {
  id: string;
  nombre: string;
  webUrl: string;
  enCarteles: boolean;
}

export function borradorDePatrocinador(fila: PatrocinadorDto | null): BorradorPatrocinador {
  return {
    id: fila?.id ?? "",
    nombre: fila?.nombre ?? "",
    webUrl: fila?.web_url ?? "",
    enCarteles: fila?.en_carteles ?? false,
  };
}

export function formularioDePatrocinador(
  borrador: BorradorPatrocinador,
  logo: Blob | null,
): FormData {
  const f = new FormData();
  f.set("id", borrador.id);
  f.set("nombre", borrador.nombre);
  f.set("webUrl", borrador.webUrl.trim());
  f.set("enCarteles", borrador.enCarteles ? "true" : "false");
  if (logo) f.set("logo", logo);
  return f;
}

/** Una web vacía vale; si se escribe, tiene que ser http o https. */
export function erroresPatrocinador(
  b: BorradorPatrocinador,
): Partial<Record<"nombre" | "webUrl", string>> {
  const errores: Partial<Record<"nombre" | "webUrl", string>> = {};
  if (!b.nombre.trim()) errores.nombre = "El nombre es obligatorio.";
  const web = b.webUrl.trim();
  if (web && !esWebValida(web)) errores.webUrl = "La dirección debe empezar por http:// o https://";
  return errores;
}

export function esWebValida(valor: string): boolean {
  try {
    const url = new URL(valor);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Filtra sin tocar la lista de entrada: el orden de llegada manda. */
export function filtrarPatrocinadores(
  filas: readonly PatrocinadorDto[],
  texto: string,
  filtro: FiltroPatrocinadores,
): PatrocinadorDto[] {
  const buscado = claveNombre(texto);
  return filas.filter((fila) => {
    if (filtro === "en-carteles" && !fila.en_carteles) return false;
    if (filtro === "fuera-carteles" && fila.en_carteles) return false;
    if (filtro === "sin-logo" && fila.logo_url) return false;
    if (!buscado) return true;
    return claveNombre(fila.nombre).includes(buscado);
  });
}

/**
 * Los que de verdad se van a ver en el cartel: activados, con logo y solo los cinco primeros.
 * Un activado sin logo no ocupa hueco, porque el generador lo descarta al cargar imágenes.
 */
export function logosVisibles(filas: readonly PatrocinadorDto[]): PatrocinadorDto[] {
  return filas
    .filter((fila) => fila.en_carteles && fila.logo_url)
    .slice(0, LOGOS_EN_CARTEL);
}

/** Activados que se quedan fuera del cartel por pasarse del límite. */
export function logosExcedentes(filas: readonly PatrocinadorDto[]): PatrocinadorDto[] {
  return filas.filter((fila) => fila.en_carteles && fila.logo_url).slice(LOGOS_EN_CARTEL);
}

/** Activados sin logo: no aparecerán aunque estén marcados. */
export function activadosSinLogo(filas: readonly PatrocinadorDto[]): PatrocinadorDto[] {
  return filas.filter((fila) => fila.en_carteles && !fila.logo_url);
}
