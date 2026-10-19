/**
 * Los colores de la equipación tal como los escribe la federación («Amarilla», «Negro»,
 * «Rayas rojas y blancas», «Azulgrana») pasados a `#rrggbb` para los carteles. Solo los que se
 * reconocen: una palabra desconocida no se adivina.
 */

import { claveNombre } from "@santiso/domain";

/** Raíz de la palabra (sin género ni número) → color. Las más largas se prueban primero. */
const COLORES: [raiz: string, nombre: string, hex: string][] = [
  ["azul marin", "azul marino", "#14213d"],
  ["marin", "azul marino", "#14213d"],
  ["celest", "celeste", "#5fb3e6"],
  ["azul", "azul", "#1d4ea8"],
  ["amarill", "amarillo", "#f4c300"],
  ["negr", "negro", "#111111"],
  ["blanc", "blanco", "#ffffff"],
  ["roj", "rojo", "#c8102e"],
  ["verd", "verde", "#14833b"],
  ["granat", "granate", "#7b1e2e"],
  ["burdeo", "burdeos", "#6d1a2b"],
  ["naranj", "naranja", "#f28c00"],
  ["butano", "naranja", "#f28c00"],
  ["morad", "morado", "#5b2a86"],
  ["violet", "morado", "#5b2a86"],
  ["lila", "morado", "#5b2a86"],
  ["gris", "gris", "#8c8f93"],
  ["fucsia", "fucsia", "#d6247c"],
  ["ros", "rosa", "#e8649a"],
  ["dorad", "dorado", "#c9a227"],
  ["oro", "dorado", "#c9a227"],
  ["platead", "plateado", "#c0c0c0"],
  ["plata", "plateado", "#c0c0c0"],
  ["turquesa", "turquesa", "#1aa6a6"],
  ["marron", "marrón", "#6b3e1f"],
  ["crema", "crema", "#f3e5c0"],
];

/** Palabras de dos colores en una: «azulgrana», «rojiblanca», «albinegra»… */
const COMPUESTOS: [raiz: string, raices: [string, string]][] = [
  ["azulgrana", ["azul", "granat"]],
  ["rojiblanc", ["roj", "blanc"]],
  ["rojinegr", ["roj", "negr"]],
  ["blanquiazul", ["blanc", "azul"]],
  ["blanquinegr", ["blanc", "negr"]],
  ["albinegr", ["blanc", "negr"]],
  ["blanquivioleta", ["blanc", "violet"]],
  ["blanquiverd", ["blanc", "verd"]],
  ["verdiblanc", ["verd", "blanc"]],
  ["blanquirroj", ["blanc", "roj"]],
  ["aurinegr", ["amarill", "negr"]],
  ["auriazul", ["amarill", "azul"]],
  ["albiazul", ["blanc", "azul"]],
  ["albiceleste", ["blanc", "celest"]],
  ["albirroj", ["blanc", "roj"]],
  ["albiverd", ["blanc", "verd"]],
  ["azulamarill", ["azul", "amarill"]],
  ["verdinegr", ["verd", "negr"]],
];

export interface ColorDeEquipacion {
  /** El nombre del color, en masculino singular («amarillo»). */
  nombre: string;
  hex: string;
}

const porRaiz = (raiz: string) => COLORES.find(([r]) => r === raiz);

/** Los colores de un texto de la federación, en el orden en que aparecen y sin repetir. */
export function coloresDeTexto(texto: string | null | undefined): ColorDeEquipacion[] {
  const palabras = claveNombre(texto ?? "")
    .split(" ")
    .filter(Boolean);
  const salida: ColorDeEquipacion[] = [];
  const anadir = (color: ColorDeEquipacion | undefined) => {
    if (color && !salida.some((c) => c.hex === color.hex)) salida.push(color);
  };
  for (let i = 0; i < palabras.length; i++) {
    const palabra = palabras[i]!;
    // «Azul marino» son dos palabras y un solo color.
    if (palabra === "azul" && palabras[i + 1]?.startsWith("marin")) {
      const [, nombre, hex] = porRaiz("azul marin")!;
      anadir({ nombre, hex });
      i++;
      continue;
    }
    const compuesto = COMPUESTOS.find(([raiz]) => palabra.startsWith(raiz));
    if (compuesto) {
      for (const raiz of compuesto[1]) {
        const [, nombre, hex] = porRaiz(raiz)!;
        anadir({ nombre, hex });
      }
      continue;
    }
    const simple = COLORES.find(([raiz]) => !raiz.includes(" ") && palabra.startsWith(raiz));
    if (simple) anadir({ nombre: simple[1], hex: simple[2] });
  }
  return salida;
}

/**
 * Los dos colores de un equipo a partir de su equipación: el primero, el de la camiseta; el
 * segundo, el otro color de la camiseta si es de dos (rayas, mitades) o, si no, el del pantalón
 * cuando es distinto. `null` si la camiseta no trae ningún color conocido.
 */
export function coloresDeEquipacion(equipacion: {
  camiseta: string | null;
  pantalon: string | null;
}): { color: string; color2: string | null } | null {
  const camiseta = coloresDeTexto(equipacion.camiseta);
  const primero = camiseta[0];
  if (!primero) return null;
  const segundo =
    camiseta[1] ?? coloresDeTexto(equipacion.pantalon).find((c) => c.hex !== primero.hex);
  return { color: primero.hex, color2: segundo?.hex ?? null };
}
