/** Comprobación del texto pintado, no una estimación por número de caracteres. */
export function erroresDeLectura(cartel: Element): string[] {
  const bloques = [...cartel.querySelectorAll("[data-lectura-bloque]")];
  if (!bloques.length) return [];
  const errores: string[] = [];
  const lienzo = cartel.getBoundingClientRect();
  const escala = lienzo.width / (cartel as HTMLElement).offsetWidth || 1;
  const rects = (elemento: Element) => {
    const salida: DOMRect[] = [];
    const walker = document.createTreeWalker(elemento, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent?.trim() || n.parentElement?.closest("[data-cartel-aviso]")) continue;
      if (["STYLE", "SCRIPT"].includes(n.parentElement?.tagName ?? "")) continue;
      const rango = document.createRange();
      rango.selectNodeContents(n);
      salida.push(...rango.getClientRects());
    }
    return salida.filter((r) => r.width > 0 && r.height > 0);
  };
  for (let i = 0; i < bloques.length; i++)
    for (let j = i + 1; j < bloques.length; j++) {
      const a = bloques[i]!,
        b = bloques[j]!;
      if (a.contains(b) || b.contains(a)) continue;
      const x = a.getBoundingClientRect(),
        y = b.getBoundingClientRect();
      if (
        Math.min(x.right, y.right) - Math.max(x.left, y.left) > escala &&
        Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top) >= -escala
      )
        errores.push("bloques");
    }
  for (const n of cartel.querySelectorAll("[data-lectura-columna], [data-lectura-fila]")) {
    const caja = n.getBoundingClientRect();
    for (const r of rects(n))
      if (
        r.left < caja.left - escala ||
        r.right > caja.right + escala ||
        (n.hasAttribute("data-lectura-fila") &&
          (r.top < caja.top - escala || r.bottom > caja.bottom + escala))
      )
        errores.push("columna o fila");
  }
  const zona = (cartel as HTMLElement).offsetHeight === 1920 ? 250 * escala : 0;
  const walker = document.createTreeWalker(cartel, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const padre = n.parentElement;
    if (
      !n.textContent?.trim() ||
      !padre ||
      padre.closest("[data-cartel-aviso]") ||
      ["STYLE", "SCRIPT"].includes(padre.tagName)
    )
      continue;
    const rango = document.createRange();
    rango.selectNodeContents(n);
    const caja = padre.getBoundingClientRect();
    const bloque = padre.closest("[data-lectura-bloque]")?.getBoundingClientRect();
    for (const r of rango.getClientRects())
      if (
        r.width > 0 &&
        r.height > 0 &&
        (r.left < caja.left - 4 * escala ||
          r.right > caja.right + 4 * escala ||
          r.top < caja.top - 4 * escala ||
          r.bottom > caja.bottom + 4 * escala ||
          r.left < lienzo.left - escala ||
          r.right > lienzo.right + escala ||
          r.top < lienzo.top + zona - escala ||
          r.bottom > lienzo.bottom - zona + escala ||
          (bloque && (r.top < bloque.top - 4 * escala || r.bottom > bloque.bottom + 4 * escala)))
      )
        errores.push("texto");
  }
  return [...new Set(errores)];
}

export class ErrorCapacidadCartel extends Error {
  constructor() {
    super("El contenido no cabe con letra legible. Reduce datos o prepara dos láminas.");
    this.name = "ErrorCapacidadCartel";
  }
}
