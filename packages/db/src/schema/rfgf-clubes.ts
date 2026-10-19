import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { marcasTiempo } from "./comunes";

/**
 * Un club tal como lo publica la federación en su listado de clubes (la exportación «Excel» de
 * futgal.es). Lo que no está en ese listado no se inventa: las columnas vacías quedan a `null`.
 */
export const rfgfClubes = sqliteTable(
  "rfgf_clubes",
  {
    /** «Clave Acceso» en el listado: el código del club en la federación. */
    codigo: text("codigo").primaryKey(),
    /** Nombre con las reglas de `normalizarNombreEquipo`. */
    nombre: text("nombre").notNull(),
    /** `claveNombre(nombre)`, para buscar. */
    clave: text("clave").notNull(),
    delegacion: text("delegacion"),
    comarca: text("comarca"),
    direccion: text("direccion"),
    localidad: text("localidad"),
    provincia: text("provincia"),
    codigoPostal: text("codigo_postal"),
    /** `AAAA-MM-DD`. */
    fechaFundacion: text("fecha_fundacion"),
    /** `AAAA-MM-DD`. */
    fechaInscripcionFederacion: text("fecha_inscripcion_federacion"),
    /** La equipación tal como la escribe la federación («Amarilla», «Negro», «Negras»). */
    camiseta: text("camiseta"),
    pantalon: text("pantalon"),
    medias: text("medias"),
    numeroEquipos: integer("numero_equipos"),
    /** Cuándo se leyó del listado, ISO. */
    leidoEn: text("leido_en").notNull(),
    ...marcasTiempo(),
  },
  (t) => [index("rfgf_clubes_clave_idx").on(t.clave)],
);
