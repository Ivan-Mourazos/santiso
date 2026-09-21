import "server-only";
import { schema } from "@santiso/db";
import { normalizarCategoria } from "@santiso/domain";
import { and, asc, eq, type SQL } from "drizzle-orm";
import type { StaffDto } from "@/lib/dto";
import { urlMedia } from "@/lib/media";
import { obtenerDb } from "@/lib/server/db";
import { resolverTemporada, temporadaAnterior } from "@/lib/server/temporada";
import { normalizarTipoStaff } from "@/lib/server/tipos-staff";

/**
 * Cuerpo técnico (filtrado por categoría) o directiva de una temporada (la activa si no se pide
 * otra), por `orden`.
 */
export async function listarStaff(
  tipo: string,
  categoria?: string,
  temporadaId?: string | null,
): Promise<StaffDto[]> {
  const tipoNormalizado = normalizarTipoStaff(tipo);
  if (!tipoNormalizado) return [];
  const temporada = await resolverTemporada(temporadaId);
  if (!temporada) return [];

  const condiciones: SQL[] = [
    eq(schema.staffTemporada.temporadaId, temporada.id),
    eq(schema.staffTemporada.tipo, tipoNormalizado),
  ];
  if (tipoNormalizado === "tecnico" && categoria) {
    try {
      condiciones.push(eq(schema.staffTemporada.categoria, normalizarCategoria(categoria)));
    } catch {
      // Categoría desconocida: no hay cuerpo técnico que mostrar.
      return [];
    }
  }

  const { db } = await obtenerDb();
  const filas = await db
    .select({
      id: schema.staff.id,
      inscripcionId: schema.staffTemporada.id,
      temporadaId: schema.staffTemporada.temporadaId,
      nombre: schema.staff.nombre,
      cargo: schema.staffTemporada.cargo,
      tipo: schema.staffTemporada.tipo,
      categoria: schema.staffTemporada.categoria,
      foto: schema.staffTemporada.foto,
      orden: schema.staffTemporada.orden,
    })
    .from(schema.staffTemporada)
    .innerJoin(schema.staff, eq(schema.staff.id, schema.staffTemporada.staffId))
    .where(and(...condiciones))
    .orderBy(asc(schema.staffTemporada.orden), asc(schema.staffTemporada.creadoEn));
  return filas.map((f) => ({
    id: f.id,
    inscripcion_id: f.inscripcionId,
    temporada_id: f.temporadaId,
    nombre: f.nombre,
    cargo: f.cargo,
    tipo: f.tipo,
    categoria: f.categoria,
    foto_url: f.foto ? urlMedia(f.foto) : null,
    orden: f.orden,
  }));
}

export interface CandidatosStaff {
  origen: { id: string; nombre: string } | null;
  miembros: StaffDto[];
}

/**
 * Staff de la temporada anterior, del mismo tipo (y categoría, en los técnicos), que todavía no
 * tiene ese papel en esta. Una persona que ya está con otro cargo sí aparece: puede tener dos.
 */
export async function candidatosStaffDeTemporadaAnterior(
  tipo: string,
  categoria?: string,
  temporadaId?: string | null,
): Promise<CandidatosStaff> {
  const destino = await resolverTemporada(temporadaId);
  if (!destino) return { origen: null, miembros: [] };
  const origen = await temporadaAnterior(destino);
  if (!origen) return { origen: null, miembros: [] };

  const yaEstan = new Set(
    (await listarStaff(tipo, categoria, destino.id)).map((miembro) => miembro.id),
  );
  const miembros = (await listarStaff(tipo, categoria, origen.id)).filter(
    (miembro) => !yaEstan.has(miembro.id),
  );
  return { origen, miembros };
}
