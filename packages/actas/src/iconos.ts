import { extractImages, getResolvedPDFJS } from "unpdf";
import type { getDocumentProxy } from "unpdf";

export type MarcaFicha = {
  tipo: "amarilla" | "roja" | "entra" | "sale" | "desconocida";
  x: number;
  y: number;
};
type Imagen = Awaited<ReturnType<typeof extractImages>>[number];
type Matriz = [number, number, number, number, number, number];

/** Solo reconoce dimensiones, canales, paleta y recuentos de las muestras validadas. */
export function clasificarIcono(imagen: Imagen): MarcaFicha["tipo"] | null {
  const { width, height, channels, data } = imagen;
  const tarjeta = width === 8 && height === 11 && channels === 3;
  const flecha = width === 14 && height === 10 && channels === 4;
  if ((!tarjeta && !flecha) || data.length !== width * height * channels) return null;

  const colores = new Map<string, number>();
  let transparentes = 0;
  for (let i = 0; i < data.length; i += channels) {
    if (channels === 4) {
      if (data[i + 3] === 0) {
        transparentes++;
        continue;
      }
      if (data[i + 3] !== 255) return null;
    }
    const color = `${data[i]},${data[i + 1]},${data[i + 2]}`;
    colores.set(color, (colores.get(color) ?? 0) + 1);
  }

  if (tarjeta) {
    if (colores.size !== 3 || colores.get("140,140,140") !== 30 || colores.get("255,255,255") !== 4)
      return null;
    if (colores.get("246,199,51") === 54) return "amarilla";
    if (colores.get("255,0,0") === 54) return "roja";
  } else if (transparentes === 104 && colores.size === 1) {
    if (colores.get("0,0,98") === 36) return "entra";
    if (colores.get("181,8,16") === 36) return "sale";
  }
  return null;
}

function matriz(valor: unknown): Matriz {
  if (
    !Array.isArray(valor) ||
    valor.length !== 6 ||
    !valor.every((n: unknown) => typeof n === "number" && Number.isFinite(n))
  ) {
    throw new Error("Matriz PDF inválida");
  }
  // La validación anterior garantiza longitud 6 y solo números finitos; TypeScript no infiere la tupla.
  return valor as Matriz;
}

/** Producto CTM × transformación nueva; las traslaciones también se escalan. */
function componer([a, b, c, d, e, f]: Matriz, [g, h, i, j, k, l]: Matriz): Matriz {
  return matriz([
    a * g + c * h,
    b * g + d * h,
    a * i + c * j,
    b * i + d * j,
    a * k + c * l + e,
    b * k + d * l + f,
  ]);
}

/**
 * Página 1-based. Centros normalizados (0..1), origen arriba izquierda.
 * Conserva cada paintImageXObject, incluso si reutiliza recurso y posición.
 * Marca como desconocidos giros, reflejos finales y sesgos. Formas/grupos y operadores de
 * posición no soportados fallan, evitando devolver coordenadas inventadas.
 * El llamante conserva la propiedad del documento y debe destruir loadingTask.
 */
export async function extraerMarcasPdf(
  pdf: Awaited<ReturnType<typeof getDocumentProxy>>,
  pagina: number,
): Promise<MarcaFicha[]> {
  const page = await pdf.getPage(pagina);
  const vista = page.getViewport({ scale: 1 });
  if (vista.rotation !== 0) return [];
  if (![vista.width, vista.height].every((n) => Number.isFinite(n) && n > 0)) {
    throw new Error("Viewport PDF inválido");
  }
  const proyeccion = matriz(vista.transform);
  const { OPS } = await getResolvedPDFJS();
  const nombres = new Map(Object.entries(OPS).map(([nombre, codigo]) => [codigo, nombre]));
  const { fnArray, argsArray } = await page.getOperatorList();
  if (fnArray.length !== argsArray.length) throw new Error("Lista de operadores PDF incompleta");

  // extractImages devuelve recursos repetidos; el mapa solo clasifica, no posiciona.
  const tipos = new Map<string, MarcaFicha["tipo"] | null>();
  for (const imagen of await extractImages(pdf, pagina)) {
    tipos.set(
      imagen.key,
      clasificarIcono(imagen) ?? (imagen.width <= 20 && imagen.height <= 20 ? "desconocida" : null),
    );
  }

  let ctm: Matriz = [1, 0, 0, 1, 0, 0];
  const pila: Matriz[] = [];
  const marcas: MarcaFicha[] = [];
  for (let i = 0; i < fnArray.length; i++) {
    const op = fnArray[i];
    const nombre = op === undefined ? undefined : nombres.get(op);
    const args: unknown = argsArray[i];
    if (nombre === undefined) throw new Error("Operador PDF desconocido");
    switch (nombre) {
      case "save":
        pila.push(ctm);
        break;
      case "restore": {
        const anterior = pila.pop();
        if (!anterior) throw new Error("restore PDF sin save");
        ctm = anterior;
        break;
      }
      case "transform":
        ctm = componer(ctm, matriz(args));
        break;
      case "paintFormXObjectBegin":
      case "paintFormXObjectEnd":
      case "beginGroup":
      case "endGroup":
      case "paintImageXObjectRepeat":
        throw new Error(`Operador de posición PDF no soportado: ${nombre}`);
      case "paintImageXObject": {
        if (!Array.isArray(args) || typeof args[0] !== "string") {
          throw new Error("Clave de imagen PDF inválida");
        }
        let tipo = tipos.get(args[0]);
        if (!tipos.has(args[0])) throw new Error("Imagen PDF sin datos decodificados");
        if (!tipo) break;
        const [a, b, c, d] = ctm;
        if (a <= 0 || d <= 0 || b !== 0 || c !== 0) tipo = "desconocida";
        // PDF.js pinta el recurso sobre el cuadrado unidad, no sus píxeles.
        const [va, vb, vc, vd, ve, vf] = componer(proyeccion, ctm);
        const x = (ve + (va + vc) / 2) / vista.width;
        const y = (vf + (vb + vd) / 2) / vista.height;
        if (x >= 0 && x <= 1 && y >= 0 && y <= 1) marcas.push({ tipo, x, y });
        break;
      }
    }
  }
  if (pila.length !== 0) throw new Error("save PDF sin restore");
  return marcas;
}
