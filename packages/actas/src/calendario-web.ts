import { getDocumentProxy } from "unpdf";
import type { Calendario, EquipoCalendario, JornadaCalendario } from "./calendario";

/**
 * Lectura de la página del calendario de la federación. Sirve para lo que el PDF de liga no
 * cubre: una copa (rondas con nombre y cruces que se van sorteando) o una liga con descansos.
 * Solo saca rondas, fechas y equipos; los marcadores de esa página no se leen.
 */

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
  uuml: "ü",
};

function texto(html: string): string {
  return html
    .replace(/<[^>]*>/gu, " ")
    .replace(/&#(\d+);/gu, (_, codigo: string) => String.fromCodePoint(Number(codigo)))
    .replace(/&([a-z]+);/giu, (entera, nombre: string) => {
      const letra = ENTIDADES[nombre.toLowerCase()];
      if (!letra) return entera;
      return nombre[0] === nombre[0]!.toUpperCase() ? letra.toUpperCase() : letra;
    })
    .normalize("NFC")
    .replace(/\s+/gu, " ")
    .trim();
}

/** Lo que la federación pone donde aún no hay equipo: el cruce está por sortear. */
const SIN_EQUIPO = /no asignado|descansa/iu;

const fase = (nombre: string) => nombre.charAt(0) + nombre.slice(1).toLowerCase();

function fechaIso(fecha: string): string {
  const [dia, mes, ano] = fecha.split("-");
  return `${ano}-${mes}-${dia}`;
}

/** «Jornada 3 (18-10-2026)» o «FASE PREVIA , 31-10-2026». `null` si no es cabecera de ronda. */
function cabecera(linea: string): { numero: number | null; fase?: string; fecha: string } | null {
  const m = /^(.+?)[\s,(]+(\d{2}-\d{2}-\d{4})\)?$/u.exec(linea);
  if (!m) return null;
  const jornada = /^Jornada\s+(\d+)$/iu.exec(m[1]!);
  return jornada
    ? { numero: Number(jornada[1]), fecha: fechaIso(m[2]!) }
    : { numero: null, fase: fase(m[1]!), fecha: fechaIso(m[2]!) };
}

/** Rondas en orden de página: su posición es el número con el que la federación las pide. */
export function parsearCalendarioWeb(html: string): Calendario {
  const titulo = /<h4[^>]*>([^<]+?)(?:<br\s*\/?>\s*)+Temporada\s+(\d{4})-(\d{4})/iu.exec(html);
  if (!titulo || Number(titulo[3]) !== Number(titulo[2]) + 1) {
    throw new Error("La página no es el calendario de una competición.");
  }
  const equipos = new Map<string, EquipoCalendario>();
  const equipo = (nombre: string) => {
    const conocido = equipos.get(nombre);
    if (conocido) return conocido;
    const nuevo = { nombre, codigoFederativo: "" };
    equipos.set(nombre, nuevo);
    return nuevo;
  };

  const jornadas: JornadaCalendario[] = [];
  const trozos = html.split(/<th\s+colspan=\d+[^>]*>/iu).slice(1);
  for (const trozo of trozos) {
    const corte = trozo.search(/<\/th>/iu);
    const leida = corte < 0 ? null : cabecera(texto(trozo.slice(0, corte)));
    if (!leida) continue;
    const lados = [
      ...trozo.matchAll(/<td\s+width="?47%"?\s+align="?(right|left)"?[^>]*>([\s\S]*?)<\/td>/giu),
    ].map((m) => ({ lado: m[1]!.toLowerCase(), nombre: texto(m[2]!) }));
    const partidos: JornadaCalendario["partidos"] = [];
    for (let i = 0; i + 1 < lados.length; i += 2) {
      const [local, visitante] = [lados[i]!, lados[i + 1]!];
      if (local.lado !== "right" || visitante.lado !== "left") {
        throw new Error("Fila de partido del calendario inválida.");
      }
      if (!local.nombre || !visitante.nombre) continue;
      if (SIN_EQUIPO.test(local.nombre) || SIN_EQUIPO.test(visitante.nombre)) continue;
      partidos.push({ local: equipo(local.nombre), visitante: equipo(visitante.nombre) });
    }
    jornadas.push({
      numero: leida.numero ?? jornadas.length + 1,
      fechaNominal: leida.fecha,
      ...(leida.fase ? { fase: leida.fase } : {}),
      partidos,
    });
  }
  if (jornadas.length === 0 || equipos.size === 0) {
    throw new Error("El calendario de la federación no trae partidos.");
  }
  if (new Set(jornadas.map((j) => j.numero)).size !== jornadas.length) {
    throw new Error("Jornadas duplicadas en el calendario.");
  }
  return {
    competicion: texto(titulo[1]!),
    temporada: `${titulo[2]}-${titulo[3]}`,
    equipos: [...equipos.values()],
    jornadas: jornadas.sort((a, b) => a.numero - b.numero),
  };
}

/**
 * Los equipos del catálogo del PDF del calendario con su código de club. En una copa no van
 * numerados, y por eso el lector de liga los rechaza. Un nombre partido en dos renglones
 * se queda fuera: el equipo vale igual, solo que sin código.
 */
export async function catalogoDeCalendarioPdf(bytes: Uint8Array): Promise<EquipoCalendario[]> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  try {
    const salida: EquipoCalendario[] = [];
    for (let n = 1; n <= Math.min(pdf.numPages, 6); n++) {
      const contenido = await (await pdf.getPage(n)).getTextContent();
      for (const item of contenido.items) {
        if (!("str" in item)) continue;
        const m = /^(.+?)\s+\((\d{1,6})\)$/u.exec(item.str.normalize("NFC").trim());
        if (m) salida.push({ nombre: m[1]!, codigoFederativo: m[2]! });
      }
    }
    return salida;
  } finally {
    await pdf.loadingTask.destroy();
  }
}
