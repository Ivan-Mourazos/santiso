import "server-only";
import { schema } from "@santiso/db";
import { asc, eq, type SQL } from "drizzle-orm";
import type { PatrocinadorDto } from "@/lib/dto";
import { urlMedia } from "@/lib/media";
import { obtenerDb } from "@/lib/server/db";

/**
 * Patrocinadores por `orden`. `enCarteles` ya no separa dos pantallas: es un interruptor del
 * catálogo único (6D). Esta lectura sigue existiendo para la barra del cartel, que solo pinta
 * los activados.
 */
export async function listarPatrocinadores(enCarteles: boolean): Promise<PatrocinadorDto[]> {
  return leer(eq(schema.patrocinadores.enCarteles, enCarteles));
}

/**
 * Catálogo completo: primero los que salen en carteles, en su orden, y después el resto por
 * nombre. Los cinco logos institucionales viven aquí desde la 6D, no en una lista aparte.
 */
export async function listarCatalogoPatrocinadores(): Promise<PatrocinadorDto[]> {
  const todos = await leer(undefined);
  const enCarteles = todos.filter((p) => p.en_carteles);
  const fuera = todos
    .filter((p) => !p.en_carteles)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es") || a.id.localeCompare(b.id));
  return [...enCarteles, ...fuera];
}

async function leer(condicion: SQL | undefined): Promise<PatrocinadorDto[]> {
  const { db } = await obtenerDb();
  const filas = await db
    .select({
      id: schema.patrocinadores.id,
      nombre: schema.patrocinadores.nombre,
      logo: schema.patrocinadores.logo,
      webUrl: schema.patrocinadores.webUrl,
      orden: schema.patrocinadores.orden,
      enCarteles: schema.patrocinadores.enCarteles,
    })
    .from(schema.patrocinadores)
    .where(condicion)
    .orderBy(
      asc(schema.patrocinadores.orden),
      asc(schema.patrocinadores.nombre),
      asc(schema.patrocinadores.id),
    );
  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    logo_url: f.logo ? urlMedia(f.logo) : null,
    web_url: f.webUrl,
    orden: f.orden,
    en_carteles: f.enCarteles,
  }));
}
