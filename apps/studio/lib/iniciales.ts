const PARTICULAS = new Set(["de", "da", "do", "das", "dos", "del", "la", "las", "los", "y", "e"]);

/** «Iván Sánchez Vázquez» → «IS»: lo que se pinta en el hueco de quien no tiene foto. */
export function iniciales(nombre: string): string {
  const palabras = nombre
    .trim()
    .split(/[\s-]+/)
    .filter((p) => p && !PARTICULAS.has(p.toLowerCase()));
  return palabras
    .slice(0, 2)
    .map((p) => p.charAt(0).toLocaleUpperCase("es"))
    .join("");
}
