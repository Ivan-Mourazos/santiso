"use server";

import { schema } from "@santiso/db";
import { type Categoria, normalizarCategoria } from "@santiso/domain";
import { eq, max } from "drizzle-orm";
import type { StaffDto } from "@/lib/dto";
import { urlMedia } from "@/lib/media";
import { capturar, exito, fallo, type Resultado } from "@/lib/resultado";
import { listarStaff } from "@/lib/server/consultas/staff";
import { obtenerDb } from "@/lib/server/db";
import { guardarImagenOpcional } from "@/lib/server/imagen";
import { normalizarTipoStaff } from "@/lib/server/tipos-staff";

export async function cargarStaff(tipo: string, categoria?: string): Promise<StaffDto[]> {
  return listarStaff(tipo, categoria);
}

export async function guardarMiembroStaff(formulario: FormData): Promise<Resultado<StaffDto>> {
  const id = String(formulario.get("id") ?? "").trim();
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

  const imagen = await guardarImagenOpcional(formulario, "foto", "staff");
  if (!imagen.ok) return imagen;

  return capturar("No se pudo guardar el miembro del staff.", async () => {
    const { db } = await obtenerDb();
    const columnas = {
      id: schema.staff.id,
      nombre: schema.staff.nombre,
      cargo: schema.staff.cargo,
      tipo: schema.staff.tipo,
      categoria: schema.staff.categoria,
      foto: schema.staff.foto,
      orden: schema.staff.orden,
    };
    let fila;
    if (id) {
      [fila] = await db
        .update(schema.staff)
        .set({ nombre, cargo, tipo, categoria, ...(imagen.datos ? { foto: imagen.datos } : {}) })
        .where(eq(schema.staff.id, id))
        .returning(columnas);
    } else {
      const [ultimo] = await db
        .select({ orden: max(schema.staff.orden) })
        .from(schema.staff)
        .where(eq(schema.staff.tipo, tipo));
      [fila] = await db
        .insert(schema.staff)
        .values({
          nombre,
          cargo,
          tipo,
          categoria,
          orden: (ultimo?.orden ?? 0) + 10,
          ...(imagen.datos ? { foto: imagen.datos } : {}),
        })
        .returning(columnas);
    }
    if (!fila) throw new Error("La operación no devolvió ninguna fila");
    return {
      id: fila.id,
      nombre: fila.nombre,
      cargo: fila.cargo,
      tipo: fila.tipo,
      categoria: fila.categoria,
      foto_url: fila.foto ? urlMedia(fila.foto) : null,
      orden: fila.orden,
    };
  });
}

export async function borrarMiembroStaff(id: string): Promise<Resultado<null>> {
  const { db } = await obtenerDb();
  const resultado = await capturar("No se pudo borrar el miembro del staff.", async () => {
    await db.delete(schema.staff).where(eq(schema.staff.id, id));
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}
