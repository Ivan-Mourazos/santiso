/**
 * Apuntes que parecen el mismo: con dos móviles apuntando a la vez (delegado y míster) es fácil
 * que el mismo gol entre dos veces. Solo avisa; borrar lo decide quien apunta.
 */
import type { EventoDirecto } from "./tipos";

/** Minutos de diferencia que se admiten para considerar que es el mismo apunte. */
const MARGEN_MINUTOS = 2;

/** Mismo jugador: por id si los dos lo tienen; si no, por dorsal; sin datos, puede serlo. */
function mismaPersona(
  a: { id: string | null; dorsal: number | null },
  b: { id: string | null; dorsal: number | null },
): boolean {
  if (a.id && b.id) return a.id === b.id;
  if (a.dorsal !== null && b.dorsal !== null) return a.dorsal === b.dorsal;
  return true;
}

function parecidos(a: EventoDirecto, b: EventoDirecto): boolean {
  if (a.id === b.id || a.tipo !== b.tipo || a.lado !== b.lado || a.parte !== b.parte) return false;
  if (a.minuto !== null && b.minuto !== null && Math.abs(a.minuto - b.minuto) > MARGEN_MINUTOS)
    return false;
  if (!mismaPersona({ id: a.jugadorId, dorsal: a.dorsal }, { id: b.jugadorId, dorsal: b.dorsal }))
    return false;
  if (a.tipo === "cambio") {
    return mismaPersona(
      { id: a.jugadorSaleId, dorsal: a.dorsalSale },
      { id: b.jugadorSaleId, dorsal: b.dorsalSale },
    );
  }
  return true;
}

/** El primer apunte ya guardado que parece el mismo que `evento`, o `null`. */
export function posibleDuplicado(
  evento: EventoDirecto,
  eventos: readonly EventoDirecto[],
): EventoDirecto | null {
  return eventos.find((e) => parecidos(evento, e)) ?? null;
}

/** Ids de los apuntes que tienen al menos otro parecido, para marcarlos en la lista. */
export function repetidos(eventos: readonly EventoDirecto[]): Set<string> {
  const ids = new Set<string>();
  eventos.forEach((e, i) => {
    for (const otro of eventos.slice(i + 1)) {
      if (parecidos(e, otro)) {
        ids.add(e.id);
        ids.add(otro.id);
      }
    }
  });
  return ids;
}
