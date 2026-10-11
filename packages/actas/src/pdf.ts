import { getDocumentProxy } from "unpdf";
import { extraerMarcasPdf } from "./iconos";
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
    return parsearFicha(fragmentos, await extraerMarcasPdf(pdf, 1));
  } finally {
    await pdf.loadingTask.destroy();
  }
}

/**
 * Solo el marcador de una ficha, para partidos de los que no hace falta nada más. Es mucho más
 * tolerante que `parsearFichaPdf`: una ficha con un evento escrito de forma rara sigue teniendo
 * su marcador. `null` si no se encuentra.
 */
export async function marcadorDeFichaPdf(bytes: Uint8Array): Promise<[number, number] | null> {
  if (bytes.byteLength === 0 || bytes.byteLength > 15 * 1024 * 1024) return null;
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  try {
    const pagina = await pdf.getPage(1);
    const vista = pagina.getViewport({ scale: 1 });
    const contenido = await pagina.getTextContent();
    const textos: { texto: string; x: number; y: number }[] = [];
    for (const item of contenido.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const x = item.transform[4];
      const y = item.transform[5];
      if (x === undefined || y === undefined) continue;
      textos.push({
        texto: item.str.replace(/\s+/g, " ").trim(),
        x: x / vista.width,
        y: (vista.height - y) / vista.height,
      });
    }
    // El marcador va centrado en la cabecera, por encima del bloque de goles, y el PDF lo
    // trae en trozos sueltos («8», «-», «3»): se juntan los de la misma línea.
    const goles = textos.find((t) => t.texto === "GOLES");
    const centro = textos
      .filter((t) => t.x > 0.3 && t.x < 0.7 && (!goles || t.y < goles.y))
      .sort((a, b) => a.y - b.y || a.x - b.x);
    const lineas: (typeof centro)[] = [];
    for (const trozo of centro) {
      const ultima = lineas.at(-1);
      if (ultima && Math.abs((ultima[0]?.y ?? 0) - trozo.y) < 0.004) ultima.push(trozo);
      else lineas.push([trozo]);
    }
    for (const linea of lineas) {
      const texto = linea
        .sort((a, b) => a.x - b.x)
        .map((t) => t.texto)
        .join(" ")
        .replace(/\s+/g, " ");
      // En la misma línea puede haber algo más (parte de un nombre largo): se busca dentro.
      const marcador = /(?:^| )(\d{1,2}) ?- ?(\d{1,2})(?: |$)/.exec(texto);
      if (marcador) return [Number(marcador[1]), Number(marcador[2])];
    }
    return null;
  } finally {
    await pdf.loadingTask.destroy();
  }
}
