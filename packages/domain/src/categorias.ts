import { claveNombre } from "./nombres";

export const CATEGORIAS = ["Senior", "Veteranos"] as const;
export type Categoria = (typeof CATEGORIAS)[number];

/** Admite variantes ("Sénior", "vet.") y devuelve la categoría canónica. */
export function normalizarCategoria(valor: string): Categoria {
  const clave = claveNombre(valor);
  if (clave.startsWith("sen")) return "Senior";
  if (clave.startsWith("vet")) return "Veteranos";
  throw new Error(`Categoría desconocida: "${valor}"`);
}
