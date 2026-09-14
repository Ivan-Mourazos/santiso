export type ActaCategoria = "Senior" | "Femenino" | "Veteranos";

export type ActaEventType =
  | "gol"
  | "tarjeta_amarilla"
  | "tarjeta_roja"
  | "cambio";

export interface ActaPlayerRef {
  id: string;
  dorsal: string;
  rawName: string;
  jugadorId?: string;
  displayName?: string;
}

export interface ActaEvent {
  id: string;
  tipo: ActaEventType;
  minuto: string;
  isRival: boolean;
  esPropia?: boolean; // gol en propia del rival (cuenta para Santiso, sin jugador propio)
  esPropiaSantiso?: boolean; // gol en propia del Santiso (cuenta para rival, jugador Santiso guardado)
  jugador?: ActaPlayerRef;
  jugadorSale?: ActaPlayerRef;
  jugadorEntra?: ActaPlayerRef;
  nombreRival?: string; // rival player name; also: rival scorer of own goal when esPropia=true
  scoreAfter?: string;
  confidence: "alta" | "media" | "baja";
}

export interface ParsedActa {
  campoId?: string;
  marcadorLocal: string;
  marcadorVisitante: string;
  campoNombre: string;
  campoPoblacion: string;
  titulares: ActaPlayerRef[];
  suplentes: ActaPlayerRef[];
  eventos: ActaEvent[];
  warnings: string[];
  rawText: string;
}

export interface ActaPlayerDb {
  id: string;
  dorsal: number | null;
  nombre: string;
  apodo: string | null;
  categoria: string;
}

export interface ActaCampoDb {
  id: string;
  nombre: string;
  poblacion: string | null;
}

export interface ActaMatchDb {
  id: string;
  categoria: string;
  competicion?: string | null;
  competicion_id?: string | null;
  equipo_local_id: string | null;
  equipo_visitante_id: string | null;
  goles_local: number | null;
  goles_visitante: number | null;
  estado: string | null;
  campo_id?: string | null;
  equipo_local?: { nombre?: string | null } | null;
  equipo_visitante?: { nombre?: string | null } | null;
  jornada?: {
    numero?: number | string | null;
    competicion?: string | null;
    competicion_id?: string | null;
    temporada_id?: string | null;
  } | null;
  campo?: { nombre?: string | null; poblacion?: string | null } | null;
}
