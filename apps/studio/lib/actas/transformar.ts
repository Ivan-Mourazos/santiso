import { MINUTO_MAXIMO } from "@santiso/domain";
import type { ActaEvent, ParsedActa } from "./types";

/** El acta trae algo que no se puede guardar: se detiene antes de tocar la base de datos. */
export class ErrorActa extends Error {}

export interface ParticipacionActa {
  jugadorId: string;
  titular: boolean;
  jugo: boolean;
}

export interface EventoActa {
  tipo: ActaEvent["tipo"];
  lado: "propio" | "rival";
  propia: boolean;
  minuto: number | null;
  jugadorId: string | null;
  jugadorSaleId: string | null;
  nombreRival: string | null;
}

/** Jugador propio al que se le anota el evento, si lo hay. */
const jugadorDelEvento = (evento: ActaEvent): string | null =>
  (evento.tipo === "cambio" ? evento.jugadorEntra?.jugadorId : evento.jugador?.jugadorId) ?? null;

/**
 * Convocatoria: titulares juegan, suplentes no, y cualquiera con eventos pasa a haber jugado.
 * Los goles no se guardan aquí: se derivan de los eventos (una sola fuente de verdad).
 */
export function participacionesDeActa(acta: ParsedActa): ParticipacionActa[] {
  const participaciones = new Map<string, ParticipacionActa>();

  for (const jugador of acta.titulares) {
    if (!jugador.jugadorId) continue;
    participaciones.set(jugador.jugadorId, {
      jugadorId: jugador.jugadorId,
      titular: true,
      jugo: true,
    });
  }
  for (const jugador of acta.suplentes) {
    if (!jugador.jugadorId || participaciones.has(jugador.jugadorId)) continue;
    participaciones.set(jugador.jugadorId, {
      jugadorId: jugador.jugadorId,
      titular: false,
      jugo: false,
    });
  }

  for (const evento of acta.eventos) {
    const implicados = [jugadorDelEvento(evento), evento.jugadorSale?.jugadorId ?? null];
    for (const jugadorId of implicados) {
      if (!jugadorId) continue;
      const existente = participaciones.get(jugadorId);
      if (existente) existente.jugo = true;
      else participaciones.set(jugadorId, { jugadorId, titular: false, jugo: true });
    }
  }

  return [...participaciones.values()];
}

/** Minuto del acta: vacío es `null`; fuera de rango detiene el guardado. */
function minutoDe(evento: ActaEvent): number | null {
  const texto = evento.minuto.trim();
  if (!texto) return null;
  const minuto = Number(texto);
  if (!Number.isInteger(minuto) || minuto < 0 || minuto > MINUTO_MAXIMO) {
    throw new ErrorActa(
      `Minuto no válido en un evento ${evento.tipo}: "${evento.minuto}". Debe estar entre 0 y ${MINUTO_MAXIMO}.`,
    );
  }
  return minuto;
}

/**
 * Eventos del acta en la forma de la tabla. Cubre las 7 combinaciones conocidas y **rechaza**
 * cualquier otra: es preferible detenerse a escribir una fila que el CHECK rechazaría luego.
 */
export function eventosDeActa(acta: ParsedActa): EventoActa[] {
  const filas = acta.eventos.map((evento): EventoActa => {
    const minuto = minutoDe(evento);
    const jugadorId = jugadorDelEvento(evento);
    const nombreRival = evento.nombreRival?.trim() || null;
    const base = {
      tipo: evento.tipo,
      propia: false,
      minuto,
      jugadorId: null,
      jugadorSaleId: null,
      nombreRival: null,
    } satisfies Omit<EventoActa, "lado">;

    if (evento.tipo === "cambio") {
      const saleId = evento.jugadorSale?.jugadorId ?? null;
      if (evento.isRival || !jugadorId || !saleId) {
        throw new ErrorActa(
          `Cambio incompleto en el minuto ${evento.minuto}: hacen falta el jugador que entra y el que sale.`,
        );
      }
      return { ...base, lado: "propio", jugadorId, jugadorSaleId: saleId };
    }

    if (evento.tipo === "gol") {
      if (!evento.isRival && jugadorId) return { ...base, lado: "propio", jugadorId };
      if (!evento.isRival && evento.esPropia) {
        return { ...base, lado: "propio", propia: true, nombreRival };
      }
      if (evento.isRival && evento.esPropiaSantiso && jugadorId) {
        return { ...base, lado: "rival", propia: true, jugadorId };
      }
      if (evento.isRival) return { ...base, lado: "rival", nombreRival };
    }

    if (evento.tipo === "tarjeta_amarilla" || evento.tipo === "tarjeta_roja") {
      if (!evento.isRival && jugadorId) return { ...base, lado: "propio", jugadorId };
      if (evento.isRival) return { ...base, lado: "rival", nombreRival };
    }

    throw new ErrorActa(
      `Evento ${evento.tipo} del minuto ${evento.minuto} sin jugador enlazado. Revísalo antes de guardar.`,
    );
  });

  // Dos líneas idénticas del acta son la misma jugada leída dos veces, no dos jugadas.
  const vistos = new Set<string>();
  return filas.filter((fila) => {
    const clave = [
      fila.tipo,
      fila.lado,
      fila.propia,
      fila.minuto ?? "",
      fila.jugadorId ?? "",
      fila.jugadorSaleId ?? "",
      fila.nombreRival ?? "",
    ].join("|");
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}

/** Marca de un acta cargada desde la base de datos (no leída de un documento). */
export const ACTA_GUARDADA = "__guardada__";

/** Un jugador de la convocatoria guardada, con lo que enseña el formulario del acta. */
export interface JugadorGuardado {
  id: string;
  nombre: string;
  apodo: string | null;
  dorsal: number | null;
  titular: boolean;
}

export interface EventoGuardado extends EventoActa {
  id: string;
}

/**
 * Lo contrario de `participacionesDeActa` y `eventosDeActa`: reconstruye el acta revisable a
 * partir de lo guardado, para poder corregirla (un titular mal puesto, un gol de otro) y
 * volver a guardarla. Pasada otra vez por esas funciones da las mismas filas.
 */
export function actaDeGuardado(
  marcador: { golesLocal: number | null; golesVisitante: number | null; campoId: string | null },
  jugadores: readonly JugadorGuardado[],
  eventos: readonly EventoGuardado[],
): ParsedActa {
  const refs = new Map(
    jugadores.map((j) => [
      j.id,
      {
        id: j.id,
        dorsal: j.dorsal === null ? "" : String(j.dorsal),
        rawName: j.nombre,
        jugadorId: j.id,
        displayName: j.apodo?.trim() || j.nombre,
      },
    ]),
  );
  const ref = (id: string | null) => (id ? refs.get(id) : undefined);
  return {
    ...(marcador.campoId ? { campoId: marcador.campoId } : {}),
    marcadorLocal: String(marcador.golesLocal ?? 0),
    marcadorVisitante: String(marcador.golesVisitante ?? 0),
    campoNombre: "",
    campoPoblacion: "",
    titulares: jugadores.filter((j) => j.titular).map((j) => refs.get(j.id)!),
    suplentes: jugadores.filter((j) => !j.titular).map((j) => refs.get(j.id)!),
    eventos: eventos.map((e): ActaEvent => {
      const base = {
        id: e.id,
        tipo: e.tipo,
        minuto: e.minuto === null ? "" : String(e.minuto),
        isRival: e.lado === "rival",
        confidence: "alta" as const,
        ...(e.nombreRival ? { nombreRival: e.nombreRival } : {}),
      };
      if (e.tipo === "cambio") {
        return { ...base, jugadorEntra: ref(e.jugadorId), jugadorSale: ref(e.jugadorSaleId) };
      }
      if (e.tipo === "gol" && e.propia) {
        return e.lado === "propio"
          ? { ...base, esPropia: true }
          : { ...base, esPropiaSantiso: true, jugador: ref(e.jugadorId) };
      }
      return { ...base, jugador: ref(e.jugadorId) };
    }),
    warnings: [],
    rawText: ACTA_GUARDADA,
  };
}
