"use server";

import { schema } from "@santiso/db";
import {
  claveNombre,
  esEquipoPropio,
  normalizarCategoria,
  normalizarNombreEquipo,
} from "@santiso/domain";
import { and, eq, or } from "drizzle-orm";
import type { EquipoCatalogo } from "@/lib/equipos/modelo";
import type { EquipoDto } from "@/lib/dto";
import { urlMedia } from "@/lib/media";
import { capturar, exito, fallo, type Resultado } from "@/lib/resultado";
import {
  catalogoEquipos,
  equiposDeCompeticion,
  equiposPorIds,
  listarEquiposDeCategoria,
} from "@/lib/server/consultas/equipos";
import { obtenerDb } from "@/lib/server/db";
import { guardarImagenOpcional } from "@/lib/server/imagen";

/**
 * Envoltorios de servidor para los componentes cliente. Las funciones de `consultas/` llevan
 * `server-only` y no pueden importarse desde el navegador: el cliente entra siempre por aquí.
 */
export async function cargarEquiposDeCompeticion(competicionId: string): Promise<EquipoDto[]> {
  return equiposDeCompeticion(competicionId);
}

export async function cargarEquiposPorIds(ids: string[]): Promise<EquipoDto[]> {
  return equiposPorIds(ids);
}

export async function cargarEquiposDeCategoria(categoria: string): Promise<EquipoDto[]> {
  return listarEquiposDeCategoria(categoria);
}

/**
 * Carga de la pantalla de equipos en una sola acción: la librería de la categoría y los
 * inscritos en la competición. Dos acciones separadas serían dos viajes en serie.
 */
export async function cargarPantallaEquipos(
  categoria: string,
  competicionId: string,
): Promise<{ todos: EquipoDto[]; inscritos: EquipoDto[] }> {
  const [todos, inscritos] = await Promise.all([
    listarEquiposDeCategoria(categoria),
    competicionId ? equiposDeCompeticion(competicionId) : Promise.resolve([]),
  ]);
  return { todos, inscritos };
}

/** Alta o edición de un equipo. `id` vacío es alta. `competicionId` lo inscribe tras guardarlo. */
export async function guardarEquipo(formulario: FormData): Promise<Resultado<EquipoDto>> {
  const id = String(formulario.get("id") ?? "").trim();
  const escrito = String(formulario.get("nombre") ?? "").trim();
  const competicionId = String(formulario.get("competicionId") ?? "").trim();
  if (!escrito) return fallo("El nombre es obligatorio.", { nombre: "Obligatorio" });

  let categoria: ReturnType<typeof normalizarCategoria>;
  try {
    categoria = normalizarCategoria(String(formulario.get("categoria") ?? ""));
  } catch {
    return fallo("Categoría desconocida.", { categoria: "No válida" });
  }

  // Mismas reglas que el resto de la base: «MELIDE VETERANOS» se guarda como «Melide».
  const nombre = normalizarNombreEquipo(escrito, categoria);
  const clave = claveNombre(nombre);
  const { db } = await obtenerDb();
  const [chocante] = await db
    .select({ id: schema.equipos.id })
    .from(schema.equipos)
    .where(and(eq(schema.equipos.categoria, categoria), eq(schema.equipos.clave, clave)));
  if (chocante && chocante.id !== id) {
    return fallo("Ya existe un equipo con ese nombre en esta categoría.", { nombre: "Repetido" });
  }

  // Color del equipo: vacío lo quita (vuelve a sacarse del escudo).
  const colorEscrito = formulario.has("color") ? String(formulario.get("color") ?? "").trim() : null;
  if (colorEscrito && !/^#[0-9a-f]{6}$/i.test(colorEscrito)) {
    return fallo("El color debe ser #rrggbb.", { color: "No válido" });
  }

  const imagen = await guardarImagenOpcional(formulario, "escudo", "escudos");
  if (!imagen.ok) return imagen;

  const guardado = await capturar("No se pudo guardar el equipo.", async () => {
    const valores = {
      nombre,
      clave,
      categoria,
      esPropio: esEquipoPropio(nombre),
      ...(imagen.datos ? { escudo: imagen.datos } : {}),
      // Solo si el formulario lo trae: quien no lo manda no lo cambia.
      ...(formulario.has("escudo3d") ? { escudo3d: formulario.get("escudo3d") === "1" } : {}),
      ...(colorEscrito !== null ? { color: colorEscrito.toLowerCase() || null } : {}),
    };
    const columnas = {
      id: schema.equipos.id,
      nombre: schema.equipos.nombre,
      categoria: schema.equipos.categoria,
      escudo: schema.equipos.escudo,
      esPropio: schema.equipos.esPropio,
      escudo3d: schema.equipos.escudo3d,
      color: schema.equipos.color,
    };
    const [fila] = id
      ? await db
          .update(schema.equipos)
          .set(valores)
          .where(eq(schema.equipos.id, id))
          .returning(columnas)
      : await db.insert(schema.equipos).values(valores).returning(columnas);
    if (!fila) throw new Error("La operación no devolvió ninguna fila");
    return fila;
  });
  if (!guardado.ok) return guardado;

  if (competicionId) {
    const inscrito = await inscribirEquipo(competicionId, guardado.datos.id);
    if (!inscrito.ok) return inscrito;
  }

  const fila = guardado.datos;
  return exito({
    id: fila.id,
    nombre: fila.nombre,
    categoria: fila.categoria,
    escudo_url: fila.escudo ? urlMedia(fila.escudo) : null,
    es_propio: fila.esPropio,
    escudo_3d: fila.escudo3d,
    color: fila.color,
  });
}

/** Inscribe un equipo en una competición. Repetirlo no falla ni duplica. */
export async function inscribirEquipo(
  competicionId: string,
  equipoId: string,
): Promise<Resultado<null>> {
  const { db } = await obtenerDb();
  const resultado = await capturar("No se pudo inscribir el equipo.", async () => {
    await db
      .insert(schema.competicionEquipos)
      .values({ competicionId, equipoId })
      .onConflictDoNothing();
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}

export async function quitarEquipoDeCompeticion(
  competicionId: string,
  equipoId: string,
): Promise<Resultado<null>> {
  const { db } = await obtenerDb();
  const resultado = await capturar("No se pudo quitar el equipo de la competición.", async () => {
    await db
      .delete(schema.competicionEquipos)
      .where(
        and(
          eq(schema.competicionEquipos.competicionId, competicionId),
          eq(schema.competicionEquipos.equipoId, equipoId),
        ),
      );
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}

/**
 * Borra un equipo de la librería. Se niega si tiene partidos: la clave foránea es `restrict`
 * y el borrado fallaría con un error de SQLite en vez de con un mensaje entendible.
 */
export async function borrarEquipo(id: string): Promise<Resultado<null>> {
  const { db } = await obtenerDb();
  const [partido] = await db
    .select({ id: schema.partidos.id })
    .from(schema.partidos)
    .where(or(eq(schema.partidos.equipoLocalId, id), eq(schema.partidos.equipoVisitanteId, id)));
  if (partido) return fallo("No se puede borrar: el equipo tiene partidos.");

  const resultado = await capturar("No se pudo borrar el equipo.", async () => {
    await db.transaction(async (tx) => {
      await tx.delete(schema.competicionEquipos).where(eq(schema.competicionEquipos.equipoId, id));
      await tx.delete(schema.equipos).where(eq(schema.equipos.id, id));
    });
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}

/** Lectura enriquecida de la biblioteca para la pantalla de Equipos. */
export async function cargarCatalogoEquipos(): Promise<EquipoCatalogo[]> {
  return catalogoEquipos();
}
