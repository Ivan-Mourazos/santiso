"use server";

import { schema } from "@santiso/db";
import { claveNombre } from "@santiso/domain";
import { asc, eq } from "drizzle-orm";
import type { PatrocinadorDto } from "@/lib/dto";
import { urlMedia } from "@/lib/media";
import { esWebValida } from "@/lib/patrocinadores/modelo";
import { capturar, exito, fallo, type Resultado } from "@/lib/resultado";
import {
  listarCatalogoPatrocinadores,
  listarPatrocinadores,
} from "@/lib/server/consultas/patrocinadores";
import { obtenerDb } from "@/lib/server/db";
import { guardarImagenOpcional } from "@/lib/server/imagen";

/** Catálogo único: patrocinadores de web y logos de cartel en la misma lista (6D). */
export async function cargarPatrocinadores(): Promise<PatrocinadorDto[]> {
  return listarCatalogoPatrocinadores();
}

/** Los que se pintan en la barra del cartel, en su orden. */
export async function cargarLogosDeCartel(): Promise<PatrocinadorDto[]> {
  return listarPatrocinadores(true);
}

/**
 * El registro que ya usa ese nombre, si lo hay. Sirve para avisar antes de guardar en vez de
 * pisar una ficha existente, que es lo que hacía la subida desde Carteles hasta la 6D.
 * `excluirId` es el registro que se está editando: no choca consigo mismo.
 */
export async function buscarCoincidenciaPatrocinador(
  nombre: string,
  excluirId?: string,
): Promise<Resultado<PatrocinadorDto | null>> {
  const clave = claveNombre(nombre);
  if (!clave) return exito(null);
  return capturar("No se pudo comprobar si el nombre ya existe.", async () => {
    const catalogo = await listarCatalogoPatrocinadores();
    const { db } = await obtenerDb();
    const [fila] = await db
      .select({ id: schema.patrocinadores.id })
      .from(schema.patrocinadores)
      .where(eq(schema.patrocinadores.clave, clave));
    if (!fila || fila.id === excluirId) return null;
    return catalogo.find((p) => p.id === fila.id) ?? null;
  });
}

export async function guardarPatrocinador(
  formulario: FormData,
): Promise<Resultado<PatrocinadorDto>> {
  const id = String(formulario.get("id") ?? "").trim();
  const nombre = String(formulario.get("nombre") ?? "").trim();
  if (!nombre) return fallo("El nombre es obligatorio.", { nombre: "Obligatorio" });
  const webUrl = String(formulario.get("webUrl") ?? "").trim() || null;
  if (webUrl && !esWebValida(webUrl)) {
    return fallo("La dirección web debe empezar por http:// o https://", {
      webUrl: "No válida",
    });
  }
  const clave = claveNombre(nombre);
  // Si el formulario no lo dice: al crear, fuera de carteles; al editar, como estaba.
  const pedido = formulario.get("enCarteles");
  const enCarteles = pedido === null ? null : String(pedido) === "true";

  const { db } = await obtenerDb();
  const [chocante] = await db
    .select({ id: schema.patrocinadores.id })
    .from(schema.patrocinadores)
    .where(eq(schema.patrocinadores.clave, clave));
  if (chocante && chocante.id !== id) {
    return fallo("Ya existe un patrocinador con ese nombre.", { nombre: "Repetido" });
  }

  const imagen = await guardarImagenOpcional(formulario, "logo", "sponsors");
  if (!imagen.ok) return imagen;

  return capturar("No se pudo guardar el patrocinador.", async () => {
    const columnas = {
      id: schema.patrocinadores.id,
      nombre: schema.patrocinadores.nombre,
      logo: schema.patrocinadores.logo,
      webUrl: schema.patrocinadores.webUrl,
      orden: schema.patrocinadores.orden,
      enCarteles: schema.patrocinadores.enCarteles,
    };
    const fila = await db.transaction(async (tx) => {
      const [actual] = id
        ? await tx
            .select({ enCarteles: schema.patrocinadores.enCarteles })
            .from(schema.patrocinadores)
            .where(eq(schema.patrocinadores.id, id))
        : [];
      if (id && !actual) throw new Error("El patrocinador no existe");
      const activo = enCarteles ?? actual?.enCarteles ?? false;
      // Quien entra en la barra lo hace al final; quien sale no arrastra su posición.
      const orden = activo ? await siguienteOrden(tx) : 0;

      const valores = {
        nombre,
        clave,
        webUrl,
        enCarteles: activo,
        ...(imagen.datos ? { logo: imagen.datos } : {}),
      };
      const [guardada] = id
        ? await tx
            .update(schema.patrocinadores)
            .set(actual?.enCarteles === activo ? valores : { ...valores, orden })
            .where(eq(schema.patrocinadores.id, id))
            .returning(columnas)
        : await tx
            .insert(schema.patrocinadores)
            .values({ ...valores, orden })
            .returning(columnas);
      if (!guardada) throw new Error("La operación no devolvió ninguna fila");
      await renumerar(tx);
      const [releida] = await tx
        .select(columnas)
        .from(schema.patrocinadores)
        .where(eq(schema.patrocinadores.id, guardada.id));
      return releida ?? guardada;
    });
    return {
      id: fila.id,
      nombre: fila.nombre,
      logo_url: fila.logo ? urlMedia(fila.logo) : null,
      web_url: fila.webUrl,
      orden: fila.orden,
      en_carteles: fila.enCarteles,
    };
  });
}

export async function borrarPatrocinador(id: string): Promise<Resultado<null>> {
  const { db } = await obtenerDb();
  const resultado = await capturar("No se pudo borrar el patrocinador.", async () => {
    await db.delete(schema.patrocinadores).where(eq(schema.patrocinadores.id, id));
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}

type Tx = Parameters<Parameters<Awaited<ReturnType<typeof obtenerDb>>["db"]["transaction"]>[0]>[0];

/** Posición siguiente en la barra del cartel. */
async function siguienteOrden(tx: Tx): Promise<number> {
  const enBarra = await tx
    .select({ id: schema.patrocinadores.id })
    .from(schema.patrocinadores)
    .where(eq(schema.patrocinadores.enCarteles, true));
  return enBarra.length;
}

/**
 * Deja las posiciones de la barra en 0..n-1, en el orden actual. Sin esto, dos logos con el
 * mismo `orden` nunca se podrían separar intercambiando vecinos.
 */
async function renumerar(tx: Tx): Promise<void> {
  const enBarra = await tx
    .select({ id: schema.patrocinadores.id })
    .from(schema.patrocinadores)
    .where(eq(schema.patrocinadores.enCarteles, true))
    .orderBy(
      asc(schema.patrocinadores.orden),
      asc(schema.patrocinadores.nombre),
      asc(schema.patrocinadores.id),
    );
  for (const [posicion, fila] of enBarra.entries()) {
    await tx
      .update(schema.patrocinadores)
      .set({ orden: posicion })
      .where(eq(schema.patrocinadores.id, fila.id));
  }
}

/** Sube (-1) o baja (1) un logo dentro de la barra del cartel. En los extremos no hace nada. */
export async function moverPatrocinador(id: string, direccion: -1 | 1): Promise<Resultado<null>> {
  // La dirección llega de fuera: TypeScript no la valida en tiempo de ejecución.
  if (direccion !== -1 && direccion !== 1) return fallo("Dirección de movimiento no válida.");

  const { db } = await obtenerDb();
  const resultado = await capturar("No se pudo cambiar el orden.", async () =>
    db.transaction(async (tx) => {
      await renumerar(tx);
      const enBarra = await tx
        .select({ id: schema.patrocinadores.id })
        .from(schema.patrocinadores)
        .where(eq(schema.patrocinadores.enCarteles, true))
        .orderBy(asc(schema.patrocinadores.orden));
      const desde = enBarra.findIndex((fila) => fila.id === id);
      if (desde === -1) throw new Error("Ese logo no está en la barra del cartel");

      const hasta = desde + direccion;
      if (hasta < 0 || hasta >= enBarra.length) return null;
      const movidos = [...enBarra];
      [movidos[desde], movidos[hasta]] = [movidos[hasta]!, movidos[desde]!];
      for (const [posicion, fila] of movidos.entries()) {
        await tx
          .update(schema.patrocinadores)
          .set({ orden: posicion })
          .where(eq(schema.patrocinadores.id, fila!.id));
      }
      return null;
    }),
  );
  return resultado.ok ? exito(null) : resultado;
}
