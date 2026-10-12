import { extractText, getDocumentProxy } from "unpdf";

/** Un partido tal como sale en el PDF de jornada de la federación. */
export interface PartidoJornada {
  local: string;
  visitante: string;
  /** `AAAA-MM-DD`. */
  fecha: string;
  /** `HH:mm`. `null` mientras la federación no la publica. */
  hora: string | null;
  /** Nombre del campo. `null` si está «pendiente de asignar». */
  campo: string | null;
  /** «Hierba Artificial», «Hierba Natural»… `null` si no la trae. */
  superficie: string | null;
  /** Goles de local y visitante. `null` si el partido no se ha jugado. */
  marcador: [number, number] | null;
}

export interface JornadaFederacion {
  competicion: string;
  numero: number;
  partidos: PartidoJornada[];
  /** Bloques que no se supieron leer, tal cual: se enseñan para revisarlos a mano. */
  sinLeer: string[];
}

const limpiar = (texto: string) => texto.normalize("NFC").replace(/\s+/gu, " ").trim();

// «LOCAL [g - g] dd-mm-aaaa [hh:mm] VISITANTE». Marcador y hora, solo cuando los hay.
const CRUCE =
  /^(.+?)\s+(?:(\d{1,2})\s*-\s*(\d{1,2})\s+)?(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{1,2}):(\d{2}))?\s+(.+)$/u;

function campoDe(linea: string): Pick<PartidoJornada, "campo" | "superficie"> {
  // «Campo: A Gandareira - Hierba Artificial Árbitro: APELLIDOS, NOMBRE».
  const texto = limpiar(linea.replace(/^Campo:\s*/iu, "").replace(/\s+Árbitro:.*$/iu, ""));
  if (!texto || /pendiente de asignar/iu.test(texto)) return { campo: null, superficie: null };
  // El nombre puede llevar guiones («San Lorenzo - Vilatuxe»): la superficie es lo último.
  const corte = /^(.*\S)\s*-\s*((?:Hierba|C[eé]sped|Tierra)\b.*)$/iu.exec(texto);
  return corte
    ? { campo: limpiar(corte[1]!), superficie: limpiar(corte[2]!) }
    : { campo: texto, superficie: null };
}

/**
 * Lee el texto del PDF de una jornada («Generar PDF» en la página de la jornada). Cada partido
 * son unas líneas con el cruce y una línea «Campo: …» que lo cierra. Lo que no cuadre con esa
 * forma no se inventa: va a `sinLeer`.
 */
export function parsearJornada(texto: string): JornadaFederacion {
  const lineas = texto.split(/\r?\n/u).map(limpiar).filter(Boolean);
  const cabecera = lineas.findIndex((linea) => /^Jornada\s+\d+$/iu.test(linea));
  if (cabecera < 0) throw new Error("El PDF no es de una jornada de la federación.");
  const numero = Number(/\d+/u.exec(lineas[cabecera]!)![0]);
  const competicion = limpiar((lineas[cabecera - 1] ?? "").replace(/\s*Temporada\s+.*$/iu, ""));

  const partidos: PartidoJornada[] = [];
  const sinLeer: string[] = [];
  let bloque: string[] = [];
  for (const linea of lineas.slice(cabecera + 1)) {
    if (/^Resultados$/iu.test(linea)) continue;
    // El pie del documento: ya no hay más partidos.
    if (/^REAL FEDERACI[OÓ]N/iu.test(linea)) break;
    if (!/^Campo:/iu.test(linea)) {
      bloque.push(linea);
      continue;
    }
    const cruce = CRUCE.exec(bloque.join(" "));
    if (cruce) {
      const [, local, golesLocal, golesVisitante, dia, mes, ano, hora, minuto, visitante] = cruce;
      partidos.push({
        local: limpiar(local!),
        visitante: limpiar(visitante!),
        fecha: `${ano}-${mes}-${dia}`,
        hora: hora ? `${hora.padStart(2, "0")}:${minuto}` : null,
        ...campoDe(linea),
        marcador: golesLocal === undefined ? null : [Number(golesLocal), Number(golesVisitante)],
      });
    } else if (bloque.length) {
      sinLeer.push(bloque.join(" "));
    }
    bloque = [];
  }
  if (bloque.length) sinLeer.push(bloque.join(" "));
  return { competicion, numero, partidos, sinLeer };
}

/** Lo mismo, a partir de los bytes del PDF. */
export async function parsearJornadaPdf(bytes: Uint8Array): Promise<JornadaFederacion> {
  const documento = await getDocumentProxy(bytes);
  if (documento.numPages > 4) throw new Error("El PDF de jornada tiene demasiadas páginas.");
  const { text } = await extractText(documento, { mergePages: true });
  return parsearJornada(text);
}
