/** Textos y cuentas de la pantalla de directo, sin React. */
import type { EventoDirecto, JugadorDirecto, PantallaDirecto } from "@/lib/directo/tipos";

/** Si el gol sube a nuestro marcador: nuestro sin «en propia», o del rival en su portería. */
export const golNuestro = (e: EventoDirecto) => (e.lado === "propio") !== e.propia;

/** Marcador en el orden real del partido: local – visitante. */
export function marcador(p: PantallaDirecto["partido"], eventos: EventoDirecto[]) {
  const goles = eventos.filter((e) => e.tipo === "gol");
  const nuestros = goles.filter(golNuestro).length;
  const suyos = goles.length - nuestros;
  return p.somosLocal ? { local: nuestros, visitante: suyos } : { local: suyos, visitante: nuestros };
}

/** «#9 Brais», «#7» o «Sin dorsal». */
export function quien(
  id: string | null,
  dorsal: number | null,
  jugadores: JugadorDirecto[],
): string {
  const j = id ? jugadores.find((x) => x.id === id) : undefined;
  const numero = dorsal ?? j?.dorsal ?? null;
  const partes = [numero !== null ? `#${numero}` : "", j?.nombre ?? ""].filter(Boolean);
  return partes.join(" ") || "Sin dorsal";
}

/** Descripción de un apunte para la lista y el cierre del acta. */
export function descripcion(e: EventoDirecto, jugadores: JugadorDirecto[]): string {
  if (e.tipo === "cambio") {
    return `${quien(e.jugadorId, e.dorsal, jugadores)} entra · ${quien(e.jugadorSaleId, e.dorsalSale, jugadores)} sale`;
  }
  const texto = quien(e.jugadorId, e.dorsal, jugadores);
  return e.tipo === "gol" && e.propia ? `${texto} (en propia)` : texto;
}
