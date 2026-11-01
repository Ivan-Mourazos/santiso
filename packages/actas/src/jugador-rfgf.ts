/**
 * Jugadores en la web pública de la federación: quiénes salen en la página de un partido (con
 * su código) y la página de estadísticas de cada uno en la competición de ese partido.
 */

export interface JugadorDeActa {
  /** Código del jugador en la federación. */
  codigo: string;
  /** «APELLIDOS, NOMBRE», como lo escribe la federación. */
  nombre: string;
  lado: "local" | "visitante";
}

export interface EstadisticasOficiales {
  nombre: string;
  equipo: string;
  competicion: string;
  /** «2026-2027». */
  temporada: string;
  convocados: number;
  titular: number;
  suplente: number;
  jugados: number;
  amarillas: number;
  doblesAmarillas: number;
  rojas: number;
  /** `null` si la federación no publica goles en esa competición (alguna eliminatoria). */
  goles: number | null;
}

const ENTIDADES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  quot: '"',
  lt: "<",
  gt: ">",
  apos: "'",
};

function texto(html: string): string {
  return html
    .replace(/<[^>]*>/gu, " ")
    .replace(/&#(\d+);/gu, (_, codigo: string) => String.fromCodePoint(Number(codigo)))
    .replace(/&([a-z]+);/giu, (entera, nombre: string) => ENTIDADES[nombre.toLowerCase()] ?? entera)
    .replace(/[\s ]+/gu, " ")
    .trim();
}

const FILA_JUGADOR =
  /NFG_EstadisticasJugador\?[^'"]*?\bjugador=(\d+)[^'"]*['"][^>]*>\s*<td[^>]*>[^<]*<\/td>\s*<td[^>]*>([^<]*)<\/td>/giu;

/**
 * Los jugadores con ficha enlazada en la página de un partido. El bloque del local va antes
 * que el del visitante: cada uno empieza en su cabecera «Titulares».
 */
export function jugadoresDeActaHtml(html: string): JugadorDeActa[] {
  const cabeceras = [...html.matchAll(/<strong>\s*Titulares\s*<\/strong>/giu)].map(
    (m) => m.index ?? 0,
  );
  const segundo = cabeceras[1] ?? Number.POSITIVE_INFINITY;
  const vistos = new Set<string>();
  const jugadores: JugadorDeActa[] = [];
  for (const m of html.matchAll(FILA_JUGADOR)) {
    const codigo = m[1]!;
    const nombre = texto(m[2]!);
    if (!nombre || vistos.has(codigo)) continue;
    vistos.add(codigo);
    jugadores.push({ codigo, nombre, lado: (m.index ?? 0) < segundo ? "local" : "visitante" });
  }
  return jugadores;
}

/** El número que sigue a una etiqueta («Convocados | 2»). */
function cifra(plano: string, etiqueta: RegExp): number {
  const m = new RegExp(`${etiqueta.source}\\s*\\|?\\s*(\\d+)`, "iu").exec(plano);
  if (!m) throw new Error("La página del jugador no trae todas sus cifras.");
  return Number(m[1]);
}

/**
 * Lee la página de estadísticas de un jugador. Vale para la competición y la temporada del
 * partido con el que se pidió: la propia página lo dice y aquí se devuelve.
 */
export function parsearEstadisticasJugador(html: string): EstadisticasOficiales {
  const inicio = html.search(/Generar PDF/iu);
  const cuerpo = (inicio >= 0 ? html.slice(inicio) : html)
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/giu, " ")
    .replace(/<[^>]*>/gu, " | ");
  const plano = texto(cuerpo.replace(/&nbsp;/giu, " "))
    .replace(/(\s*\|\s*)+/gu, " | ")
    .trim();
  const cabecera =
    /Generar PDF \| (.+?) \| Equipo: \| (?:(.*?) \| )?(.+?) \| Temporada (\d{4}-\d{4})/iu.exec(
      plano,
    );
  if (!cabecera) throw new Error("La página no es la de estadísticas de un jugador.");
  // «Total» sale dos veces: primero el de sanciones y luego el de goles.
  const sinEquipo = /^GRUPO\b/iu.test(cabecera[3]!);
  const goles = /Goles \| Total \|\s*(\d+)/iu.exec(plano);
  return {
    nombre: cabecera[1]!.trim(),
    equipo: sinEquipo ? "" : (cabecera[2] ?? "").trim(),
    competicion: sinEquipo ? `${cabecera[2]} | ${cabecera[3]}` : cabecera[3]!.trim(),
    temporada: cabecera[4]!,
    convocados: cifra(plano, /Convocados/u),
    titular: cifra(plano, /Titular/u),
    suplente: cifra(plano, /Suplente/u),
    jugados: cifra(plano, /Jugados/u),
    amarillas: cifra(plano, /\| Tarjeta amarilla/u),
    doblesAmarillas: cifra(plano, /Doble tarjeta amarilla/u),
    rojas: cifra(plano, /Tarjeta roja/u),
    goles: goles ? Number(goles[1]) : null,
  };
}
