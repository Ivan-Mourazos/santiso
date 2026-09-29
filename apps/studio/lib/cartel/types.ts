/**
 * lib/cartel/types.ts
 * Datos del formulario del generador de carteles (eventos, jugadores, partidos y clasificación).
 * El dibujo está en el motor nuevo: `lib/cartel2` y `components/cartel2`.
 */

export interface CronEvent {
  id:      string;
  minuto:  string;
  tipo:    "gol" | "amarela" | "vermella" | "penalti" | "doble_amarela" | "propia" | "cambio";
  equipo:  "local" | "rival";
  jugador: string;
  jugadorEntra?: string;
}

export interface Player {
  id:       string;
  dorsal:   string;
  nome:     string;
  eCapitan: boolean;
}

export interface NextMatch {
  rival: string;
  /** Rival shield URL for poster preload (optional in DB-derived rows). */
  rivalEscudoUrl: string;
  fecha: string;
  categoria: string;
  hora: string;
  lugar?: string;
  santisoSide: "left" | "right";
}

/** Una fila de la tabla, venga de la base de datos o escrita a mano. */
export interface FilaCartelClasificacion {
  id?: string;
  equipo_id?: string;
  posicion?: number;
  nombre: string;
  escudo_url?: string | null;
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  gf: number;
  gc: number;
  pts: number;
}

/** Una ronda del cuadro de copa, con los datos que pinta la plantilla de cada partido. */
export interface RondaCartel {
  id: string;
  numero: number;
  nombre: string;
  partidos: {
    equipo_local?: { nombre?: string | null } | null;
    equipo_visitante?: { nombre?: string | null } | null;
    goles_local?: number | null;
    goles_visitante?: number | null;
    estado?: string | null;
  }[];
}

/** Liga: filas de la tabla. Copa: rondas del cuadro. */
export type DatosClasificacion = FilaCartelClasificacion[] | RondaCartel[];
