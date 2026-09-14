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
  { id: "multiusos",  label: "Multiusos / Anuncio", emoji: "📢" },
  { id: "clasificacion", label: "Clasificación / Copa", emoji: "📈" },
] as const;

export type TemplateId = typeof TEMPLATES[number]["id"];

export type MultiusosTema = "celebracion" | "medico" | "fichaje" | "despedida" | "formal";

export interface FormState {
  // Shared
  categoria:      string;
  jugadorXOffset: number;
  jugadorYOffset: number;
  jugadorZoom:    number;
  showCarouselIndicator: boolean;
  // Partido / Resumo / Cronoloxia
  competicion_id: string;
  /** Nombre visible (sincronizado con catálogo o partido cargado). */
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
  noso11Flip:     boolean;
  titulares:      Player[];
  suplentes:      Player[];
  // Multiusos
  multiusosTema:  MultiusosTema;
  multiusosTitulo: string;
  multiusosTexto: string;
  multiusosImg1Url: string;
  multiusosImg2Url: string;

  // Clasificación
  clasificacionTipo: "liga" | "copa";
  clasificacionNombre: string;
  clasificacionData: any;

  showAssets: boolean;
}

export interface AssetUrls {
  xunta:    string;
  rfgf:     string;
  xuntaIsLeft: boolean;
  santiso:  string;
  sponsors: string[];
}
