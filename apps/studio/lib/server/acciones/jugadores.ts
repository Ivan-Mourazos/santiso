"use server";

import { schema } from "@santiso/db";
import { esValorDe, normalizarCategoria, POSICIONES } from "@santiso/domain";
import { and, eq } from "drizzle-orm";
import type { JugadorDto } from "@/lib/dto";
import { capturar, exito, fallo, type Resultado } from "@/lib/resultado";
import {
  candidatosDeTemporadaAnterior,
  jugadoresParecidos,
  listarJugadores,
  type CandidatosJugador,
  type ParecidoJugador,
} from "@/lib/server/consultas/jugadores";
import { obtenerDb } from "@/lib/server/db";
import { guardarImagenOpcional } from "@/lib/server/imagen";
import { resolverTemporada } from "@/lib/server/temporada";

/** Plantilla de una temporada; sin `temporadaId`, la activa. */
export async function cargarJugadores(
  categoria: string,
  temporadaId?: string | null,
): Promise<JugadorDto[]> {
  return listarJugadores(categoria, temporadaId);
}

export async function cargarCandidatosJugadores(
  categoria: string,
  temporadaId?: string | null,
  soloMismaCategoria = true,
): Promise<CandidatosJugador> {
  return candidatosDeTemporadaAnterior(categoria, temporadaId, soloMismaCategoria);
}

export async function buscarJugadoresParecidos(nombre: string): Promise<ParecidoJugador[]> {
  return jugadoresParecidos(nombre);
}

/** Texto de un campo de formulario, ya recortado; `null` si viene vacío. */
const texto = (formulario: FormData, campo: string): string | null =>
  String(formulario.get(campo) ?? "").trim() || null;

/** El formulario manda "" cuando no hay dorsal; `Number("")` daría 0 y la columna es anulable. */
function leerDorsal(valor: string | null): { ok: true; dorsal: number | null } | { ok: false } {
  if (valor === null) return { ok: true, dorsal: null };
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= 0 ? { ok: true, dorsal: numero } : { ok: false };
}

/**
 * Alta o edición de un jugador **en una temporada** (la activa si no se indica otra).
 *
 * `id` vacío crea la persona; con `id`, se actualiza la persona y su inscripción de esa
 * temporada, que se crea si aún no existía. La edición reescribe la fila entera: la pantalla
 * reenvía todos los campos, también al cambiar solo la foto.
 */
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

  const dorsal = leerDorsal(texto(formulario, "dorsal"));
  if (!dorsal.ok) return fallo("El dorsal debe ser un número entero.", { dorsal: "No válido" });

  const posicionTexto = texto(formulario, "posicion");
  if (posicionTexto !== null && !esValorDe(POSICIONES, posicionTexto)) {
    return fallo("Posición desconocida.", { posicion: "No válida" });
  }
  const posicion = posicionTexto;

  const temporada = await resolverTemporada(texto(formulario, "temporadaId"));
  if (!temporada) return fallo("No hay temporada a la que inscribir al jugador. Crea una antes.");

  const historial = String(formulario.get("historial") ?? "")
    .split("\n")
    .map((linea) => linea.trim())
    .filter(Boolean);

  const imagen = await guardarImagenOpcional(formulario, "foto", "jugadores");
  if (!imagen.ok) return imagen;

  const { db } = await obtenerDb();
  const guardado = await capturar("No se pudo guardar el jugador.", async () =>
    db.transaction(async (tx) => {
      const persona = {
        nombre,
        apodo: texto(formulario, "apodo"),
        fechaNacimiento: texto(formulario, "fechaNacimiento"),
        historial,
      };
      let jugadorId = id;
      if (jugadorId) {
        const [actualizado] = await tx
          .update(schema.jugadores)
          .set(persona)
          .where(eq(schema.jugadores.id, jugadorId))
          .returning({ id: schema.jugadores.id });
        if (!actualizado) throw new Error("El jugador no existe");
      } else {
        const [creado] = await tx
          .insert(schema.jugadores)
          .values(persona)
          .returning({ id: schema.jugadores.id });
        if (!creado) throw new Error("La operación no devolvió ninguna fila");
        jugadorId = creado.id;
      }

      const inscripcion = {
        dorsal: dorsal.dorsal,
        posicion,
        ...(imagen.datos ? { foto: imagen.datos } : {}),
      };
      await tx
        .insert(schema.jugadoresTemporada)
        .values({ temporadaId: temporada.id, jugadorId, categoria, ...inscripcion })
        .onConflictDoUpdate({
          target: [
            schema.jugadoresTemporada.temporadaId,
            schema.jugadoresTemporada.categoria,
            schema.jugadoresTemporada.jugadorId,
          ],
          set: inscripcion,
        });
      return jugadorId;
    }),
  );
  if (!guardado.ok) return guardado;

  const [fila] = (await listarJugadores(categoria, temporada.id)).filter(
    (jugador) => jugador.id === guardado.datos,
  );
  return fila ? exito(fila) : fallo("El jugador se guardó pero no se pudo releer.");
}

/**
 * Trae a esta temporada a jugadores de otra, copiando su posición y su foto. El dorsal se
 * indica aparte porque es lo que más cambia de un año a otro; si no se indica, se copia.
 * Si alguno ya estaba inscrito, se deja como está.
 */
export async function incorporarJugadores(entrada: {
  temporadaId?: string | null;
  categoria: string;
  jugadores: { jugadorId: string; desdeInscripcionId: string; dorsal?: number | null }[];
}): Promise<Resultado<number>> {
  let categoria: ReturnType<typeof normalizarCategoria>;
  try {
    categoria = normalizarCategoria(entrada.categoria);
  } catch {
    return fallo("Categoría desconocida.");
  }
  const temporada = await resolverTemporada(entrada.temporadaId);
  if (!temporada) return fallo("No hay temporada de destino.");
  if (entrada.jugadores.length === 0) return exito(0);

  const { db } = await obtenerDb();
  return capturar("No se pudieron incorporar los jugadores.", async () =>
    db.transaction(async (tx) => {
      let incorporados = 0;
      for (const { jugadorId, desdeInscripcionId, dorsal } of entrada.jugadores) {
        const [origen] = await tx
          .select()
          .from(schema.jugadoresTemporada)
          .where(
            and(
              eq(schema.jugadoresTemporada.id, desdeInscripcionId),
              eq(schema.jugadoresTemporada.jugadorId, jugadorId),
            ),
          );
        if (!origen) throw new Error("La inscripción de origen no existe");
        const insertados = await tx
          .insert(schema.jugadoresTemporada)
          .values({
            temporadaId: temporada.id,
            jugadorId,
            categoria,
            dorsal: dorsal === undefined ? origen.dorsal : dorsal,
            posicion: origen.posicion,
            foto: origen.foto,
            // La capitanía no se hereda: es una decisión de cada temporada.
          })
          .onConflictDoNothing()
          .returning({ id: schema.jugadoresTemporada.id });
        incorporados += insertados.length;
      }
      return incorporados;
    }),
  );
}

/**
 * Saca a un jugador de una temporada. **No borra a la persona**: sus partidos y sus otras
 * temporadas siguen. Solo si se queda sin ninguna inscripción y sin haber jugado nunca —es
 * decir, era un alta por error— se borra también.
 */
export async function quitarJugadorDeTemporada(inscripcionId: string): Promise<Resultado<null>> {
  const { db } = await obtenerDb();
  const resultado = await capturar("No se pudo quitar al jugador de la temporada.", async () =>
    db.transaction(async (tx) => {
      const [inscripcion] = await tx
        .delete(schema.jugadoresTemporada)
        .where(eq(schema.jugadoresTemporada.id, inscripcionId))
        .returning({ jugadorId: schema.jugadoresTemporada.jugadorId });
      if (!inscripcion) return null;

      const [otraInscripcion] = await tx
        .select({ id: schema.jugadoresTemporada.id })
        .from(schema.jugadoresTemporada)
        .where(eq(schema.jugadoresTemporada.jugadorId, inscripcion.jugadorId))
        .limit(1);
      const [convocatoria] = await tx
        .select({ id: schema.partidoParticipaciones.jugadorId })
        .from(schema.partidoParticipaciones)
        .where(eq(schema.partidoParticipaciones.jugadorId, inscripcion.jugadorId))
        .limit(1);
      const [evento] = await tx
        .select({ id: schema.partidoEventos.id })
        .from(schema.partidoEventos)
        .where(eq(schema.partidoEventos.jugadorId, inscripcion.jugadorId))
        .limit(1);
      const [cambio] = await tx
        .select({ id: schema.partidoEventos.id })
        .from(schema.partidoEventos)
        .where(eq(schema.partidoEventos.jugadorSaleId, inscripcion.jugadorId))
        .limit(1);
      if (!otraInscripcion && !convocatoria && !evento && !cambio) {
        await tx.delete(schema.jugadores).where(eq(schema.jugadores.id, inscripcion.jugadorId));
      }
      return null;
    }),
  );
  return resultado.ok ? exito(null) : resultado;
}
