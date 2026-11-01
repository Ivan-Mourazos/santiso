/**

 * Un equipo en la web pública de la federación: su código (sale en la página de cada jornada)

 * y la lista de competiciones y grupos en los que ha jugado, temporada a temporada.

 */

export interface GrupoDeEquipo {
  /** «2025-2026». */

  temporada: string;

  competicion: string;

  codCompeticion: string;

  grupo: string;

  codGrupo: string;
}

export interface PartidoConCodigos {
  codLocal: string;

  local: string;

  codVisitante: string;

  visitante: string;

  codActa: string;
}

const limpio = (texto: string) =>
  texto

    .replace(/<[^>]*>/gu, " ")

    .replace(/&nbsp;/giu, " ")

    .replace(/&amp;/giu, "&")

    .replace(/&gt;/giu, ">")

    .replace(/&quot;/giu, '"')

    .replace(/[\s ]+/gu, " ")

    .trim();

/**

 * Los partidos con acta de la página de una jornada, con el código de cada equipo. El acta va

 * entre el enlace de su local y el de su visitante, así que se parte de cada acta: el equipo

 * de antes y el de después. (En grupos impares la página empieza con el equipo que descansa,

 * y contar de dos en dos descuadraría todos los partidos.)

 */

export function partidosConCodigos(html: string): PartidoConCodigos[] {
  const marcas = [
    ...html.matchAll(
      /NFG_VisEquipos\?[^"']*Codigo_Equipo=(\d+)["'][^>]*>([^<]+)<|NFG_CmpPartido\?[^"'\s>]*CodActa=(\d+)/gu,
    ),
  ];

  const partidos: PartidoConCodigos[] = [];

  const vistas = new Set<string>();

  for (const [i, marca] of marcas.entries()) {
    const codActa = marca[3];

    if (!codActa || vistas.has(codActa)) continue;

    const antes = marcas[i - 1];

    const despues = marcas.slice(i + 1).find((otra) => !otra[3] || otra[3] !== codActa);

    if (!antes?.[1] || !despues?.[1]) continue;

    vistas.add(codActa);

    partidos.push({
      codLocal: antes[1],

      local: limpio(antes[2] ?? ""),

      codVisitante: despues[1],

      visitante: limpio(despues[2] ?? ""),

      codActa,
    });
  }

  return partidos;
}

/**

 * Lee la página «competiciones del equipo»: bajo el título de cada temporada, una fila por

 * competición y grupo. El código del grupo sale del enlace a su ficha.

 */

export function gruposDeEquipoHtml(html: string): GrupoDeEquipo[] {
  const grupos: GrupoDeEquipo[] = [];

  const titulos = [...html.matchAll(/<h4[^>]*>(?:\s|&nbsp;)*(\d{4}-\d{4})\s*<\/h4>/giu)];

  for (const [i, titulo] of titulos.entries()) {
    const desde = (titulo.index ?? 0) + titulo[0].length;

    const hasta = titulos[i + 1]?.index ?? html.length;

    const bloque = html.slice(desde, hasta);

    for (const fila of bloque.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/giu)) {
      const competicion =
        /NFG_VisCompeticiones_Vis\?[^'"]*codcompeticion=(\d+)['"][^>]*>([^<]*)</iu.exec(fila[1]!);

      const grupo = /NFG_VisGrupos_Vis\?[^'"]*codgrupo=(\d+)['"][^>]*>([^<]*)</iu.exec(fila[1]!);

      if (!competicion || !grupo) continue;

      grupos.push({
        temporada: titulo[1]!,

        competicion: limpio(competicion[2]!),

        codCompeticion: competicion[1]!,

        grupo: limpio(grupo[2]!),

        codGrupo: grupo[1]!,
      });
    }
  }

  return grupos;
}

/** El código que la federación da a cada temporada: «2026-2027» es el 22. */

export function codigoDeTemporada(temporada: string): string | null {
  const inicio = /^(\d{4})-\d{4}$/u.exec(temporada)?.[1];

  return inicio ? String(Number(inicio) - 2004) : null;
}

/** Competiciones de un club en la temporada solicitada; null si no publica tabla. */

export function competicionesDeClubHtml(html: string) {
  const temporadas = [
    ...html.matchAll(/<option[^>]*value=["']?(\d+)["']?[^>]*>\s*(\d{4}-\d{4})/giu),
  ].map((m) => ({ codigo: m[1]!, temporada: m[2]! }));

  const tabla = [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/giu)].find(
    (m) => /Equipo/iu.test(m[1]!) && /Categoría|Categoria/iu.test(m[1]!) && /Grupo/iu.test(m[1]!),
  );

  if (!tabla) return { temporadas, grupos: null };

  const grupos: (Omit<GrupoDeEquipo, "temporada"> & {
    codEquipo: string;
    equipo: string;
    categoria: string;
  })[] = [];

  for (const fila of tabla[1]!.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/giu)) {
    const celdas = [...fila[1]!.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/giu)].map((m) => m[1]!);

    const codigo = (celda: string, parametro: string) =>
      new RegExp(`${parametro}=(\\d+)`, "iu").exec(celda)?.[1];

    const codEquipo = codigo(celdas[0] ?? "", "codequipo");

    const codCompeticion = codigo(celdas[2] ?? "", "codcompeticion");

    const codGrupo = codigo(celdas[3] ?? "", "codgrupo");

    const categoria = limpio(celdas[1] ?? "");

    const competicion = limpio(celdas[2] ?? "");

    if (
      !codEquipo ||
      !codCompeticion ||
      !codGrupo ||
      /FEMENIN|L\.\s*G\.\s*F\.|SALA/iu.test(`${categoria} ${competicion}`)
    )
      continue;

    grupos.push({
      codEquipo,
      equipo: limpio(celdas[0]!),
      categoria,
      competicion,
      codCompeticion,
      codGrupo,
      grupo: limpio(celdas[3]!),
    });
  }

  return { temporadas, grupos };
}
