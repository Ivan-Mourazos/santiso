import { CATEGORIAS } from "@santiso/domain";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { partidos } from "./calendario";
import { checkEnum, marcasTiempo } from "./comunes";
import { competiciones } from "./competicion";
import { jugadores } from "./plantilla";

/** Qué pasó con un acta de la federación al traerla. */
export const ESTADOS_ACTA_RFGF = ["resultado", "guardada", "revisar", "error"] as const;
export type EstadoActaRfgf = (typeof ESTADOS_ACTA_RFGF)[number];

/**
 * Sincronización con la web de la federación (futgal.es). Cada competición guarda el enlace de
 * su calendario y cuándo se miró por última vez.
 */
export const rfgfCompeticiones = sqliteTable("rfgf_competiciones", {
  competicionId: text("competicion_id")
    .primaryKey()
    .references(() => competiciones.id, { onDelete: "cascade" }),
  /** El enlace tal como lo pegó el usuario. */
  enlace: text("enlace").notNull(),
  /** Última comprobación, ISO. */
  comprobadoEn: text("comprobado_en"),
  /** Resumen de esa comprobación, para enseñarlo. Vacío si no hubo novedad. */
  resumen: text("resumen").notNull().default(""),
  /** Última vez que se miraron los horarios de las jornadas por jugar, ISO. */
  horariosEn: text("horarios_en"),
  /** Cómo queda la clasificación del Studio frente a la oficial, la última vez que se comparó. */
  clasificacion: text("clasificacion", { mode: "json" }).$type<{
    jornada: number;
    comparadaEn: string;
    diferencias: string[];
    sanciones: { equipo: string; puntos: number }[];
  }>(),
  ...marcasTiempo(),
});

/**
 * Un acta de la federación ya tratada. Evita volver a descargarla y deja constancia de qué se
 * hizo: solo el resultado (partido ajeno), el acta completa, o por qué hay que revisarla.
 */
export const rfgfActas = sqliteTable(
  "rfgf_actas",
  {
    /** Código del acta en la federación. */
    codActa: text("cod_acta").primaryKey(),
    competicionId: text("competicion_id")
      .notNull()
      .references(() => competiciones.id, { onDelete: "cascade" }),
    partidoId: text("partido_id").references(() => partidos.id, { onDelete: "set null" }),
    estado: text("estado", { enum: ESTADOS_ACTA_RFGF }).notNull(),
    /** Qué se guardó o qué falló, en una frase. */
    detalle: text("detalle").notNull().default(""),
    /** Algo que no salió del todo bien y conviene que alguien vea. Vacío si todo fue bien. */
    aviso: text("aviso").notNull().default(""),
    /** Ya se apuntaron sus goles y tarjetas en `liga_eventos`. */
    eventos: integer("eventos", { mode: "boolean" }).notNull().default(false),
    /**
     * Cuándo se leyeron de su página web los jugadores del club con su código (`rfgf_jugadores`).
     * Solo en partidos del club. `null` si aún no.
     */
    jugadoresEn: text("jugadores_en"),
    /**
     * Cuándo se volvió a leer el acta solo para apuntar sus alineaciones (`liga_alineaciones`),
     * se pudieran leer o no: así no se repite. Las actas leídas después ya las traen.
     */
    alineacionesEn: text("alineaciones_en"),
    ...marcasTiempo(),
  },
  (t) => [
    index("rfgf_actas_competicion_idx").on(t.competicionId),
    index("rfgf_actas_partido_idx").on(t.partidoId),
    checkEnum("rfgf_actas_estado_ck", "estado", ESTADOS_ACTA_RFGF),
  ],
);

/**
 * Lo último que la federación dijo de un partido por jugar (día, hora y campo). Sirve para
 * distinguir un cambio de la federación de uno hecho a mano en el Studio: solo se vuelve a
 * escribir en el partido cuando lo que dice la federación cambia respecto a lo aquí apuntado.
 */
export const rfgfPartidos = sqliteTable("rfgf_partidos", {
  partidoId: text("partido_id")
    .primaryKey()
    .references(() => partidos.id, { onDelete: "cascade" }),
  /** `AAAA-MM-DD` o `AAAA-MM-DDTHH:mm`, como la publicó la federación. */
  fecha: text("fecha").notNull(),
  /** Nombre del campo tal como lo escribe la federación; vacío si está por asignar. */
  campo: text("campo").notNull().default(""),
  /** El último cambio de día, hora o campo sobre lo que ya había, en una frase. */
  cambio: text("cambio").notNull().default(""),
  /** Cuándo se detectó ese cambio, ISO. */
  cambioEn: text("cambio_en"),
  ...marcasTiempo(),
});

/**
 * Un jugador del club tal como lo conoce la federación, en una competición: su código (sale
 * en la página de cada partido) y las cifras oficiales de la temporada. Sirve para contrastar
 * las estadísticas del Studio con las de la federación.
 */
export const rfgfJugadores = sqliteTable(
  "rfgf_jugadores",
  {
    /** Código del jugador en la federación. */
    codigo: text("codigo").notNull(),
    competicionId: text("competicion_id")
      .notNull()
      .references(() => competiciones.id, { onDelete: "cascade" }),
    /** El de la plantilla, si el nombre se reconoció sin duda. */
    jugadorId: text("jugador_id").references(() => jugadores.id, { onDelete: "set null" }),
    /** «APELLIDOS, NOMBRE», como lo escribe la federación. */
    nombre: text("nombre").notNull(),
    /** El último partido en el que se le vio: con él se pide su página. */
    codActa: text("cod_acta").notNull(),
    /** Las cifras oficiales; `null` hasta la primera lectura. */
    cifras: text("cifras", { mode: "json" }).$type<{
      convocados: number;
      titular: number;
      suplente: number;
      jugados: number;
      amarillas: number;
      doblesAmarillas: number;
      rojas: number;
      goles: number | null;
    }>(),
    /** Cuándo se leyeron esas cifras, ISO. */
    leidoEn: text("leido_en"),
    ...marcasTiempo(),
  },
  (t) => [
    primaryKey({ columns: [t.codigo, t.competicionId] }),
    index("rfgf_jugadores_jugador_idx").on(t.jugadorId),
  ],
);

/** En qué punto está un grupo de una temporada pasada. */
export const ESTADOS_GRUPO_HISTORICO = ["pendiente", "listo", "sin_acta"] as const;
export const ESTADOS_ARCHIVO_HISTORICO = [
  "no_pedido",
  "en_cola",
  "en_curso",
  "terminado",
  "no_compatible",
] as const;

/**
 * Un grupo en el que jugó un equipo del club en una temporada pasada, sacado de la página
 * «competiciones del equipo» de la federación. Para pedir las cifras de un jugador en ese
 * grupo hace falta el código de un partido suyo: se busca una vez y se guarda aquí.
 */
export const rfgfGruposHistoricos = sqliteTable(
  "rfgf_grupos_historicos",
  {
    codGrupo: text("cod_grupo").primaryKey(),
    categoria: text("categoria").notNull(),
    /** «2025-2026». */
    temporada: text("temporada").notNull(),
    competicion: text("competicion").notNull(),
    grupo: text("grupo").notNull(),
    codCompeticion: text("cod_competicion").notNull(),
    /** Código del equipo del club en la federación. */
    codEquipo: text("cod_equipo").notNull(),
    /** Un partido de ese grupo con el club; `null` hasta encontrarlo. */
    codActa: text("cod_acta"),
    estado: text("estado", { enum: ESTADOS_GRUPO_HISTORICO }).notNull().default("pendiente"),
    /** Jornadas ya miradas buscando ese partido. */
    intentos: integer("intentos").notNull().default(0),
    /** Solicitud explícita; sin ella no se descargan partidos de este grupo. */
    partidosPedidosEn: text("partidos_pedidos_en"),
    partidosEstado: text("partidos_estado", { enum: ESTADOS_ARCHIVO_HISTORICO })
      .notNull()
      .default("no_pedido"),
    partidosAviso: text("partidos_aviso").notNull().default(""),
    /** Calendario ya leído; el resto del avance vive en cada partido. */
    partidosCalendarioEn: text("partidos_calendario_en"),
    partidosIntentos: integer("partidos_intentos").notNull().default(0),
    partidosActualizadoEn: text("partidos_actualizado_en"),
    ...marcasTiempo(),
  },
  () => [
    checkEnum("rfgf_grupos_historicos_estado_ck", "estado", ESTADOS_GRUPO_HISTORICO),
    checkEnum(
      "rfgf_grupos_historicos_partidos_estado_ck",
      "partidos_estado",
      ESTADOS_ARCHIVO_HISTORICO,
    ),
  ],
);

/** Las cifras oficiales de un jugador del club en un grupo de una temporada pasada. */
export const rfgfHistorico = sqliteTable(
  "rfgf_historico",
  {
    jugadorId: text("jugador_id")
      .notNull()
      .references(() => jugadores.id, { onDelete: "cascade" }),
    codGrupo: text("cod_grupo")
      .notNull()
      .references(() => rfgfGruposHistoricos.codGrupo, { onDelete: "cascade" }),
    /** Código del jugador en la federación. */
    codigo: text("codigo").notNull(),
    /** `null` hasta leer su página. */
    cifras: text("cifras", { mode: "json" }).$type<{
      convocados: number;
      titular: number;
      suplente: number;
      jugados: number;
      amarillas: number;
      doblesAmarillas: number;
      rojas: number;
      goles: number | null;
    }>(),
    leidoEn: text("leido_en"),
    ...marcasTiempo(),
  },
  (t) => [primaryKey({ columns: [t.jugadorId, t.codGrupo] })],
);

/**
 * El código de cada equipo del club en la federación, por categoría, y cuándo se apuntaron
 * todas sus temporadas pasadas. La página de competiciones del equipo las trae todas de una vez
 * (desde 2014-2015 en el Senior): con este apunte no se vuelve a pedir.
 */
export const rfgfEquiposClub = sqliteTable(
  "rfgf_equipos_club",
  {
    categoria: text("categoria", { enum: CATEGORIAS }).primaryKey(),
    /** Vacío si no se encontró al equipo en la jornada 1 de su competición. */
    codEquipo: text("cod_equipo").notNull(),
    /** Cuándo se apuntaron todas sus temporadas, ISO. */
    temporadasEn: text("temporadas_en").notNull(),
    ...marcasTiempo(),
  },
  () => [checkEnum("rfgf_equipos_club_categoria_ck", "categoria", CATEGORIAS)],
);
