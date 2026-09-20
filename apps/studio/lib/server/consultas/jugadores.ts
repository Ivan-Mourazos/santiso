import "server-only";
import { schema } from "@santiso/db";
import { normalizarCategoria } from "@santiso/domain";
import { asc, eq, sql } from "drizzle-orm";
import type { JugadorDto } from "@/lib/dto";
import { urlMedia } from "@/lib/media";
import { obtenerDb } from "@/lib/server/db";

/**
 * Plantilla de una categoría, por dorsal; quien no tiene dorsal va al final.
 * Sin `categoria` devuelve las tres, que es lo que necesita el importador en lote.
 */
export async function listarJugadores(categoria?: string): Promise<JugadorDto[]> {
  const { db } = await obtenerDb();
  const filas = await db
    .select({
      id: schema.jugadores.id,
      nombre: schema.jugadores.nombre,
      apodo: schema.jugadores.apodo,
      dorsal: schema.jugadores.dorsal,
      posicion: schema.jugadores.posicion,
      foto: schema.jugadores.foto,
      categoria: schema.jugadores.categoria,
      fechaNacimiento: schema.jugadores.fechaNacimiento,
      historial: schema.jugadores.historial,
    })
    .from(schema.jugadores)
    .where(categoria ? eq(schema.jugadores.categoria, normalizarCategoria(categoria)) : undefined)
    .orderBy(
      sql`${schema.jugadores.dorsal} is null`,
      asc(schema.jugadores.dorsal),
      asc(schema.jugadores.nombre),
    );
  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    apodo: f.apodo,
    dorsal: f.dorsal,
    posicion: f.posicion,
    foto_url: f.foto ? urlMedia(f.foto) : null,
    categoria: f.categoria,
    fecha_nacimiento: f.fechaNacimiento,
    historial_deportivo: f.historial,
  }));
}
