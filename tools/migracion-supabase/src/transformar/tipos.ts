import type * as s from "@santiso/db/schema";
import type { Categoria } from "@santiso/domain";
import type { InferInsertModel } from "drizzle-orm";

/** Las filas migradas siempre llevan id explícito (conservado o determinista). */
type ConId<T> = T & { id: string };

export type TemporadaNueva = ConId<InferInsertModel<typeof s.temporadas>>;
export type CompeticionNueva = ConId<InferInsertModel<typeof s.competiciones>>;
export type CompeticionAliasNuevo = InferInsertModel<typeof s.competicionAlias>;
export type EquipoNuevo = ConId<InferInsertModel<typeof s.equipos>>;
export type CompeticionEquipoNuevo = InferInsertModel<typeof s.competicionEquipos>;
export type JugadorNuevo = ConId<InferInsertModel<typeof s.jugadores>>;
export type JugadorTemporadaNuevo = ConId<InferInsertModel<typeof s.jugadoresTemporada>>;
export type StaffNuevo = ConId<InferInsertModel<typeof s.staff>>;
export type StaffTemporadaNuevo = ConId<InferInsertModel<typeof s.staffTemporada>>;

/**
 * Supabase no tenía temporadas en la plantilla: cada fila traía categoría, dorsal y foto
 * sueltos. Así sale el transformador; `repartirPorTemporada` lo separa en persona e inscripción.
 */
export type JugadorLegado = JugadorNuevo &
  Omit<JugadorTemporadaNuevo, "id" | "temporadaId" | "jugadorId" | "creadoEn" | "actualizadoEn">;
export type StaffLegado = StaffNuevo &
  Omit<StaffTemporadaNuevo, "id" | "temporadaId" | "staffId" | "creadoEn" | "actualizadoEn">;
export type CampoNuevo = ConId<InferInsertModel<typeof s.campos>>;
export type JornadaNueva = ConId<InferInsertModel<typeof s.jornadas>>;
export type JornadaDescansoNuevo = InferInsertModel<typeof s.jornadaDescansos>;
export type PartidoNuevo = ConId<InferInsertModel<typeof s.partidos>>;
export type ParticipacionNueva = InferInsertModel<typeof s.partidoParticipaciones>;
export type EventoNuevo = ConId<InferInsertModel<typeof s.partidoEventos>>;
export type PatrocinadorNuevo = ConId<InferInsertModel<typeof s.patrocinadores>>;
export type AjusteNuevo = InferInsertModel<typeof s.ajustes>;

/** Datos listos para insertar, con una propiedad por tabla del esquema nuevo. */
export interface ModeloNuevo {
  temporadas: TemporadaNueva[];
  competiciones: CompeticionNueva[];
  competicionAlias: CompeticionAliasNuevo[];
  equipos: EquipoNuevo[];
  competicionEquipos: CompeticionEquipoNuevo[];
  jugadores: JugadorNuevo[];
  jugadoresTemporada: JugadorTemporadaNuevo[];
  staff: StaffNuevo[];
  staffTemporada: StaffTemporadaNuevo[];
  campos: CampoNuevo[];
  jornadas: JornadaNueva[];
  jornadaDescansos: JornadaDescansoNuevo[];
  partidos: PartidoNuevo[];
  partidoParticipaciones: ParticipacionNueva[];
  partidoEventos: EventoNuevo[];
  patrocinadores: PatrocinadorNuevo[];
  ajustes: AjusteNuevo[];
}

export interface ClasificacionManualAntigua {
  equipoId: string;
  nombre: string;
  categoria: string;
  pts: number;
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  gf: number;
  gc: number;
}

/** Correcciones aplicadas automáticamente y datos de referencia. Se vuelca al informe de migración. */
export interface Informe {
  avisos: string[];
  equiposFusionados: {
    conservado: string;
    eliminados: string[];
    nombre: string;
    categoria: Categoria;
  }[];
  equiposSeparados: {
    origen: string;
    nuevo: string;
    nombre: string;
    categoria: Categoria;
    competicion: string;
  }[];
  /** Participaciones sin fila de origen: se dedujeron de un evento de acta (gol, cambio...). */
  participacionesCreadas: { partidoId: string; jugadorId: string }[];
  clasificacionManualAntigua: ClasificacionManualAntigua[];
}

export const crearInforme = (): Informe => ({
  avisos: [],
  equiposFusionados: [],
  equiposSeparados: [],
  participacionesCreadas: [],
  clasificacionManualAntigua: [],
});

/** Dato de origen que exige una decisión humana: la migración se detiene. */
export class ErrorMigracion extends Error {
  override name = "ErrorMigracion";
}
