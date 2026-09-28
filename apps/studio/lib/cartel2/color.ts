/**
 * Color de un escudo, para teñir la mitad del cartel de cada equipo. Puro: recibe los píxeles
 * RGBA (de un `<canvas>` en el navegador o de `sharp` en las pruebas).
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

function hsl({ r, g, b }: Rgb) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { s, l };
}

/**
 * El color con más presencia del escudo, descartando transparencias, blancos, negros y grises
 * (bordes, contornos y fondo no dicen de qué color es un club). Se agrupa en cubos de 16 niveles
 * por canal y gana el cubo con más píxeles, pesado por la saturación. `null` si no hay color:
 * un escudo en blanco y negro.
 */
export function colorDominante(rgba: ArrayLike<number>): Rgb | null {
  const cubos = new Map<number, { n: number; r: number; g: number; b: number; peso: number }>();
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const alfa = rgba[i + 3]!;
    if (alfa < 200) continue;
    const c = { r: rgba[i]!, g: rgba[i + 1]!, b: rgba[i + 2]! };
    const { s, l } = hsl(c);
    if (l > 0.9 || l < 0.1 || s < 0.25) continue;
    const clave = ((c.r >> 4) << 8) | ((c.g >> 4) << 4) | (c.b >> 4);
    const cubo = cubos.get(clave) ?? { n: 0, r: 0, g: 0, b: 0, peso: 0 };
    cubo.n++;
    cubo.r += c.r;
    cubo.g += c.g;
    cubo.b += c.b;
    cubo.peso += 0.5 + s;
    cubos.set(clave, cubo);
  }
  let mejor: { n: number; r: number; g: number; b: number; peso: number } | undefined;
  for (const cubo of cubos.values()) if (!mejor || cubo.peso > mejor.peso) mejor = cubo;
  if (!mejor) return null;
  return {
    r: Math.round(mejor.r / mejor.n),
    g: Math.round(mejor.g / mejor.n),
    b: Math.round(mejor.b / mejor.n),
  };
}

export const aHex = ({ r, g, b }: Rgb) =>
  `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

/** Mezcla con negro: `cuanto` 0 = el color, 1 = negro. Para fondos sobre los que va texto blanco. */
export function oscurecer({ r, g, b }: Rgb, cuanto: number): Rgb {
  const f = 1 - cuanto;
  return { r: Math.round(r * f), g: Math.round(g * f), b: Math.round(b * f) };
}

/** Colores de reserva por categoría, cuando el escudo no tiene color propio. */
export const COLOR_CATEGORIA: Record<string, Rgb> = {
  Senior: { r: 245, g: 197, b: 24 },
  Veteranos: { r: 20, g: 184, b: 166 },
  Femenino: { r: 236, g: 72, b: 153 },
};

/** Verde de la bandera del Santiso: el color del club cuando juega en casa. */
export const VERDE_SANTISO: Rgb = { r: 31, g: 122, b: 58 };
