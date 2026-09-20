import "server-only";
import { schema } from "@santiso/db";
import { normalizarCategoria } from "@santiso/domain";
import { and, asc, eq, type SQL } from "drizzle-orm";
import type { StaffDto } from "@/lib/dto";
import { urlMedia } from "@/lib/media";
import { obtenerDb } from "@/lib/server/db";
import { normalizarTipoStaff } from "@/lib/server/tipos-staff";

/** Cuerpo técnico (filtrado por categoría) o directiva, por `orden`. */
export async function listarStaff(tipo: string, categoria?: string): Promise<StaffDto[]> {
  const tipoNormalizado = normalizarTipoStaff(tipo);
  if (!tipoNormalizado) return [];
  const condiciones: SQL[] = [eq(schema.staff.tipo, tipoNormalizado)];
  if (tipoNormalizado === "tecnico" && categoria) {
    try {
      condiciones.push(eq(schema.staff.categoria, normalizarCategoria(categoria)));
    } catch {
      // Categoría desconocida: no hay cuerpo técnico que mostrar.
      return [];
    }
  }

  const { db } = await obtenerDb();
  const filas = await db
    .select({
      id: schema.staff.id,
      nombre: schema.staff.nombre,
      cargo: schema.staff.cargo,
      tipo: schema.staff.tipo,
      categoria: schema.staff.categoria,
      foto: schema.staff.foto,
      orden: schema.staff.orden,
    })
    .from(schema.staff)
    .where(and(...condiciones))
    .orderBy(asc(schema.staff.orden), asc(schema.staff.creadoEn));
  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    cargo: f.cargo,
    tipo: f.tipo,
    categoria: f.categoria,
    foto_url: f.foto ? urlMedia(f.foto) : null,
    orden: f.orden,
  }));
}
