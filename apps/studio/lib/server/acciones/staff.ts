"use server";

import { schema } from "@santiso/db";
import { type Categoria, normalizarCategoria } from "@santiso/domain";
import { and, eq, max } from "drizzle-orm";
import type { StaffDto } from "@/lib/dto";
import { capturar, exito, fallo, type Resultado } from "@/lib/resultado";
import {
  candidatosStaffDeTemporadaAnterior,
  listarStaff,
  type CandidatosStaff,
} from "@/lib/server/consultas/staff";
import { obtenerDb } from "@/lib/server/db";
import { guardarImagenOpcional } from "@/lib/server/imagen";
import { resolverTemporada } from "@/lib/server/temporada";
import { normalizarTipoStaff } from "@/lib/server/tipos-staff";

/** Staff de una temporada; sin `temporadaId`, la activa. */
export async function cargarStaff(
  tipo: string,
  categoria?: string,
  temporadaId?: string | null,
): Promise<StaffDto[]> {
  return listarStaff(tipo, categoria, temporadaId);
}

export async function cargarCandidatosStaff(
  tipo: string,
  categoria?: string,
  temporadaId?: string | null,
): Promise<CandidatosStaff> {
  return candidatosStaffDeTemporadaAnterior(tipo, categoria, temporadaId);
}

/**
 * Alta o edición de un papel del staff **en una temporada** (la activa si no se indica otra).
 *
 * - `id` es la persona: vacío la crea; con valor, actualiza su nombre.
 * - `inscripcionId` es el papel de esa temporada: vacío lo crea; con valor, lo reescribe entero.
 */
export async function guardarMiembroStaff(formulario: FormData): Promise<Resultado<StaffDto>> {
  const id = String(formulario.get("id") ?? "").trim();
  const inscripcionId = String(formulario.get("inscripcionId") ?? "").trim();
  const nombre = String(formulario.get("nombre") ?? "").trim();
  const cargo = String(formulario.get("cargo") ?? "").trim();
  if (!nombre) return fallo("El nombre es obligatorio.", { nombre: "Obligatorio" });
  if (!cargo) return fallo("El cargo es obligatorio.", { cargo: "Obligatorio" });

  const tipo = normalizarTipoStaff(String(formulario.get("tipo") ?? ""));
  if (!tipo) return fallo("Tipo de staff desconocido.", { tipo: "No válido" });

  // El CHECK de la tabla exige categoría en los técnicos y su ausencia en la directiva.
  let categoria: Categoria | null = null;
  if (tipo === "tecnico") {
    const texto = String(formulario.get("categoria") ?? "").trim();
    if (!texto) return fallo("Un técnico necesita categoría.", { categoria: "Obligatoria" });
    try {
      categoria = normalizarCategoria(texto);
    } catch {
      return fallo("Categoría desconocida.", { categoria: "No válida" });
    }
  }

  const temporada = await resolverTemporada(
    String(formulario.get("temporadaId") ?? "").trim() || null,
  );
  if (!temporada) return fallo("No hay temporada en la que dar de alta. Crea una antes.");

  const imagen = await guardarImagenOpcional(formulario, "foto", "staff");
  if (!imagen.ok) return imagen;

  const { db } = await obtenerDb();
  const guardado = await capturar("No se pudo guardar el miembro del staff.", async () =>
    db.transaction(async (tx) => {
      let staffId = id;
      if (staffId) {
        const [persona] = await tx
          .update(schema.staff)
          .set({ nombre })
          .where(eq(schema.staff.id, staffId))
          .returning({ id: schema.staff.id });
        if (!persona) throw new Error("La persona no existe");
      } else {
        const [persona] = await tx
          .insert(schema.staff)
          .values({ nombre })
          .returning({ id: schema.staff.id });
        if (!persona) throw new Error("La operación no devolvió ninguna fila");
        staffId = persona.id;
      }

      const papel = { cargo, tipo, categoria, ...(imagen.datos ? { foto: imagen.datos } : {}) };
      if (inscripcionId) {
        const [actualizado] = await tx
          .update(schema.staffTemporada)
          .set(papel)
          .where(
            and(
              eq(schema.staffTemporada.id, inscripcionId),
              eq(schema.staffTemporada.staffId, staffId),
            ),
          )
          .returning({ id: schema.staffTemporada.id });
        if (!actualizado) throw new Error("El papel de esa temporada no existe");
        return actualizado.id;
      }

      const [ultimo] = await tx
        .select({ orden: max(schema.staffTemporada.orden) })
        .from(schema.staffTemporada)
        .where(
          and(
            eq(schema.staffTemporada.temporadaId, temporada.id),
            eq(schema.staffTemporada.tipo, tipo),
          ),
        );
      const [creado] = await tx
        .insert(schema.staffTemporada)
        .values({
          temporadaId: temporada.id,
          staffId,
          orden: (ultimo?.orden ?? 0) + 10,
          ...papel,
        })
        .returning({ id: schema.staffTemporada.id });
      if (!creado) throw new Error("La operación no devolvió ninguna fila");
      return creado.id;
    }),
  );
  if (!guardado.ok) return guardado;

  const [fila] = (await listarStaff(tipo, categoria ?? undefined, temporada.id)).filter(
    (miembro) => miembro.inscripcion_id === guardado.datos,
  );
  return fila ? exito(fila) : fallo("Se guardó pero no se pudo releer.");
}

/** Trae a esta temporada papeles de otra, con el mismo cargo, orden y foto. */
export async function incorporarStaff(entrada: {
  temporadaId?: string | null;
  inscripciones: string[];
}): Promise<Resultado<number>> {
  const temporada = await resolverTemporada(entrada.temporadaId);
  if (!temporada) return fallo("No hay temporada de destino.");
  if (entrada.inscripciones.length === 0) return exito(0);

  const { db } = await obtenerDb();
  return capturar("No se pudo incorporar al staff.", async () =>
    db.transaction(async (tx) => {
      let incorporados = 0;
      for (const inscripcionId of entrada.inscripciones) {
        const [origen] = await tx
          .select()
          .from(schema.staffTemporada)
          .where(eq(schema.staffTemporada.id, inscripcionId));
        if (!origen) throw new Error("El papel de origen no existe");
        if (origen.temporadaId === temporada.id) continue;
        await tx.insert(schema.staffTemporada).values({
          temporadaId: temporada.id,
          staffId: origen.staffId,
          tipo: origen.tipo,
          categoria: origen.categoria,
          cargo: origen.cargo,
          orden: origen.orden,
          foto: origen.foto,
        });
        incorporados += 1;
      }
      return incorporados;
    }),
  );
}

/**
 * Quita un papel de una temporada. **No borra a la persona** si tiene papel en otra; si se queda
 * sin ninguno, era un alta por error y se borra también (el staff no cuelga de ningún partido).
 */
export async function quitarMiembroStaffDeTemporada(
  inscripcionId: string,
): Promise<Resultado<null>> {
  const { db } = await obtenerDb();
  const resultado = await capturar("No se pudo quitar al miembro del staff.", async () =>
    db.transaction(async (tx) => {
      const [papel] = await tx
        .delete(schema.staffTemporada)
        .where(eq(schema.staffTemporada.id, inscripcionId))
        .returning({ staffId: schema.staffTemporada.staffId });
      if (!papel) return null;
      const [otro] = await tx
        .select({ id: schema.staffTemporada.id })
        .from(schema.staffTemporada)
        .where(eq(schema.staffTemporada.staffId, papel.staffId))
        .limit(1);
      if (!otro) await tx.delete(schema.staff).where(eq(schema.staff.id, papel.staffId));
      return null;
    }),
  );
  return resultado.ok ? exito(null) : resultado;
}
