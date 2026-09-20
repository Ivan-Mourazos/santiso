"use server";

import { schema } from "@santiso/db";
import { esValorDe, normalizarCategoria, POSICIONES } from "@santiso/domain";
import { eq } from "drizzle-orm";
import type { JugadorDto } from "@/lib/dto";
import { urlMedia } from "@/lib/media";
import { capturar, exito, fallo, type Resultado } from "@/lib/resultado";
import { listarJugadores } from "@/lib/server/consultas/jugadores";
import { obtenerDb } from "@/lib/server/db";
import { guardarImagenOpcional } from "@/lib/server/imagen";

export async function cargarJugadores(categoria: string): Promise<JugadorDto[]> {
  return listarJugadores(categoria);
}

/** Texto de un campo de formulario, ya recortado; `null` si viene vacío. */
const texto = (formulario: FormData, campo: string): string | null =>
  String(formulario.get(campo) ?? "").trim() || null;

export async function guardarJugador(formulario: FormData): Promise<Resultado<JugadorDto>> {
  const id = String(formulario.get("id") ?? "").trim();
  const nombre = texto(formulario, "nombre");
  if (!nombre) return fallo("El nombre es obligatorio.", { nombre: "Obligatorio" });

  let categoria: ReturnType<typeof normalizarCategoria>;
  try {
    categoria = normalizarCategoria(String(formulario.get("categoria") ?? ""));
  } catch {
    return fallo("Categoría desconocida.", { categoria: "No válida" });
  }

  // El formulario manda "" cuando no hay dorsal; `parseInt("")` daría NaN y la columna es anulable.
  const dorsalTexto = texto(formulario, "dorsal");
  let dorsal: number | null = null;
  if (dorsalTexto !== null) {
    const numero = Number(dorsalTexto);
    if (!Number.isInteger(numero) || numero < 0) {
      return fallo("El dorsal debe ser un número entero.", { dorsal: "No válido" });
    }
    dorsal = numero;
  }

  const posicionTexto = texto(formulario, "posicion");
  if (posicionTexto !== null && !esValorDe(POSICIONES, posicionTexto)) {
    return fallo("Posición desconocida.", { posicion: "No válida" });
  }
  const posicion = posicionTexto;

  const historial = String(formulario.get("historial") ?? "")
    .split("\n")
    .map((linea) => linea.trim())
    .filter(Boolean);

  const imagen = await guardarImagenOpcional(formulario, "foto", "jugadores");
  if (!imagen.ok) return imagen;

  return capturar("No se pudo guardar el jugador.", async () => {
    const { db } = await obtenerDb();
    const valores = {
      nombre,
      apodo: texto(formulario, "apodo"),
      dorsal,
      posicion,
      categoria,
      fechaNacimiento: texto(formulario, "fechaNacimiento"),
      historial,
      ...(imagen.datos ? { foto: imagen.datos } : {}),
    };
    const columnas = {
      id: schema.jugadores.id,
      nombre: schema.jugadores.nombre,
      apodo: schema.jugadores.apodo,
      dorsal: schema.jugadores.dorsal,
      posicion: schema.jugadores.posicion,
      foto: schema.jugadores.foto,
      categoria: schema.jugadores.categoria,
      fechaNacimiento: schema.jugadores.fechaNacimiento,
      historial: schema.jugadores.historial,
    };
    const [fila] = id
      ? await db
          .update(schema.jugadores)
          .set(valores)
          .where(eq(schema.jugadores.id, id))
          .returning(columnas)
      : await db.insert(schema.jugadores).values(valores).returning(columnas);
    if (!fila) throw new Error("La operación no devolvió ninguna fila");
    return {
      id: fila.id,
      nombre: fila.nombre,
      apodo: fila.apodo,
      dorsal: fila.dorsal,
      posicion: fila.posicion,
      foto_url: fila.foto ? urlMedia(fila.foto) : null,
      categoria: fila.categoria,
      fecha_nacimiento: fila.fechaNacimiento,
      historial_deportivo: fila.historial,
    };
  });
}

export async function borrarJugador(id: string): Promise<Resultado<null>> {
  const { db } = await obtenerDb();
  const resultado = await capturar("No se pudo borrar el jugador.", async () => {
    await db.delete(schema.jugadores).where(eq(schema.jugadores.id, id));
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}
