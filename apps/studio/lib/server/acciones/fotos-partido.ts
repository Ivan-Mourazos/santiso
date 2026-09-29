"use server";

import { schema } from "@santiso/db";
import { asc, eq } from "drizzle-orm";
import type { FotoPartidoDto } from "@/lib/dto";
import { urlMedia } from "@/lib/media";
import { capturar, exito, fallo, type Resultado } from "@/lib/resultado";
import { obtenerDb } from "@/lib/server/db";
import { guardarFotoPartido, leerImagen } from "@/lib/server/media";

const COLUMNAS = {
  id: schema.fotosPartido.id,
  partidoId: schema.fotosPartido.partidoId,
  clave: schema.fotosPartido.clave,
  ancho: schema.fotosPartido.ancho,
  alto: schema.fotosPartido.alto,
  focoX: schema.fotosPartido.focoX,
  focoY: schema.fotosPartido.focoY,
};

type Fila = {
  id: string;
  partidoId: string;
  clave: string;
  ancho: number;
  alto: number;
  focoX: number;
  focoY: number;
};

const aDto = (f: Fila): FotoPartidoDto => ({
  id: f.id,
  partido_id: f.partidoId,
  url: urlMedia(f.clave),
  ancho: f.ancho,
  alto: f.alto,
  foco_x: f.focoX,
  foco_y: f.focoY,
});

/** Fotos de un partido, en el orden en que se subieron. */
export async function listarFotosPartido(partidoId: string): Promise<Resultado<FotoPartidoDto[]>> {
  if (!partidoId) return exito([]);
  return capturar("No se pudieron cargar las fotos del partido.", async () => {
    const { db } = await obtenerDb();
    const filas = await db
      .select(COLUMNAS)
      .from(schema.fotosPartido)
      .where(eq(schema.fotosPartido.partidoId, partidoId))
      .orderBy(asc(schema.fotosPartido.creadoEn), asc(schema.fotosPartido.id));
    return filas.map(aDto);
  });
}

/**
 * Sube varias fotos (campo `fotos`) a la galería de un partido. Cada una se guarda con su foco
 * calculado. Si alguna no es una imagen válida se salta y se cuenta en `descartadas`.
 */
export async function subirFotosPartido(
  partidoId: string,
  formulario: FormData,
): Promise<Resultado<{ fotos: FotoPartidoDto[]; descartadas: number }>> {
  const ficheros = formulario.getAll("fotos");
  if (ficheros.length === 0) return fallo("Elige al menos una foto.");
  const { db } = await obtenerDb();
  const partido = await db
    .select({ id: schema.partidos.id })
    .from(schema.partidos)
    .where(eq(schema.partidos.id, partidoId))
    .get();
  if (!partido) return fallo("El partido ya no existe.");

  const fotos: FotoPartidoDto[] = [];
  let descartadas = 0;
  for (const fichero of ficheros) {
    const bytes = await leerImagen(fichero);
    if (!bytes.ok) {
      descartadas++;
      continue;
    }
    try {
      const foto = await guardarFotoPartido(bytes.datos);
      const [fila] = await db
        .insert(schema.fotosPartido)
        .values({ partidoId, ...foto })
        .returning(COLUMNAS);
      if (fila) fotos.push(aDto(fila));
    } catch (error) {
      console.error("subirFotosPartido", error);
      descartadas++;
    }
  }
  if (fotos.length === 0) return fallo("Ninguna foto se pudo guardar. Comprueba los ficheros.");
  return exito({ fotos, descartadas });
}

/** Corrige el punto de interés de una foto (0–1 en cada eje). */
export async function cambiarFocoFoto(
  id: string,
  focoX: number,
  focoY: number,
): Promise<Resultado<null>> {
  const valido = (v: number) => Number.isFinite(v) && v >= 0 && v <= 1;
  if (!valido(focoX) || !valido(focoY)) return fallo("Punto de la foto no válido.");
  const redondear = (v: number) => Math.round(v * 1000) / 1000;
  return capturar("No se pudo guardar el encuadre.", async () => {
    const { db } = await obtenerDb();
    await db
      .update(schema.fotosPartido)
      .set({ focoX: redondear(focoX), focoY: redondear(focoY) })
      .where(eq(schema.fotosPartido.id, id));
    return null;
  });
}

/** Quita una foto de la galería. El fichero se queda en `data/media`, como el resto de imágenes. */
export async function quitarFotoPartido(id: string): Promise<Resultado<null>> {
  return capturar("No se pudo quitar la foto.", async () => {
    const { db } = await obtenerDb();
    await db.delete(schema.fotosPartido).where(eq(schema.fotosPartido.id, id));
    return null;
  });
}
