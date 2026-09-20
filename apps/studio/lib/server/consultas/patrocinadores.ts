import "server-only";
import { schema } from "@santiso/db";
import { asc, eq } from "drizzle-orm";
import type { PatrocinadorDto } from "@/lib/dto";
import { urlMedia } from "@/lib/media";
import { obtenerDb } from "@/lib/server/db";

/**
 * Patrocinadores por `orden`. `enCarteles` separa las dos pantallas que comparten la tabla:
 * `false` son los de la web y `true` los logos que se pintan en los carteles.
 */
export async function listarPatrocinadores(enCarteles: boolean): Promise<PatrocinadorDto[]> {
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
    .where(eq(schema.patrocinadores.enCarteles, enCarteles))
    .orderBy(asc(schema.patrocinadores.orden), asc(schema.patrocinadores.nombre));
  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    logo_url: f.logo ? urlMedia(f.logo) : null,
    web_url: f.webUrl,
    orden: f.orden,
    en_carteles: f.enCarteles,
  }));
}
