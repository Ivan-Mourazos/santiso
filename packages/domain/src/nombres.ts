/** Clave canónica para comparar nombres: sin tildes, en minúsculas, solo `[a-z0-9]` separados por un espacio. */
export function claveNombre(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Clave para **emparejar** nombres de equipo. La federación escribe las siglas separadas
 * (`U.D. SANTISO F.C.`) y el catálogo del club las escribe juntas (`UD Santiso FC`):
 * `claveNombre` deja `u d santiso f c` frente a `ud santiso fc`, que no casan ni por igualdad
 * ni por parecido. Aquí se unen las tiradas de dos o más letras sueltas, que es justo lo que es
 * una sigla; una letra sola se respeta, porque distingue a un filial (`Atlético Eter B`).
 *
 * No sustituye a `claveNombre`: la columna `equipos.clave` se sigue calculando con aquella.
 */
export function claveEquipo(nombre: string): string {
  const partes = claveNombre(nombre).split(" ").filter(Boolean);
  const salida: string[] = [];
  let siglas: string[] = [];
  const volcarSiglas = () => {
    if (siglas.length >= 2) salida.push(siglas.join(""));
    else salida.push(...siglas);
    siglas = [];
  };
  for (const parte of partes) {
    if (parte.length === 1) siglas.push(parte);
    else {
      volcarSiglas();
      salida.push(parte);
    }
  }
  volcarSiglas();
  return salida.join(" ");
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
