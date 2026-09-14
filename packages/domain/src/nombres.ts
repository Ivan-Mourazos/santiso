/** Clave canónica para comparar nombres: sin tildes, en minúsculas, solo `[a-z0-9]` separados por un espacio. */
export function claveNombre(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Proporción (0..1) de tokens compartidos respecto al nombre con más tokens. */
export function similitudTokens(a: string, b: string): number {
  const tokensA = new Set(claveNombre(a).split(" ").filter(Boolean));
  const tokensB = new Set(claveNombre(b).split(" ").filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let comunes = 0;
  for (const token of tokensA) if (tokensB.has(token)) comunes++;
  return comunes / Math.max(tokensA.size, tokensB.size);
}

/** Equipo del club (UD Santiso), en cualquier categoría. */
export function esEquipoPropio(nombre: string): boolean {
  return claveNombre(nombre).split(" ").includes("santiso");
}
