import { z } from "zod";

const id = z.string().min(1);
const texto = z.string();
const textoNulo = z.string().nullable();
const enteroNulo = z.number().int().nullable();

export const filaTemporada = z.object({
  id,
  nombre: texto,
  activa: z.boolean().nullable(),
  created_at: textoNulo,
});
export const filaCompeticion = z.object({
  id,
  categoria: texto,
  nombre: texto,
  orden: z.number().int(),
  activa: z.boolean(),
  formato: textoNulo,
  created_at: textoNulo,
});
export const filaEtiqueta = z.object({ competicion_id: id, categoria: texto, etiqueta: texto });
export const filaReglas = z.object({
  id,
  temporada_id: id,
  competicion_id: id,
  reglas: z.unknown(),
});
export const filaEquipo = z.object({
  id,
  nombre: texto,
  escudo_url: textoNulo,
  categoria: textoNulo,
  created_at: texto,
  pts: enteroNulo,
  pj: enteroNulo,
  pg: enteroNulo,
  pe: enteroNulo,
  pp: enteroNulo,
  gf: enteroNulo,
  gc: enteroNulo,
});
export const filaEquipoCompeticion = z.object({ equipo_id: id, competicion_id: id });
export const filaCampo = z.object({
  id,
  nombre: texto,
  poblacion: textoNulo,
  created_at: textoNulo,
});
export const filaJornada = z.object({
  id,
  temporada_id: id,
  competicion_id: id,
  categoria: texto,
  numero: z.number().int(),
  fecha_inicio: textoNulo,
  fecha_fin: textoNulo,
  nombre_fase: textoNulo,
  created_at: textoNulo,
});
export const filaDescanso = z.object({ jornada_id: id, equipo_id: id });
export const filaPartido = z.object({
  id,
  jornada_id: id,
  competicion_id: id,
  categoria: texto,
  equipo_local_id: id,
  equipo_visitante_id: id,
  goles_local: enteroNulo,
  goles_visitante: enteroNulo,
  estado: texto,
  fecha: textoNulo,
  campo_id: textoNulo,
  created_at: textoNulo,
});
export const filaJugador = z.object({
  id,
  nombre: texto,
  apodo: textoNulo,
  dorsal: enteroNulo,
  posicion: textoNulo,
  posiciones_conocidas: z.array(texto).nullable(),
  capitan: enteroNulo,
  foto_url: textoNulo,
  categoria: textoNulo,
  fecha_nacimiento: textoNulo,
  historial_deportivo: z.array(texto).nullable(),
  compromiso: enteroNulo,
  created_at: textoNulo,
});
export const filaEstadistica = z.object({
  jugador_id: id,
  partido_id: id,
  titular: z.boolean().nullable(),
  jugo: z.boolean().nullable(),
  goles: enteroNulo,
});
export const filaEvento = z.object({
  id,
  partido_id: id,
  tipo: texto,
  minuto: enteroNulo,
  jugador_id: textoNulo,
  jugador_relacionado_id: textoNulo,
  es_rival: z.boolean(),
  nombre_mostrado: textoNulo,
  created_at: textoNulo,
});
export const filaStaff = z.object({
  id,
  nombre: texto,
  cargo: texto,
  tipo: texto,
  categoria: textoNulo,
  foto_url: textoNulo,
  created_at: textoNulo,
});
export const filaPatrocinador = z.object({
  id,
  nombre: texto,
  logo_url: textoNulo,
  web_url: textoNulo,
  orden: enteroNulo,
  created_at: textoNulo,
});
export const filaCartelAsset = z.object({
  id,
  nombre: texto,
  tipo: texto,
  subtipo: textoNulo,
  url: texto,
  orden: enteroNulo,
});

/** Tablas de Supabase que se exportan, con el esquema de sus filas. */
export const TABLAS_ORIGEN = {
  temporadas: filaTemporada,
  competiciones: filaCompeticion,
  competicion_etiquetas: filaEtiqueta,
  reglas_liga: filaReglas,
  equipos: filaEquipo,
  equipo_competiciones: filaEquipoCompeticion,
  campos_futbol: filaCampo,
  jornadas: filaJornada,
  jornada_equipo_descanso: filaDescanso,
  partidos_liga: filaPartido,
  jugadores: filaJugador,
  jugador_partido_stats: filaEstadistica,
  partido_eventos_santiso: filaEvento,
  staff_club: filaStaff,
  patrocinadores: filaPatrocinador,
  cartel_assets: filaCartelAsset,
} as const;

export type TablaOrigen = keyof typeof TABLAS_ORIGEN;
// Object.keys pierde el tipo de las claves; la lista sale del mismo objeto.
export const TABLAS = Object.keys(TABLAS_ORIGEN) as TablaOrigen[];
export type Snapshot = { [T in TablaOrigen]: z.infer<(typeof TABLAS_ORIGEN)[T]>[] };

export type FilaTemporada = z.infer<typeof filaTemporada>;
export type FilaCompeticion = z.infer<typeof filaCompeticion>;
export type FilaEtiqueta = z.infer<typeof filaEtiqueta>;
export type FilaReglas = z.infer<typeof filaReglas>;
export type FilaEquipo = z.infer<typeof filaEquipo>;
export type FilaEquipoCompeticion = z.infer<typeof filaEquipoCompeticion>;
export type FilaCampo = z.infer<typeof filaCampo>;
export type FilaJornada = z.infer<typeof filaJornada>;
export type FilaDescanso = z.infer<typeof filaDescanso>;
export type FilaPartido = z.infer<typeof filaPartido>;
export type FilaJugador = z.infer<typeof filaJugador>;
export type FilaEstadistica = z.infer<typeof filaEstadistica>;
export type FilaEvento = z.infer<typeof filaEvento>;
export type FilaStaff = z.infer<typeof filaStaff>;
export type FilaPatrocinador = z.infer<typeof filaPatrocinador>;
export type FilaCartelAsset = z.infer<typeof filaCartelAsset>;

/** Valida cada tabla del volcado; se detiene en la primera con forma inesperada. */
export function validarSnapshot(crudo: Partial<Record<TablaOrigen, unknown>>): Snapshot {
  const salida: Partial<Record<TablaOrigen, unknown>> = {};
  for (const tabla of TABLAS) {
    const resultado = z.array(TABLAS_ORIGEN[tabla]).safeParse(crudo[tabla]);
    if (!resultado.success) {
      throw new Error(`Snapshot inválido en "${tabla}":\n${z.prettifyError(resultado.error)}`);
    }
    salida[tabla] = resultado.data;
  }
  // Cada clave se ha rellenado arriba con los datos ya validados por su esquema.
  return salida as Snapshot;
}

export const manifiestoSchema = z.object({
  creadoEn: z.string(),
  /** Host de Supabase (sin claves). */
  origen: z.string(),
  filas: z.record(z.string(), z.number().int().nonnegative()),
  media: z.record(
    z.string(),
    z.object({ bytes: z.number().int().nonnegative(), sha256: z.string().length(64) }),
  ),
});
export type Manifiesto = z.infer<typeof manifiestoSchema>;
