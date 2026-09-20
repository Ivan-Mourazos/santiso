import { getDocumentProxy } from "unpdf";
import { parsearFicha } from "./ficha";
import type { Ficha, Fragmento } from "./ficha";

/** Lee una ficha local. No descarga documentos ni guarda resultados. */
export async function parsearFichaPdf(bytes: Uint8Array): Promise<Ficha> {
  if (bytes.byteLength > 15 * 1024 * 1024) throw new Error("El PDF supera 15 MiB");
  if (bytes.byteLength === 0) throw new Error("El PDF está vacío");
  // PDF.js puede transferir el buffer: nunca entregamos el del llamante.
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  try {
    if (pdf.numPages !== 1) throw new Error("Solo se admite la ficha de una página validada");
    const pagina = await pdf.getPage(1);
    const vista = pagina.getViewport({ scale: 1 });
    if (vista.rotation !== 0) throw new Error("Plantilla girada no soportada");
    const contenido = await pagina.getTextContent();
    const fragmentos: Fragmento[] = [];
    for (const item of contenido.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const x = item.transform[4],
        y = item.transform[5];
      if (x === undefined || y === undefined) throw new Error("Coordenadas PDF incompletas");
      fragmentos.push({
        texto: item.str,
        x: x / vista.width,
        y: (vista.height - y) / vista.height,
      });
    }
    return parsearFicha(fragmentos);
  } finally {
    await pdf.loadingTask.destroy();
  }
}
