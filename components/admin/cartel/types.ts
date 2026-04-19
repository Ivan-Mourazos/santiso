/**
 * components/admin/cartel/types.ts
 * UI-specific types for the poster generator.
 */

import type { CronEvent, Player, NextMatch } from "@/lib/cartel-draw";

export const TEMPLATES = [
  { id: "partido",    label: "Cartel de Partido",  emoji: "⚽" },
  { id: "resumo",     label: "Resumo da Xornada",  emoji: "📊" },
  { id: "cronoloxia", label: "Cronoloxía",          emoji: "📋" },
  { id: "proximos",   label: "Próximos Encontros",  emoji: "📅" },
  { id: "noso11",     label: "O Noso 11",           emoji: "👕" },
] as const;

export type TemplateId = typeof TEMPLATES[number]["id"];

export interface FormState {
  // Shared
  categoria:      string;
  textoLateral:   string;
  xuntaIsLeft:    boolean;
  // Partido / Resumo / Cronoloxia
  competicion:    string;
  jornada:        string;
  rivalNombre:    string;
  rivalEscudoUrl: string;
  fecha:          string;
  hora:           string;
  lugar:          string;
  santisoSide:    "left" | "right";
  // Resumo / Cronoloxia
  golesLocal:     string;
  golesRival:     string;
  // Cronoloxia extra
  estadio:        string;
  localSponsor:   string;
  rivalSponsor:   string;
  events:         CronEvent[];
  // Próximos
  categoriasText: string;
  matches:        NextMatch[];
  // O Noso 11
  jugadorFotoUrl: string;
  titulares:      Player[];
  suplentes:      Player[];
}

export interface AssetUrls {
  fondo:    string;
  xunta:    string;
  rfgf:     string;
  santiso:  string;
  sponsors: string[];
}
