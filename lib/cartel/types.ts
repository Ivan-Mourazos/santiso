/**
 * lib/cartel/types.ts
 * Shared TypeScript interfaces for the poster generator.
 */

export interface CartelAssets {
  fondo:    HTMLImageElement | null;
  xunta:    HTMLImageElement | null;
  rfgf:     HTMLImageElement | null;
  santiso:  HTMLImageElement | null;
  sponsors: HTMLImageElement[];
}

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
  rival:     string;
  fecha:     string;
  categoria: string;
  hora:      string;
}
