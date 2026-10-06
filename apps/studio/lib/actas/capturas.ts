import type { ActaEvent, ActaPlayerRef, ParsedActa } from "./types";

/** Capturas de una misma acta que se mandan juntas al modelo. */
export const MAX_CAPTURAS = 8;
/** La petición a Gemini lleva las imágenes dentro; por encima de esto la rechaza. */
export const MAX_BYTES_CAPTURAS = 18 * 1024 * 1024;

export interface ArchivoActa {
  name: string;
  type: string;
  size: number;
}

export interface SeleccionActa<T extends ArchivoActa> {
  archivos: T[];
  /** Explica qué se dejó fuera, si se dejó algo. */
  aviso: string | null;
}

const esPdf = (archivo: ArchivoActa) => archivo.type === "application/pdf";
const esImagen = (archivo: ArchivoActa) => archivo.type.startsWith("image/");

/**
 * Decide qué se analiza de lo que eligió el usuario: una ficha PDF sola, o varias capturas de
 * la misma acta. Un PDF manda sobre las imágenes porque se lee en local y es exacto.
 */
export function elegirArchivosDeActa<T extends ArchivoActa>(
  elegidos: readonly T[],
): SeleccionActa<T> {
  const pdf = elegidos.find(esPdf);
  if (pdf) {
    return {
      archivos: [pdf],
      aviso: elegidos.length > 1 ? "Con una ficha PDF solo se usa ese fichero." : null,
    };
  }

  const imagenes = elegidos.filter(esImagen);
  const avisos: string[] = [];
  if (imagenes.length < elegidos.length) {
    avisos.push("Solo valen imágenes o una ficha PDF.");
  }

  let archivos = imagenes.slice(0, MAX_CAPTURAS);
  if (imagenes.length > MAX_CAPTURAS) {
    avisos.push(`Se usan las ${MAX_CAPTURAS} primeras capturas.`);
  }

  let total = 0;
  const caben: T[] = [];
  for (const archivo of archivos) {
    if (total + archivo.size > MAX_BYTES_CAPTURAS) break;
    total += archivo.size;
    caben.push(archivo);
  }
  if (caben.length < archivos.length) {
    avisos.push(
      `Las capturas pesan demasiado: se usan ${caben.length} de ${archivos.length}.`,
    );
    archivos = caben;
  }

  return { archivos, aviso: avisos.length > 0 ? avisos.join(" ") : null };
}

function clavePersona(jugador: ActaPlayerRef | undefined) {
  if (!jugador) return "";
  return jugador.jugadorId ?? `${jugador.dorsal}|${jugador.rawName.trim().toLowerCase()}`;
}

function claveEvento(evento: ActaEvent) {
  return [
    evento.tipo,
    evento.minuto,
    evento.isRival ? "r" : "s",
    clavePersona(evento.jugador),
    clavePersona(evento.jugadorSale),
    clavePersona(evento.jugadorEntra),
    (evento.nombreRival ?? "").trim().toLowerCase(),
  ].join("#");
}

/**
 * Con varias capturas que se solapan, el modelo puede devolver dos veces el mismo jugador o el
 * mismo evento. Se queda con la primera aparición; quien sale de titular no repite de suplente.
 */
export function sinRepetidos(acta: ParsedActa): ParsedActa {
  const vistos = new Set<string>();
  const unicos = (jugadores: ActaPlayerRef[]) =>
    jugadores.filter((jugador) => {
      const clave = clavePersona(jugador);
      if (vistos.has(clave)) return false;
      vistos.add(clave);
      return true;
    });
  const titulares = unicos(acta.titulares);
  const suplentes = unicos(acta.suplentes);

  const eventosVistos = new Set<string>();
  const eventos = acta.eventos.filter((evento) => {
    const clave = claveEvento(evento);
    if (eventosVistos.has(clave)) return false;
    eventosVistos.add(clave);
    return true;
  });

  return { ...acta, titulares, suplentes, eventos };
}
