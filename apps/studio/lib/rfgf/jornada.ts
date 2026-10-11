/**
 * Lectura de la página pública de una jornada de la federación. Solo se saca lo que hace falta
 * para saber qué actas están cerradas y de qué partido son: equipos y código de acta.
 *
 * Los marcadores NO se leen de aquí: la web los pinta de forma que no se puedan copiar por
 * programa. Salen del PDF de cada acta, que es la descarga que la propia web ofrece.
 */

export interface PartidoRfgf {
  local: string;
  visitante: string;
  /** Código del acta. `null` mientras el partido no tiene acta cerrada. */
  codActa: string | null;
}

const ENTIDADES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  nbsp: " ",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  ntilde: "ñ",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  Ntilde: "Ñ",
  uuml: "ü",
  Uuml: "Ü",
};

function texto(html: string): string {
  return html
    .replace(/&#(\d+);/g, (_, codigo: string) => String.fromCodePoint(Number(codigo)))
    .replace(/&([a-zA-Z]+);/g, (entera, nombre: string) => ENTIDADES[nombre] ?? entera)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Los partidos de la página, en su orden. Cada partido son dos enlaces de equipo (local y
 * visitante); si entre ellos hay un enlace «Acta del partido», el acta está cerrada.
 */
export function partidosDeJornada(html: string): PartidoRfgf[] {
  const marcas = [
    ...html.matchAll(
      /NFG_VisEquipos\?[^"']*Codigo_Equipo=\d+["'][^>]*>([^<]+)<|NFG_CmpPartido\?[^"'\s>]*CodActa=(\d+)/g,
    ),
  ];
  const partidos: PartidoRfgf[] = [];
  let local: string | null = null;
  let codActa: string | null = null;
  for (const marca of marcas) {
    if (marca[2]) {
      // Un acta solo cuenta si ya se ha visto el equipo local de su partido.
      if (local !== null) codActa = marca[2];
      continue;
    }
    const equipo = texto(marca[1] ?? "");
    if (!equipo) continue;
    if (local === null) {
      local = equipo;
      continue;
    }
    partidos.push({ local, visitante: equipo, codActa });
    local = null;
    codActa = null;
  }
  return partidos;
}
