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

/** @deprecated Ver TemporadaDto. `tipo` se devuelve ya en el catálogo nuevo (`tecnico`/`directiva`). */
export interface StaffDto {
  id: string;
  nombre: string;
  cargo: string;
  tipo: string;
  categoria: string | null;
  foto_url: string | null;
  orden: number;
}

/** @deprecated Ver TemporadaDto. `logo_url` es ahora una ruta local `/media/<clave>`. */
export interface PatrocinadorDto {
  id: string;
  nombre: string;
  logo_url: string | null;
  web_url: string | null;
  orden: number;
  en_carteles: boolean;
}

/** Todo lo que pinta la pantalla de ajustes del generador de carteles, en una sola respuesta. */
export interface AjustesCartelDto {
  escudoClub: string | null;
  logoXunta: string | null;
  logoRfgf: string | null;
  ordenLogos: string;
  patrocinadores: PatrocinadorDto[];
}

/** @deprecated Ver TemporadaDto. Sin `temporada_id` ni `categoria`: los da la competición. */
export interface JornadaDto {
  id: string;
  numero: number;
  nombre_fase: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  competicion_id: string;
}

/** @deprecated Ver TemporadaDto. Sin `categoria` ni `competicion_id`: los da la jornada. */
export interface PartidoDto {
  id: string;
  jornada_id: string;
  equipo_local_id: string;
  equipo_visitante_id: string;
  goles_local: number | null;
  goles_visitante: number | null;
  estado: string;
  fecha: string | null;
  campo_id: string | null;
}

/** El descanso ya no tiene id propio: lo identifica el par (jornada, equipo). */
export interface DescansoDto {
  jornada_id: string;
  equipo_id: string;
}

/** Todo lo que necesita la pantalla de calendario en una sola respuesta. */
export interface PantallaCalendario {
  jornadas: JornadaDto[];
  partidos: PartidoDto[];
  descansos: DescansoDto[];
  equipos: EquipoDto[];
  campos: CampoDto[];
}

/** @deprecated Ver TemporadaDto. Forma que esperan los importadores de actas. */
export interface PartidoActaDto {
  id: string;
  categoria: string;
  competicion_id: string | null;
  competicion: string | null;
  equipo_local_id: string | null;
  equipo_visitante_id: string | null;
  goles_local: number | null;
  goles_visitante: number | null;
  estado: string | null;
  fecha: string | null;
  campo_id: string | null;
  equipo_local: { nombre: string | null } | null;
  equipo_visitante: { nombre: string | null } | null;
  jornada: { numero: number | null; competicion_id: string | null } | null;
  campo: { nombre: string | null; poblacion: string | null } | null;
}
