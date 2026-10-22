/**
 * components/admin/cartel/types.ts
 * UI-specific types for the poster generator.
 */

import type { CronEvent, DatosClasificacion, NextMatch, Player } from "@/lib/cartel/types";

export const TEMPLATES = [
  { id: "partido", label: "Cartel de partido", emoji: "⚽" },
  { id: "resumo", label: "Resultado", emoji: "📊" },
  { id: "cronoloxia", label: "Cronoloxía", emoji: "📋" },
  { id: "proximos", label: "Próximos partidos", emoji: "📅" },
  { id: "noso11", label: "O Noso 11", emoji: "👕" },
  { id: "multiusos", label: "Anuncio", emoji: "📢" },
  { id: "clasificacion", label: "Clasificación", emoji: "📈" },
  { id: "fichaxe", label: "Fichaje", emoji: "✍️" },
  { id: "comunicado", label: "Comunicado", emoji: "📢" },
  { id: "loteria", label: "Lotaría", emoji: "🍀" },
] as const;

export type TemplateId = (typeof TEMPLATES)[number]["id"];

export type MultiusosTema = "celebracion" | "medico" | "fichaje" | "despedida" | "formal";
export const TEMAS_MULTIUSOS: readonly string[] = [
  "celebracion",
  "medico",
  "fichaje",
  "despedida",
  "formal",
] satisfies readonly MultiusosTema[];

export interface FormState {
  // Shared
  categoria: string;
  jugadorXOffset: number;
  jugadorYOffset: number;
  jugadorZoom: number;
  showCarouselIndicator: boolean;
  // Partido / Resumo / Cronoloxia
  /** Partido cargado desde la liga (vacío si se rellenó a mano): su galería de fotos. */
  partido_id: string;
  competicion_id: string;
  /** Nombre visible (sincronizado con catálogo o partido cargado). */
  competicion: string;
  jornada: string;
  rivalNombre: string;
  rivalEscudoUrl: string;
  fecha: string;
  hora: string;
  lugar: string;
  localidad?: string;
  santisoSide: "left" | "right";
  // Resumo / Cronoloxia
  golesLocal: string;
  golesRival: string;
  // Cronoloxia extra
  estadio: string;
  localSponsor: string;
  rivalSponsor: string;
  events: CronEvent[];
  // Próximos
  categoriasText: string;
  matches: NextMatch[];
  // O Noso 11
  jugadorFotoUrl: string;
  noso11Flip: boolean;
  noso11FotoModo?: "retrato" | "fondo";
  titulares: Player[];
  suplentes: Player[];
  // Multiusos
  multiusosTema: MultiusosTema;
  multiusosTitulo: string;
  multiusosTexto: string;
  multiusosImg1Url: string;
  multiusosImg2Url: string;

  // Fichaje, renovación o vuelta (la foto es la de O Noso 11: `jugadorFotoUrl` y encuadre)
  fichaxeTipo: "fichaxe" | "renovacion" | "volta";
  fichaxeNombre: string;
  fichaxeApellido: string;
  fichaxeDetalle: string;
  fichaxeFrase: string;
  fichaxeConEscudo: boolean;
  // Comunicado oficial, parte médico o loito
  comunicadoTipo: "oficial" | "medico" | "loito";
  comunicadoTitulo: string;
  comunicadoTexto: string;
  comunicadoFecha: string;
  comunicadoFirma: string;
  // Lotaría do club
  loteriaSorteo: "nadal" | "neno";
  loteriaAnio: number;
  /** Uno o dos números de cinco cifras, separados por coma o espacio. */
  loteriaNumeros: string;
  loteriaTitulo: string;
  loteriaPrezo: string;
  loteriaXoga: string;
  loteriaPuntos: string;
  /** Foto o escaneo del décimo de verdad: si la hay, va en vez del dibujado. */
  loteriaDecimoFoto: string;
  /** Sorteo do Baúl: no todos los años lo hay. */
  loteriaBaul: boolean;
  loteriaBaulFoto: string;
  loteriaBaulTexto: string;

  // Clasificación
  clasificacionTipo: "liga" | "copa";
  clasificacionNombre: string;
  clasificacionData: DatosClasificacion;

  showAssets: boolean;
}

/** Campos del formulario con una foto de la lotaría subida a mano. */
export type FotoLoteria = "loteriaDecimoFoto" | "loteriaBaulFoto";

export interface AssetUrls {
  xunta: string;
  rfgf: string;
  xuntaIsLeft: boolean;
  sponsors: string[];
}
