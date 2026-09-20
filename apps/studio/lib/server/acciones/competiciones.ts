"use server";

import { schema } from "@santiso/db";
import {
  esValorDe,
  FORMATOS_COMPETICION,
  normalizarCategoria,
  type ReglaClasificacion,
  reglasClasificacionSchema,
} from "@santiso/domain";
import { and, eq, max } from "drizzle-orm";
import type { CompeticionDto } from "@/lib/dto";
import { capturar, exito, fallo, type Resultado } from "@/lib/resultado";
import { listarCompeticiones, reglasDeCompeticion } from "@/lib/server/consultas/competiciones";
import { temporadaActivaId } from "@/lib/server/consultas/temporadas";
import { obtenerDb } from "@/lib/server/db";

export async function cargarCompeticiones(): Promise<Resultado<CompeticionDto[]>> {
  return capturar("No se pudieron cargar las competiciones.", listarCompeticiones);
}

/** Lectura de reglas para los componentes cliente; `consultas/` lleva `server-only`. */
export async function cargarReglas(competicionId: string): Promise<ReglaClasificacion[]> {
  return competicionId ? reglasDeCompeticion(competicionId) : [];
}

export async function crearCompeticion(entrada: {
  nombre: string;
  categoria: string;
  formato: string;
}): Promise<Resultado<CompeticionDto>> {
  const nombre = entrada.nombre.trim();
  if (!nombre) return fallo("El nombre es obligatorio.", { nombre: "Obligatorio" });

  let categoria: ReturnType<typeof normalizarCategoria>;
  try {
    categoria = normalizarCategoria(entrada.categoria);
  } catch {
    return fallo("Categoría desconocida.", { categoria: "No válida" });
  }
  if (!esValorDe(FORMATOS_COMPETICION, entrada.formato)) {
    return fallo("Formato desconocido.", { formato: "No válido" });
  }
  const formato = entrada.formato;

  const temporadaId = await temporadaActivaId();
  if (!temporadaId) return fallo("No hay temporada activa: crea una antes.");

  const { db } = await obtenerDb();
  const [existente] = await db
    .select({ id: schema.competiciones.id })
    .from(schema.competiciones)
    .where(
      and(
        eq(schema.competiciones.temporadaId, temporadaId),
        eq(schema.competiciones.categoria, categoria),
        eq(schema.competiciones.nombre, nombre),
      ),
    );
  if (existente) return fallo("Ya existe una competición con ese nombre.");

  return capturar("No se pudo crear la competición.", async () => {
    const [ultimo] = await db
      .select({ orden: max(schema.competiciones.orden) })
      .from(schema.competiciones)
      .where(
        and(
          eq(schema.competiciones.temporadaId, temporadaId),
          eq(schema.competiciones.categoria, categoria),
        ),
      );
    const [creada] = await db
      .insert(schema.competiciones)
      .values({ temporadaId, categoria, nombre, formato, orden: (ultimo?.orden ?? 0) + 10 })
      .returning({
        id: schema.competiciones.id,
        categoria: schema.competiciones.categoria,
        nombre: schema.competiciones.nombre,
        orden: schema.competiciones.orden,
        formato: schema.competiciones.formato,
      });
    if (!creada) throw new Error("La inserción no devolvió ninguna fila");
    return { ...creada, activa: true };
  });
}

/** Borra una competición vacía. Con jornadas se niega: el borrado en cascada se llevaría partidos. */
export async function borrarCompeticion(id: string): Promise<Resultado<null>> {
  const { db } = await obtenerDb();
  const [jornada] = await db
    .select({ id: schema.jornadas.id })
    .from(schema.jornadas)
    .where(eq(schema.jornadas.competicionId, id));
  if (jornada) return fallo("No se puede borrar: la competición tiene jornadas.");

  const resultado = await capturar("No se pudo borrar la competición.", async () => {
    await db.delete(schema.competiciones).where(eq(schema.competiciones.id, id));
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}

export async function guardarReglas(
  competicionId: string,
  reglas: unknown,
): Promise<Resultado<null>> {
  const analizado = reglasClasificacionSchema.safeParse(reglas);
  if (!analizado.success) return fallo("Las reglas de clasificación no son válidas.");

  const { db } = await obtenerDb();
  const resultado = await capturar("No se pudieron guardar las reglas.", async () => {
    await db
      .update(schema.competiciones)
      .set({ reglasClasificacion: analizado.data })
      .where(eq(schema.competiciones.id, competicionId));
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}
