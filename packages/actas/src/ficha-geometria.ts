import type { Fragmento } from "./ficha-tipos";
export function exigir<T>(valor: T | undefined | null, mensaje: string): T {
  if (valor === undefined || valor === null) throw new Error(mensaje);
  return valor;
}

export function agruparFilas(items: readonly Fragmento[]): Fragmento[] {
  const grupos: Fragmento[][] = [];
  for (const item of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const ultimo = grupos.at(-1);
    if (ultimo?.[0] && Math.abs(item.y - ultimo[0].y) <= 0.0025) ultimo.push(item);
    else grupos.push([item]);
  }
  return grupos.map((g) => {
    g.sort((a, b) => a.x - b.x);
    const primero = exigir(g[0], "Fila vacía");
    return {
      x: primero.x,
      y: Math.min(...g.map((i) => i.y)),
      texto: g
        .map((i) => i.texto)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    };
  });
}
export function filas(items: readonly Fragmento[]): string[] {
  return agruparFilas(items).map((i) => i.texto);
}

export function ancla(items: readonly Fragmento[], texto: string): Fragmento {
  const matches = items.filter((i) => i.texto === texto);
  if (matches.length !== 1) throw new Error(`Sección no reconocida: ${texto}`);
  return exigir(matches[0], texto);
}

export function seccion(items: readonly Fragmento[], desde: string, hasta: string): string[] {
  const inicio = ancla(items, desde).y,
    fin = ancla(items, hasta).y;
  if (fin <= inicio) throw new Error(`Orden de secciones no reconocido: ${desde}`);
  return filas(items.filter((i) => i.y > inicio + 0.0025 && i.y < fin - 0.0025));
}
