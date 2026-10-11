import { similitudTokens } from "@santiso/domain";

import type { ActaPlayerRef, ParsedActa } from "./types";

/** Lo que hace falta de un jugador de la plantilla para reconocerlo en un acta. */
export interface JugadorPlantilla {
  id: string;
  nombre: string;
  apodo: string | null;
}

/** Por debajo de esto el nombre del acta no se da por reconocido. */
const MINIMO = 0.6;
/** Ventaja mínima sobre el segundo candidato: si dos se parecen igual, no se elige. */
const VENTAJA = 0.15;

function nombreVisible(jugador: JugadorPlantilla): string {
  if (jugador.apodo?.trim()) return jugador.apodo.trim();
  const partes = jugador.nombre.trim().split(/\s+/);
  return partes.length > 1 ? `${partes[0]} ${partes[1]}` : jugador.nombre;
}

/**
 * El jugador de la plantilla que corresponde a un nombre del acta, solo si no hay duda. La
 * federación escribe «APELLIDOS, NOMBRE» y aquí se guarda «Nombre Apellidos»: se comparan las
 * palabras sin orden. El dorsal no cuenta: el del día de partido no es el de la temporada.
 */
export function jugadorSeguro(
  nombreActa: string,
  plantilla: readonly JugadorPlantilla[],
): JugadorPlantilla | null {
  const candidatos = plantilla
    .map((jugador) => ({ jugador, puntos: similitudTokens(nombreActa, jugador.nombre) }))
    .sort((a, b) => b.puntos - a.puntos);
  const [mejor, segundo] = candidatos;
  if (!mejor || mejor.puntos < MINIMO) return null;
  if (segundo && mejor.puntos - segundo.puntos < VENTAJA) return null;
  return mejor.jugador;
}

export interface ActaEnlazada {
  acta: ParsedActa;
  /** Nombres del acta que no se pudieron atribuir con seguridad a nadie de la plantilla. */
  dudas: string[];
}

/**
 * Enlaza cada jugador del acta con la plantilla, sin intervención de nadie. Sirve para decidir
 * si un acta se puede guardar sola: con una sola duda, no.
 */
export function enlazarActa(acta: ParsedActa, plantilla: readonly JugadorPlantilla[]): ActaEnlazada {
  const dudas = new Set<string>();
  const enlazar = (ref: ActaPlayerRef): ActaPlayerRef => {
    const jugador = jugadorSeguro(ref.rawName, plantilla);
    if (!jugador) {
      dudas.add(ref.rawName.trim() || "(sin nombre)");
      return ref;
    }
    return { ...ref, jugadorId: jugador.id, displayName: nombreVisible(jugador) };
  };
  const opcional = (ref?: ActaPlayerRef) => (ref ? enlazar(ref) : undefined);

  const enlazada: ParsedActa = {
    ...acta,
    titulares: acta.titulares.map(enlazar),
    suplentes: acta.suplentes.map(enlazar),
    eventos: acta.eventos.map((evento) => ({
      ...evento,
      jugador: opcional(evento.jugador),
      jugadorSale: opcional(evento.jugadorSale),
      jugadorEntra: opcional(evento.jugadorEntra),
    })),
  };

  // Dos nombres del acta atribuidos a la misma persona: uno de los dos está mal.
  const vistos = new Map<string, string>();
  for (const ref of [...enlazada.titulares, ...enlazada.suplentes]) {
    if (!ref.jugadorId) continue;
    const anterior = vistos.get(ref.jugadorId);
    if (anterior && anterior !== ref.rawName) dudas.add(`${anterior} / ${ref.rawName}`);
    vistos.set(ref.jugadorId, ref.rawName);
  }
  return { acta: enlazada, dudas: [...dudas] };
}
