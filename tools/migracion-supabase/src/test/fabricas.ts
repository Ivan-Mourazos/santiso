import { sha256 } from "../hash";
import {
  type FilaCampo,
  type FilaCartelAsset,
  type FilaCompeticion,
  type FilaDescanso,
  type FilaEquipo,
  type FilaEquipoCompeticion,
  type FilaEstadistica,
  type FilaEtiqueta,
  type FilaEvento,
  type FilaJornada,
  type FilaJugador,
  type FilaPartido,
  type FilaPatrocinador,
  type FilaReglas,
  type FilaStaff,
  type FilaTemporada,
  type Manifiesto,
  type Snapshot,
  TABLAS,
} from "../snapshot/tipos";

let secuencia = 0;
const nuevoId = (prefijo: string) => `${prefijo}-${++secuencia}`;
const CREADO = "2026-01-01T10:00:00+00:00";

export const snapshotVacio = (): Snapshot => ({
  temporadas: [],
  competiciones: [],
  competicion_etiquetas: [],
  reglas_liga: [],
  equipos: [],
  equipo_competiciones: [],
  campos_futbol: [],
  jornadas: [],
  jornada_equipo_descanso: [],
  partidos_liga: [],
  jugadores: [],
  jugador_partido_stats: [],
  partido_eventos_santiso: [],
  staff_club: [],
  patrocinadores: [],
  cartel_assets: [],
});

/** Filas de origen con valores por defecto válidos; se sobrescriben con `parcial`. */
export const fabricar = {
  temporada: (parcial: Partial<FilaTemporada> = {}): FilaTemporada => ({
    id: nuevoId("temporada"),
    nombre: "2026/27",
    activa: true,
    created_at: CREADO,
    ...parcial,
  }),
  competicion: (parcial: Partial<FilaCompeticion> = {}): FilaCompeticion => ({
    id: nuevoId("competicion"),
    categoria: "Senior",
    nombre: "Liga",
    orden: 0,
    activa: true,
    formato: "liga",
    created_at: CREADO,
    ...parcial,
  }),
  etiqueta: (parcial: Partial<FilaEtiqueta> = {}): FilaEtiqueta => ({
    competicion_id: "",
    categoria: "Senior",
    etiqueta: "Liga",
    ...parcial,
  }),
  reglas: (parcial: Partial<FilaReglas> = {}): FilaReglas => ({
    id: nuevoId("reglas"),
    temporada_id: "",
    competicion_id: "",
    reglas: [],
    ...parcial,
  }),
  equipo: (parcial: Partial<FilaEquipo> = {}): FilaEquipo => ({
    id: nuevoId("equipo"),
    nombre: "Equipo",
    escudo_url: null,
    categoria: "Senior",
    created_at: CREADO,
    pts: 0,
    pj: 0,
    pg: 0,
    pe: 0,
    pp: 0,
    gf: 0,
    gc: 0,
    ...parcial,
  }),
  equipoCompeticion: (parcial: Partial<FilaEquipoCompeticion> = {}): FilaEquipoCompeticion => ({
    equipo_id: "",
    competicion_id: "",
    ...parcial,
  }),
  campo: (parcial: Partial<FilaCampo> = {}): FilaCampo => ({
    id: nuevoId("campo"),
    nombre: "Campo",
    poblacion: null,
    created_at: CREADO,
    ...parcial,
  }),
  jornada: (parcial: Partial<FilaJornada> = {}): FilaJornada => ({
    id: nuevoId("jornada"),
    temporada_id: "",
    competicion_id: "",
    categoria: "Senior",
    numero: 1,
    fecha_inicio: null,
    fecha_fin: null,
    nombre_fase: null,
    created_at: CREADO,
    ...parcial,
  }),
  descanso: (parcial: Partial<FilaDescanso> = {}): FilaDescanso => ({
    jornada_id: "",
    equipo_id: "",
    ...parcial,
  }),
  partido: (parcial: Partial<FilaPartido> = {}): FilaPartido => ({
    id: nuevoId("partido"),
    jornada_id: "",
    competicion_id: "",
    categoria: "Senior",
    equipo_local_id: "",
    equipo_visitante_id: "",
    goles_local: null,
    goles_visitante: null,
    estado: "programado",
    fecha: null,
    campo_id: null,
    created_at: CREADO,
    ...parcial,
  }),
  jugador: (parcial: Partial<FilaJugador> = {}): FilaJugador => ({
    id: nuevoId("jugador"),
    nombre: "Jugador",
    apodo: null,
    dorsal: null,
    posicion: null,
    posiciones_conocidas: null,
    capitan: 0,
    foto_url: null,
    categoria: "Senior",
    fecha_nacimiento: null,
    historial_deportivo: null,
    compromiso: null,
    created_at: CREADO,
    ...parcial,
  }),
  estadistica: (parcial: Partial<FilaEstadistica> = {}): FilaEstadistica => ({
    jugador_id: "",
    partido_id: "",
    titular: false,
    jugo: false,
    goles: 0,
    ...parcial,
  }),
  evento: (parcial: Partial<FilaEvento> = {}): FilaEvento => ({
    id: nuevoId("evento"),
    partido_id: "",
    tipo: "gol",
    minuto: null,
    jugador_id: null,
    jugador_relacionado_id: null,
    es_rival: false,
    nombre_mostrado: null,
    created_at: CREADO,
    ...parcial,
  }),
  staff: (parcial: Partial<FilaStaff> = {}): FilaStaff => ({
    id: nuevoId("staff"),
    nombre: "Miembro",
    cargo: "Entrenador",
    tipo: "Tecnico",
    categoria: "Senior",
    foto_url: null,
    created_at: CREADO,
    ...parcial,
  }),
  patrocinador: (parcial: Partial<FilaPatrocinador> = {}): FilaPatrocinador => ({
    id: nuevoId("patrocinador"),
    nombre: "Patrocinador",
    logo_url: null,
    web_url: null,
    orden: 0,
    created_at: CREADO,
    ...parcial,
  }),
  asset: (parcial: Partial<FilaCartelAsset> = {}): FilaCartelAsset => ({
    id: nuevoId("asset"),
    nombre: "Asset",
    tipo: "logo_patrocinador",
    subtipo: null,
    url: "",
    orden: 0,
    ...parcial,
  }),
};

/**
 * Snapshot mínimo coherente: 1 temporada activa, 1 competición Senior, Santiso y un rival,
 * 1 campo, 1 jornada, 1 partido finalizado 2-1, 1 jugador titular con 1 gol y 1 técnico.
 */
export function snapshotMinimo() {
  const snapshot = snapshotVacio();
  const temporada = fabricar.temporada();
  const competicion = fabricar.competicion({ nombre: "Tercera Futgal - Gr. 3" });
  const santiso = fabricar.equipo({ nombre: "U.D. Santiso F.C." });
  const rival = fabricar.equipo({ nombre: "C.D. San Mamed" });
  const campo = fabricar.campo({ nombre: "Municipal de Santiso", poblacion: "Santiso" });
  const jornada = fabricar.jornada({ temporada_id: temporada.id, competicion_id: competicion.id });
  const partido = fabricar.partido({
    jornada_id: jornada.id,
    competicion_id: competicion.id,
    equipo_local_id: santiso.id,
    equipo_visitante_id: rival.id,
    goles_local: 2,
    goles_visitante: 1,
    estado: "finalizado",
    fecha: "2026-09-27T17:00:00+00:00",
    campo_id: campo.id,
  });
  const jugador = fabricar.jugador({ nombre: "Iván Pérez", dorsal: 9 });

  snapshot.temporadas.push(temporada);
  snapshot.competiciones.push(competicion);
  snapshot.equipos.push(santiso, rival);
  snapshot.equipo_competiciones.push(
    fabricar.equipoCompeticion({ equipo_id: santiso.id, competicion_id: competicion.id }),
    fabricar.equipoCompeticion({ equipo_id: rival.id, competicion_id: competicion.id }),
  );
  snapshot.campos_futbol.push(campo);
  snapshot.jornadas.push(jornada);
  snapshot.partidos_liga.push(partido);
  snapshot.jugadores.push(jugador);
  snapshot.jugador_partido_stats.push(
    fabricar.estadistica({
      partido_id: partido.id,
      jugador_id: jugador.id,
      titular: true,
      jugo: true,
      goles: 1,
    }),
  );
  snapshot.partido_eventos_santiso.push(
    fabricar.evento({ partido_id: partido.id, tipo: "gol", minuto: 30, jugador_id: jugador.id }),
  );
  snapshot.staff_club.push(fabricar.staff({ nombre: "Entrenador Senior" }));

  return {
    snapshot,
    ids: {
      temporada: temporada.id,
      competicion: competicion.id,
      santiso: santiso.id,
      rival: rival.id,
      campo: campo.id,
      jornada: jornada.id,
      partido: partido.id,
      jugador: jugador.id,
    },
  };
}

export function manifiestoPara(
  snapshot: Snapshot,
  media: Record<string, Uint8Array> = {},
): Manifiesto {
  return {
    creadoEn: "2026-09-13T20:00:00.000Z",
    origen: "prueba.supabase.co",
    filas: Object.fromEntries(TABLAS.map((tabla) => [tabla, snapshot[tabla].length])),
    media: Object.fromEntries(
      Object.entries(media).map(([clave, bytes]) => [
        clave,
        { bytes: bytes.length, sha256: sha256(bytes) },
      ]),
    ),
  };
}
