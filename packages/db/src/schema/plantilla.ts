import { CATEGORIAS, POSICIONES, TIPOS_STAFF } from "@santiso/domain";
import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
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

export const jugadores = sqliteTable(
  "jugadores",
  {
    id: id(),
    nombre: text("nombre").notNull(),
    apodo: text("apodo"),
    dorsal: integer("dorsal"),
    posicion: text("posicion", { enum: POSICIONES }),
    posicionesConocidas: text("posiciones_conocidas", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    /** null = no es capitán; 1..n = orden de capitanía. */
    capitania: integer("capitania"),
    categoria: text("categoria", { enum: CATEGORIAS }).notNull(),
    foto: text("foto"),
    /** "YYYY-MM-DD". */
    fechaNacimiento: text("fecha_nacimiento"),
    historial: text("historial", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    compromiso: integer("compromiso"),
    ...marcasTiempo(),
  },
  (t) => [
    index("jugadores_categoria_dorsal_idx").on(t.categoria, t.dorsal),
    checkEnum("jugadores_categoria_ck", "categoria", CATEGORIAS),
    checkEnum("jugadores_posicion_ck", "posicion", POSICIONES),
    check("jugadores_capitania_ck", condicion(`"capitania" is null or "capitania" > 0`)),
  ],
);

export const staff = sqliteTable(
  "staff",
  {
    id: id(),
    nombre: text("nombre").notNull(),
    cargo: text("cargo").notNull(),
    tipo: text("tipo", { enum: TIPOS_STAFF }).notNull(),
    categoria: text("categoria", { enum: CATEGORIAS }),
    foto: text("foto"),
    orden: integer("orden").notNull().default(0),
    ...marcasTiempo(),
  },
  () => [
    checkEnum("staff_tipo_ck", "tipo", TIPOS_STAFF),
    checkEnum("staff_categoria_ck", "categoria", CATEGORIAS),
    check(
      "staff_categoria_segun_tipo_ck",
      condicion(
        `("tipo" = 'directiva' and "categoria" is null) or ("tipo" = 'tecnico' and "categoria" is not null)`,
      ),
    ),
  ],
);
