/** Tipos de la libreta en directo, compartidos por servidor y pantalla. */
import type { LadoEvento, TipoEvento } from "@santiso/domain";
import type { RelojDirecto } from "./reloj";

export interface EventoDirecto {
  /** Lo genera el móvil: reenviar tras un corte no duplica. */
  id: string;
  tipo: TipoEvento;
  lado: LadoEvento;
  propia: boolean;
  parte: 1 | 2;
  minuto: number | null;
  /** Jugador propio: autor, amonestado o el que entra. */
  jugadorId: string | null;
  /** Cambios: el que sale. */
  jugadorSaleId: string | null;
  dorsal: number | null;
  dorsalSale: number | null;
  nota: string;
}

export type OperacionDirecto =
  | { op: "guardar"; evento: EventoDirecto }
  | { op: "borrar"; id: string }
  | { op: "reloj"; reloj: RelojDirecto };

export interface JugadorDirecto {
  id: string;
  nombre: string;
  dorsal: number | null;
}

export interface PantallaDirecto {
  partido: {
    id: string;
    categoria: string;
    local: string;
    visitante: string;
    somosLocal: boolean;
  };
  reloj: RelojDirecto;
  eventos: EventoDirecto[];
  jugadores: JugadorDirecto[];
}
