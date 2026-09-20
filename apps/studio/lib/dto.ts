import type { LineaClasificacion, ReglaClasificacion } from "@santiso/domain";

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

/** Fila de la clasificación calculada, ya con los datos de presentación del equipo. */
export interface FilaClasificacion extends LineaClasificacion {
  nombre: string;
  escudoUrl: string | null;
}

/** Todo lo que necesita la pantalla de clasificación en una sola respuesta. */
export interface PantallaClasificacion {
  filas: FilaClasificacion[];
  reglas: ReglaClasificacion[];
}

/** @deprecated Ver TemporadaDto. `foto_url` es ahora una ruta local `/media/<clave>`. */
export interface JugadorDto {
  id: string;
  nombre: string;
  apodo: string | null;
  dorsal: number | null;
  posicion: string | null;
  foto_url: string | null;
  categoria: string;
  fecha_nacimiento: string | null;
  historial_deportivo: string[];
}
