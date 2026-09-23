/**
 * Emparejado de lo que lee Gemini en una captura de jornada con el catálogo: equipos, campos y
 * fechas. Puro, sin React ni base de datos. Sale de `AdminJornadaImporter` en la 6H.
 */
import { claveEquipo, similitudTokens } from "@santiso/domain";

export interface ConNombre {
  id: string;
  nombre: string;
}
export interface CampoCatalogo extends ConNombre {
  poblacion: string | null;
}

/**
 * Parecido entre 0 y 1: palabras en común sobre las del nombre más largo, con las siglas unidas
 * (`claveEquipo`). Antes se partían en letras sueltas y «UD Santiso FC» no casaba con
 * «U.D. SANTISO F.C.», que es como lo escribe la federación.
 */
export function parecido(a: string, b: string) {
  return similitudTokens(claveEquipo(a), claveEquipo(b));
}

/** El equipo del catálogo que mejor casa, si pasa de 0,4; si no, "". */
export function mejorEquipo(nombre: string, equipos: readonly ConNombre[]) {
  if (!nombre.trim()) return "";
  const ordenados = equipos
    .map((e) => ({ e, puntos: parecido(nombre, e.nombre) }))
    .sort((a, b) => b.puntos - a.puntos);
  const mejor = ordenados[0];
  return mejor && mejor.puntos >= 0.4 ? mejor.e.id : "";
}

/** El campo que mejor casa por nombre, o por nombre y población, si pasa de 0,5; si no, "". */
export function mejorCampo(nombre: string, poblacion: string, campos: readonly CampoCatalogo[]) {
  if (!nombre.trim()) return "";
  const ordenados = campos
    .map((c) => ({
      c,
      puntos: Math.max(
        parecido(nombre, c.nombre),
        parecido(`${nombre} ${poblacion}`, `${c.nombre} ${c.poblacion || ""}`),
      ),
    }))
    .sort((a, b) => b.puntos - a.puntos);
  const mejor = ordenados[0];
  return mejor && mejor.puntos >= 0.5 ? mejor.c.id : "";
}

/** DD-MM-YYYY o DD/MM/YYYY → YYYY-MM-DD, conservando lo que siga (la hora). ISO pasa igual. */
export function normalizarFecha(texto: string): string {
  if (!texto) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto;
  const m = texto.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(.*)$/);
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}${m[4]}`;
  return texto;
}
