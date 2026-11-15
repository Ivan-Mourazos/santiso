import type { Posicion } from "@santiso/domain";

/** Sistemas de juego disponibles para dibujar la alineación en el campo. */
export const SISTEMAS = ["4-4-2", "4-3-3", "4-2-3-1", "3-5-2", "4-1-4-1", "5-3-2"] as const;
export type Sistema = (typeof SISTEMAS)[number];

export type Linea = "POR" | "DEF" | "MED" | "DEL";

/** Posición en el campo, de 0 a 100. y=0 es el ataque (arriba), y=100 la portería propia. */
export interface Hueco {
  x: number;
  y: number;
  linea: Linea;
}

/** Once huecos con el id del jugador que ocupa cada uno, o null. El 0 es el portero. */
export type Huecos = (string | null)[];

type Jugador = { id: string; posicion: Posicion | null };

const por = (): Hueco => ({ x: 50, y: 92, linea: "POR" });
const fila = (linea: Linea, puntos: [number, number][]): Hueco[] =>
  puntos.map(([x, y]) => ({ x, y, linea }));

const CUATRO_ATRAS = fila("DEF", [
  [13, 70],
  [37, 74],
  [63, 74],
  [87, 70],
]);
const DOS_ARRIBA = fila("DEL", [
  [34, 17],
  [66, 17],
]);

// Orden de cada sistema: portero, defensas, medios y delanteros, de izquierda a derecha.
const HUECOS: Record<Sistema, readonly Hueco[]> = {
  "4-4-2": [
    por(),
    ...CUATRO_ATRAS,
    ...fila("MED", [
      [13, 43],
      [37, 48],
      [63, 48],
      [87, 43],
    ]),
    ...DOS_ARRIBA,
  ],
  "4-3-3": [
    por(),
    ...CUATRO_ATRAS,
    ...fila("MED", [
      [22, 46],
      [50, 50],
      [78, 46],
    ]),
    ...fila("DEL", [
      [20, 20],
      [50, 15],
      [80, 20],
    ]),
  ],
  "4-2-3-1": [
    por(),
    ...CUATRO_ATRAS,
    ...fila("MED", [
      [35, 58],
      [65, 58],
      [20, 36],
      [50, 32],
      [80, 36],
    ]),
    ...fila("DEL", [[50, 14]]),
  ],
  "3-5-2": [
    por(),
    ...fila("DEF", [
      [25, 74],
      [50, 76],
      [75, 74],
    ]),
    ...fila("MED", [
      [10, 46],
      [30, 52],
      [50, 48],
      [70, 52],
      [90, 46],
    ]),
    ...DOS_ARRIBA,
  ],
  "4-1-4-1": [
    por(),
    ...CUATRO_ATRAS,
    ...fila("MED", [
      [50, 62],
      [13, 42],
      [37, 46],
      [63, 46],
      [87, 42],
    ]),
    ...fila("DEL", [[50, 15]]),
  ],
  "5-3-2": [
    por(),
    ...fila("DEF", [
      [10, 70],
      [30, 74],
      [50, 76],
      [70, 74],
      [90, 70],
    ]),
    ...fila("MED", [
      [25, 46],
      [50, 50],
      [75, 46],
    ]),
    ...DOS_ARRIBA,
  ],
};

export function huecosDe(sistema: Sistema): readonly Hueco[] {
  return HUECOS[sistema];
}

const LINEA_DE: Record<Posicion, Linea> = {
  POR: "POR",
  LD: "DEF",
  DFC: "DEF",
  LI: "DEF",
  MCD: "MED",
  MC: "MED",
  MCO: "MED",
  MD: "MED",
  MI: "MED",
  ED: "DEL",
  EI: "DEL",
  DC: "DEL",
};

export function lineaDe(posicion: Posicion | null): Linea | null {
  return posicion ? LINEA_DE[posicion] : null;
}

const VACIOS = (): Huecos => Array<string | null>(11).fill(null);

/**
 * Cada jugador va primero a un hueco libre de su línea (en el orden de la lista);
 * los que no caben o no tienen posición rellenan los libres de izquierda a derecha y
 * de atrás adelante. Como mucho once.
 */
export function colocarAutomatico(sistema: Sistema, jugadores: Jugador[]): Huecos {
  const huecos = huecosDe(sistema);
  const res = VACIOS();
  const sobran: Jugador[] = [];
  for (const j of jugadores) {
    const linea = lineaDe(j.posicion);
    const i = linea ? huecos.findIndex((h, k) => h.linea === linea && res[k] === null) : -1;
    if (i >= 0) res[i] = j.id;
    else sobran.push(j);
  }
  for (const j of sobran) {
    const i = res.indexOf(null);
    if (i < 0) break;
    res[i] = j.id;
  }
  return res;
}

/** Pone al jugador en el hueco; si ya estaba en otro, ambos se intercambian. */
export function ponerEnHueco(huecos: Huecos, indice: number, jugadorId: string): Huecos {
  const res = [...huecos];
  const previo = res.indexOf(jugadorId);
  if (previo >= 0) res[previo] = res[indice] ?? null;
  res[indice] = jugadorId;
  return res;
}

export function quitarDeHueco(huecos: Huecos, indice: number): Huecos {
  const res = [...huecos];
  res[indice] = null;
  return res;
}

/** Recoloca a los mismos jugadores en el nuevo sistema. */
export function cambiarSistema(huecos: Huecos, nuevo: Sistema, jugadores: Jugador[]): Huecos {
  const porId = new Map(jugadores.map((j) => [j.id, j]));
  const presentes = huecos
    .filter((id): id is string => id !== null)
    .map((id) => porId.get(id) ?? { id, posicion: null });
  return colocarAutomatico(nuevo, presentes);
}

/** Vacía los huecos de jugadores no disponibles y los repetidos. */
export function depurar(huecos: Huecos, disponibles: readonly string[]): Huecos {
  const validos = new Set(disponibles);
  const vistos = new Set<string>();
  return huecos.map((id) => {
    if (id === null || !validos.has(id) || vistos.has(id)) return null;
    vistos.add(id);
    return id;
  });
}

/** Sistema y huecos guardados de un partido. */
export interface Colocacion {
  sistema: Sistema;
  huecos: Huecos;
}

/** `previa`: el once anunciado antes del partido. `final`: el de O Noso 11, después. */
export type MomentoColocacion = "previa" | "final";

/** Por qué no vale una colocación, o `null` si vale: sistema conocido, 11 huecos, sin repetir. */
export function errorDeColocacion(c: Colocacion): string | null {
  if (!(SISTEMAS as readonly string[]).includes(c.sistema)) return "Sistema desconocido.";
  if (!Array.isArray(c.huecos) || c.huecos.length !== huecosDe(c.sistema).length)
    return "La colocación debe tener 11 huecos.";
  const ids = c.huecos.filter((id): id is string => id !== null);
  if (ids.some((id) => typeof id !== "string" || !id)) return "Hueco no válido.";
  if (new Set(ids).size !== ids.length) return "Un jugador no puede ir en dos huecos.";
  return null;
}
