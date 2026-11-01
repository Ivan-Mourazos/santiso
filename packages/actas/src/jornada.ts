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
  /** «APELLIDOS, NOMBRE», tal como lo escribe la federación. `null` hasta que se juega. */
  arbitro: string | null;
}

export interface JornadaFederacion {
  competicion: string;
  /** `null` en una ronda de copa, que no va numerada. */
  numero: number | null;
  /** Título de la ronda de copa («FASE PREVIA»). */
  fase?: string;
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
 * Un árbitro de nombre largo ocupa dos líneas («…MONTOUTO,» y «RUBEN»). Sin juntarlas se
 * pierde el nombre de pila y la segunda línea se pega al equipo local del partido siguiente.
 * Si la línea de «Campo:» acaba en coma, la siguiente es seguro el nombre; si no, solo cuando
 * el PDF la sitúa bajo la columna del árbitro (`sigueArbitro`).
 */
function juntarArbitros(lineas: string[], sigueArbitro: ReadonlySet<string>): string[] {
  const salida: string[] = [];
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i]!;
    const siguiente = lineas[i + 1];
    if (
      siguiente !== undefined &&
      /^Campo:.*Árbitro:/iu.test(linea) &&
      (linea.endsWith(",") || sigueArbitro.has(siguiente))
    ) {
      salida.push(`${linea} ${siguiente}`);
      i++;
    } else {
      salida.push(linea);
    }
  }
  return salida;
}

/**
 * Lee el texto del PDF de una jornada («Generar PDF» en la página de la jornada). Cada partido
 * son unas líneas con el cruce y una línea «Campo: …» que lo cierra. Lo que no cuadre con esa
 * forma no se inventa: va a `sinLeer`.
 */
export function parsearJornada(
  texto: string,
  /** Líneas que en el PDF caen bajo «Árbitro:»: son el final de su nombre, no otro equipo. */
  sigueArbitro: ReadonlySet<string> = new Set(),
): JornadaFederacion {
  const lineas = juntarArbitros(texto.split(/\r?\n/u).map(limpiar).filter(Boolean), sigueArbitro);
  const numerada = lineas.findIndex((linea) => /^Jornada\s+\d+$/iu.test(linea));
  // En una copa el título es el de la ronda, entre la temporada y «Resultados».
  const ronda = lineas.findIndex(
    (linea, i) =>
      /\bTemporada\s+\d{4}-\d{4}$/iu.test(linea) && /^Resultados$/iu.test(lineas[i + 2] ?? ""),
  );
  const cabecera = numerada >= 0 ? numerada : ronda < 0 ? -1 : ronda + 1;
  if (cabecera < 0) throw new Error("El PDF no es de una jornada de la federación.");
  const numero = numerada >= 0 ? Number(/\d+/u.exec(lineas[numerada]!)![0]) : null;
  const competicion = limpiar((lineas[cabecera - 1] ?? "").replace(/\s*Temporada\s+.*$/iu, ""));

  const partidos: PartidoJornada[] = [];
  const sinLeer: string[] = [];
  let bloque: string[] = [];
  // Un cambio de hoja separa el «Árbitro:» de su «Campo:»: queda aquí hasta que llegue.
  let arbitroSuelto = "";
  for (const [i, leida] of lineas.entries()) {
    if (i <= cabecera) continue;
    let linea = leida;
    if (/^Resultados$/iu.test(linea)) continue;
    // Quién pasa de ronda y por penaltis: el resultado va aparte y aquí estorba al cruce.
    if (/^(?:\((?:P|Clasificado)\)\s*)+$/iu.test(linea)) continue;
    if (/^Penaltis:\s*\d+\s*-\s*\d+$/iu.test(linea)) continue;
    // El pie sale en cada hoja; solo acaba el documento si detrás no queda ningún partido.
    if (/^REAL FEDERACI[OÓ]N/iu.test(linea) || /^GALLEGA DE F[UÚ]TBOL/iu.test(linea)) {
      if (!lineas.slice(i + 1).some((l) => /^Campo:/iu.test(l))) break;
      continue;
    }
    if (/^Árbitro:/iu.test(linea)) {
      arbitroSuelto = limpiar(linea.replace(/^Árbitro:/iu, ""));
      continue;
    }
    if (!/^Campo:/iu.test(linea)) {
      bloque.push(linea);
      continue;
    }
    if (arbitroSuelto) {
      // El final del nombre del árbitro cae pegado a la superficie: «… Hierba Artificial RUBEN».
      const pegado = /^(.*\b(?:Hierba\s+\p{L}+|C[eé]sped|Tierra))\s+(\p{Lu}[\p{Lu}\s]*)$/u.exec(
        linea,
      );
      if (pegado) {
        linea = pegado[1]!;
        arbitroSuelto = `${arbitroSuelto} ${pegado[2]}`;
      }
      linea = `${linea} Árbitro: ${arbitroSuelto}`;
      arbitroSuelto = "";
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
        arbitro: limpiar(/Árbitro:\s*(.*)$/iu.exec(linea)?.[1] ?? "") || null,
        marcador: golesLocal === undefined ? null : [Number(golesLocal), Number(golesVisitante)],
      });
    } else if (bloque.length) {
      sinLeer.push(bloque.join(" "));
    }
    bloque = [];
  }
  if (bloque.length) sinLeer.push(bloque.join(" "));
  return {
    competicion,
    numero,
    ...(numero === null ? { fase: lineas[cabecera]! } : {}),
    partidos,
    sinLeer,
  };
}

/** Lo mismo, a partir de los bytes del PDF. */
export async function parsearJornadaPdf(bytes: Uint8Array): Promise<JornadaFederacion> {
  const documento = await getDocumentProxy(bytes);
  if (documento.numPages > 4) throw new Error("El PDF de jornada tiene demasiadas páginas.");
  // Lo que cae justo debajo de un «Árbitro:» y en su misma columna sigue su nombre.
  const sigueArbitro = new Set<string>();
  for (let n = 1; n <= documento.numPages; n++) {
    const contenido = await (await documento.getPage(n)).getTextContent();
    const items = contenido.items.filter((item) => "str" in item && item.str.trim()) as {
      str: string;
      transform: number[];
    }[];
    const arbitros = items.filter((item) => /^Árbitro:/iu.test(item.str.trim()));
    for (const item of items)
      for (const arbitro of arbitros) {
        const dx = item.transform[4]! - arbitro.transform[4]!;
        const dy = arbitro.transform[5]! - item.transform[5]!;
        if (Math.abs(dx) < 4 && dy > 4 && dy < 16) sigueArbitro.add(limpiar(item.str));
      }
  }
  const { text } = await extractText(documento, { mergePages: true });
  return parsearJornada(text, sigueArbitro);
}
