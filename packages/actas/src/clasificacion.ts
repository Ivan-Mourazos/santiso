import { extractText, getDocumentProxy } from "unpdf";

/** Una fila de la clasificación oficial de la federación. */
export interface FilaOficial {
  posicion: number;
  equipo: string;
  puntos: number;
  jugados: number;
  ganados: number;
  empatados: number;
  perdidos: number;
  golesFavor: number;
  golesContra: number;
  /** Puntos que el comité le ha quitado. 0 si ninguno. */
  sancion: number;
}

export interface ClasificacionOficial {
  competicion: string;
  /** La jornada hasta la que está calculada. */
  jornada: number;
  filas: FilaOficial[];
}

const limpiar = (texto: string) => texto.normalize("NFC").replace(/\s+/gu, " ").trim();

// «3 GUERREROS DEL SOL 4 2 1 1 0 7 3 G E 0»: puesto, equipo, puntos, J G E P, goles a favor y
// en contra, la racha (una letra por partido) y los puntos de sanción.
const FILA = /^(\d{1,2}) (.+?) (-?\d+) (\d+) (\d+) (\d+) (\d+) (\d+) (\d+)((?: [GEP])*) (\d+)$/u;

/**
 * Lee el texto del PDF de clasificación de la federación («Generar PDF» en la página de la
 * clasificación). Primero trae los resultados de la jornada; la tabla empieza tras la cabecera
 * «Equipos Partidos Goles…».
 */
export function parsearClasificacion(texto: string): ClasificacionOficial {
  const lineas = texto.split(/\r?\n/u).map(limpiar).filter(Boolean);
  const cabecera = lineas.findIndex((linea) => /^Jornada\s+\d+/iu.test(linea));
  const tabla = lineas.findIndex((linea) => /^Equipos\b.*\bPartidos\b/iu.test(linea));
  if (cabecera < 0 || tabla < 0) {
    throw new Error("El PDF no es una clasificación de la federación.");
  }
  const filas: FilaOficial[] = [];
  for (const linea of lineas.slice(tabla + 1)) {
    if (/^(\(\*\)|REAL FEDERACI[OÓ]N)/iu.test(linea)) break;
    const m = FILA.exec(linea);
    if (!m) continue;
    const [, posicion, equipo, puntos, j, g, e, p, gf, gc, , sancion] = m;
    filas.push({
      posicion: Number(posicion),
      equipo: limpiar(equipo!),
      puntos: Number(puntos),
      jugados: Number(j),
      ganados: Number(g),
      empatados: Number(e),
      perdidos: Number(p),
      golesFavor: Number(gf),
      golesContra: Number(gc),
      sancion: Number(sancion),
    });
  }
  if (filas.length === 0) throw new Error("La clasificación de la federación no trae equipos.");
  return {
    competicion: limpiar((lineas[cabecera - 1] ?? "").replace(/\s*Temporada\s+.*$/iu, "")),
    jornada: Number(/\d+/u.exec(lineas[cabecera]!)![0]),
    filas,
  };
}

/** Lo mismo, a partir de los bytes del PDF. */
export async function parsearClasificacionPdf(bytes: Uint8Array): Promise<ClasificacionOficial> {
  const documento = await getDocumentProxy(bytes);
  if (documento.numPages > 4) throw new Error("El PDF de clasificación tiene demasiadas páginas.");
  const { text } = await extractText(documento, { mergePages: true });
  return parsearClasificacion(text);
}
