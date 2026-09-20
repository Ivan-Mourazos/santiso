/**
 * Formas que esperan los componentes heredados, con los nombres de campo que devolvía Supabase.
 * @deprecated Temporal de la Fase 2B. Las Fases 4–6 reescriben las pantallas contra los tipos
 * de `@santiso/db` y estos DTO desaparecen.
 */
export interface TemporadaDto {
  id: string;
  nombre: string;
  activa: boolean;
  created_at: string;
}

/** @deprecated Ver TemporadaDto. `activa` siempre es `true`: el catálogo ya solo trae vigentes. */
export interface CompeticionDto {
  id: string;
  categoria: string;
  nombre: string;
  orden: number;
  activa: boolean;
  formato: string;
}

/** @deprecated Ver TemporadaDto. */
export interface CampoDto {
  id: string;
  nombre: string;
  poblacion: string | null;
}

/** @deprecated Ver TemporadaDto. `escudo_url` es ahora una ruta local `/media/<clave>`. */
export interface EquipoDto {
  id: string;
  nombre: string;
  categoria: string;
  escudo_url: string | null;
  es_propio: boolean;
}
