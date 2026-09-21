import { CATEGORIAS, POSICIONES, TIPOS_STAFF } from "@santiso/domain";
import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { temporadas } from "./competicion";
import { checkEnum, condicion, id, marcasTiempo } from "./comunes";

export const equipos = sqliteTable(
  "equipos",
  {
    id: id(),
    nombre: text("nombre").notNull(),
    /** `claveNombre(nombre)`: unicidad y búsqueda sin mayúsculas, tildes ni puntuación. */
    clave: text("clave").notNull(),
    categoria: text("categoria", { enum: CATEGORIAS }).notNull(),
    /** Equipo del club (UD Santiso en cualquier categoría). */
    esPropio: integer("es_propio", { mode: "boolean" }).notNull().default(false),
    /** Clave de media relativa a `data/media`. */
    escudo: text("escudo"),
    ...marcasTiempo(),
  },
  (t) => [
    uniqueIndex("equipos_categoria_clave_uq").on(t.categoria, t.clave),
    checkEnum("equipos_categoria_ck", "categoria", CATEGORIAS),
  ],
);

/**
 * Una persona que ha jugado en el club. Lo que cambia de una temporada a otra (categoría,
 * dorsal, posición, capitanía, foto) está en `jugadoresTemporada`.
 */
export const jugadores = sqliteTable("jugadores", {
  id: id(),
  nombre: text("nombre").notNull(),
  apodo: text("apodo"),
  posicionesConocidas: text("posiciones_conocidas", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'`),
  /** "YYYY-MM-DD". */
  fechaNacimiento: text("fecha_nacimiento"),
  /** Texto libre de temporadas anteriores a la herramienta. */
  historial: text("historial", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'`),
  compromiso: integer("compromiso"),
  ...marcasTiempo(),
});

/**
 * Inscripción de un jugador en un equipo del club para una temporada. La foto va aquí y no en
 * la persona: los carteles de cada año llevan la foto de ese año.
 *
 * El dorsal repetido no es una restricción sino un aviso en pantalla: en la vida real pasa.
 */
export const jugadoresTemporada = sqliteTable(
  "jugadores_temporada",
  {
    id: id(),
    temporadaId: text("temporada_id")
      .notNull()
      .references(() => temporadas.id, { onDelete: "cascade" }),
    jugadorId: text("jugador_id")
      .notNull()
      .references(() => jugadores.id, { onDelete: "cascade" }),
    categoria: text("categoria", { enum: CATEGORIAS }).notNull(),
    dorsal: integer("dorsal"),
    posicion: text("posicion", { enum: POSICIONES }),
    /** null = no es capitán; 1..n = orden de capitanía. */
    capitania: integer("capitania"),
    foto: text("foto"),
    ...marcasTiempo(),
  },
  (t) => [
    uniqueIndex("jugadores_temporada_uq").on(t.temporadaId, t.categoria, t.jugadorId),
    index("jugadores_temporada_dorsal_idx").on(t.temporadaId, t.categoria, t.dorsal),
    index("jugadores_temporada_jugador_idx").on(t.jugadorId),
    checkEnum("jugadores_temporada_categoria_ck", "categoria", CATEGORIAS),
    checkEnum("jugadores_temporada_posicion_ck", "posicion", POSICIONES),
    check("jugadores_temporada_capitania_ck", condicion(`"capitania" is null or "capitania" > 0`)),
  ],
);

/** Una persona del cuerpo técnico o de la directiva. Su papel de cada año está en `staffTemporada`. */
export const staff = sqliteTable("staff", {
  id: id(),
  nombre: text("nombre").notNull(),
  ...marcasTiempo(),
});

/**
 * Papel de una persona del staff en una temporada. El tipo también va aquí: alguien puede pasar
 * de entrenador a la directiva.
 */
export const staffTemporada = sqliteTable(
  "staff_temporada",
  {
    id: id(),
    temporadaId: text("temporada_id")
      .notNull()
      .references(() => temporadas.id, { onDelete: "cascade" }),
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    tipo: text("tipo", { enum: TIPOS_STAFF }).notNull(),
    categoria: text("categoria", { enum: CATEGORIAS }),
    cargo: text("cargo").notNull(),
    orden: integer("orden").notNull().default(0),
    foto: text("foto"),
    ...marcasTiempo(),
  },
  (t) => [
    index("staff_temporada_temporada_idx").on(t.temporadaId, t.tipo, t.categoria),
    index("staff_temporada_staff_idx").on(t.staffId),
    checkEnum("staff_temporada_tipo_ck", "tipo", TIPOS_STAFF),
    checkEnum("staff_temporada_categoria_ck", "categoria", CATEGORIAS),
    check(
      "staff_temporada_categoria_segun_tipo_ck",
      condicion(
        `("tipo" = 'directiva' and "categoria" is null) or ("tipo" = 'tecnico' and "categoria" is not null)`,
      ),
    ),
  ],
);
