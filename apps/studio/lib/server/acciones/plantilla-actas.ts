"use server";

import { schema } from "@santiso/db";
import { claveNombre, normalizarCategoria, type Categoria } from "@santiso/domain";
import { and, eq, inArray } from "drizzle-orm";
import { personaDeActa } from "@/lib/liga/eventos";
import { capturar, fallo, type Resultado } from "@/lib/resultado";
import { soloAdmin } from "@/lib/server/acceso/permisos";
import {
  alineacionesPropias,
  claveDeFederacion,
  dorsalesPorUso,
  jugadoresRfgfDeCategoria,
  plantillaFrenteActas,
  temporadaActiva,
  type PlantillaFrenteActas,
} from "@/lib/server/consultas/plantilla-actas";
import { obtenerDb } from "@/lib/server/db";

const categoriaDe = (valor: string): Categoria | null => {
  try {
    return normalizarCategoria(valor);
  } catch {
    return null;
  }
};

/** Lectura local: obtenerDb comprueba la sesión, sin exigir rol de administrador. */
export async function cargarPlantillaFrenteActas(
  categoria: string,
): Promise<Resultado<PlantillaFrenteActas>> {
  const valida = categoriaDe(categoria);
  if (!valida) return fallo("Categoría desconocida.");
  return capturar("No se pudo comparar la plantilla con las actas.", () =>
    plantillaFrenteActas(valida),
  );
}

export interface JugadorAnadidoDesdeActa {
  jugadorId: string;
  /** «Nombre Apellidos», con las reglas de nombres de persona. */
  nombre: string;
  /** El dorsal con el que más veces salió; `null` si aún no hay alineaciones. */
  dorsal: number | null;
  /** Ya existía (de otra temporada) y solo se inscribió en esta. */
  existia: boolean;
}

/**
 * Da de alta en la plantilla de la temporada activa a un jugador que sale en las actas de la
 * federación y no estaba: nombre de la federación puesto en orden («Nombre Apellidos»), el
 * dorsal que más ha llevado y su código enlazado. Si la persona ya existe de otra temporada
 * (mismo nombre), se reutiliza en vez de duplicarla.
 */
export async function anadirJugadorDesdeActa(
  categoria: string,
  codigo: string,
): Promise<Resultado<JugadorAnadidoDesdeActa>> {
  const sinPermiso = await soloAdmin();
  if (sinPermiso) return sinPermiso;
  const valida = categoriaDe(categoria);
  if (!valida) return fallo("Categoría desconocida.");
  const temporada = await temporadaActiva();
  if (!temporada) return fallo("No hay temporada activa.");
  const filas = (await jugadoresRfgfDeCategoria(valida)).filter((f) => f.codigo === codigo);
  const [fila] = filas;
  if (!fila) return fallo("Ese jugador no sale en las actas de esta temporada.");
  const { enActasSinPlantilla } = await plantillaFrenteActas(valida);
  if (!enActasSinPlantilla.some((j) => j.codigo === codigo))
    return fallo("Ese jugador ya está en la plantilla.");

  const nombre = personaDeActa(fila.nombre);
  if (!claveNombre(nombre)) return fallo("La federación no da un nombre utilizable.");
  const clave = claveDeFederacion(fila.nombre);
  const [dorsal = null] = dorsalesPorUso(
    (await alineacionesPropias(valida))
      .filter((a) => a.personaClave === clave)
      .map((a) => a.dorsal),
  );

  return capturar("No se pudo dar de alta al jugador.", async () => {
    const { db } = await obtenerDb();
    const personas = await db
      .select({ id: schema.jugadores.id, nombre: schema.jugadores.nombre })
      .from(schema.jugadores);
    const existente = personas.find((p) => claveNombre(p.nombre) === claveNombre(nombre));
    const jugadorId = await db.transaction(async (tx) => {
      let id = existente?.id;
      if (!id) {
        const [creado] = await tx
          .insert(schema.jugadores)
          .values({ nombre })
          .returning({ id: schema.jugadores.id });
        if (!creado) throw new Error("La operación no devolvió ninguna fila");
        id = creado.id;
      }
      await tx
        .insert(schema.jugadoresTemporada)
        .values({ temporadaId: temporada.id, jugadorId: id, categoria: valida, dorsal })
        .onConflictDoNothing();
      await tx
        .update(schema.rfgfJugadores)
        .set({ jugadorId: id })
        .where(
          and(
            eq(schema.rfgfJugadores.codigo, codigo),
            inArray(
              schema.rfgfJugadores.competicionId,
              filas.map((f) => f.competicionId),
            ),
          ),
        );
      return id;
    });
    return {
      jugadorId,
      nombre: existente?.nombre ?? nombre,
      dorsal,
      existia: Boolean(existente),
    };
  });
}
