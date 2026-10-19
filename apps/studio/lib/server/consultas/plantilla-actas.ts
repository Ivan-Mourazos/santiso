import "server-only";

import { schema } from "@santiso/db";
import { claveNombre, type Categoria } from "@santiso/domain";
import { and, eq } from "drizzle-orm";
import { jugadorSeguro, type JugadorPlantilla } from "@/lib/actas/enlazar";
import { personaDeActa } from "@/lib/liga/eventos";
import { obtenerDb } from "@/lib/server/db";

/** Un jugador que sale en las actas del club esta temporada y no está en la plantilla. */
export interface JugadorDeActaSinPlantilla {
  /** Como lo escribe la federación: «APELLIDOS, NOMBRE». */
  nombre: string;
  /** Su código en la federación. */
  codigo: string;
  /** Dorsales con los que salió, del más usado al menos. */
  dorsales: number[];
  /** Partidos en los que sale en la alineación (titular o suplente). */
  partidos: number;
  /** De ellos, de titular. */
  titular: number;
  /** El último de esos partidos (`partidos.fecha`); `null` si aún no hay alineaciones. */
  ultimaFecha: string | null;
}

/** Un jugador de la plantilla que no aparece en ninguna acta del club esta temporada. */
export interface JugadorDePlantillaSinActas {
  jugadorId: string;
  nombre: string;
  dorsal: number | null;
}

export interface PlantillaFrenteActas {
  enActasSinPlantilla: JugadorDeActaSinPlantilla[];
  enPlantillaSinActas: JugadorDePlantillaSinActas[];
}

/** La temporada activa, o `null`. */
export async function temporadaActiva() {
  const { db } = await obtenerDb();
  const [temporada] = await db
    .select({ id: schema.temporadas.id, nombre: schema.temporadas.nombre })
    .from(schema.temporadas)
    .where(eq(schema.temporadas.activa, true));
  return temporada ?? null;
}

/** Los jugadores con código de la federación en las competiciones activas de una categoría. */
export async function jugadoresRfgfDeCategoria(categoria: Categoria) {
  const { db } = await obtenerDb();
  return db
    .select({
      codigo: schema.rfgfJugadores.codigo,
      competicionId: schema.rfgfJugadores.competicionId,
      nombre: schema.rfgfJugadores.nombre,
      jugadorId: schema.rfgfJugadores.jugadorId,
    })
    .from(schema.rfgfJugadores)
    .innerJoin(
      schema.competiciones,
      eq(schema.competiciones.id, schema.rfgfJugadores.competicionId),
    )
    .innerJoin(schema.temporadas, eq(schema.temporadas.id, schema.competiciones.temporadaId))
    .where(and(eq(schema.temporadas.activa, true), eq(schema.competiciones.categoria, categoria)));
}

/** Las alineaciones del club en la temporada activa de una categoría, persona a persona. */
export async function alineacionesPropias(categoria: Categoria) {
  const { db } = await obtenerDb();
  return db
    .select({
      partidoId: schema.ligaAlineaciones.partidoId,
      persona: schema.ligaAlineaciones.persona,
      personaClave: schema.ligaAlineaciones.personaClave,
      dorsal: schema.ligaAlineaciones.dorsal,
      titular: schema.ligaAlineaciones.titular,
      fecha: schema.partidos.fecha,
    })
    .from(schema.ligaAlineaciones)
    .innerJoin(schema.equipos, eq(schema.equipos.id, schema.ligaAlineaciones.equipoId))
    .innerJoin(schema.partidos, eq(schema.partidos.id, schema.ligaAlineaciones.partidoId))
    .innerJoin(schema.jornadas, eq(schema.jornadas.id, schema.partidos.jornadaId))
    .innerJoin(schema.competiciones, eq(schema.competiciones.id, schema.jornadas.competicionId))
    .innerJoin(schema.temporadas, eq(schema.temporadas.id, schema.competiciones.temporadaId))
    .where(
      and(
        eq(schema.temporadas.activa, true),
        eq(schema.competiciones.categoria, categoria),
        eq(schema.equipos.esPropio, true),
      ),
    );
}

/** Los dorsales de una lista, del más repetido al menos (a igualdad, el menor). */
export function dorsalesPorUso(dorsales: readonly (number | null)[]): number[] {
  const cuenta = new Map<number, number>();
  for (const d of dorsales) if (d !== null) cuenta.set(d, (cuenta.get(d) ?? 0) + 1);
  return [...cuenta].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([d]) => d);
}

/** «APELLIDOS, NOMBRE» → la clave con la que se guarda en las alineaciones. */
export const claveDeFederacion = (nombre: string) => claveNombre(personaDeActa(nombre));

/**
 * La plantilla de la temporada activa frente a lo que dicen las actas de la federación: quién
 * juega con el club y no está dado de alta, y quién está dado de alta y no sale en ningún acta.
 * Los nombres se reconocen con las mismas reglas que al guardar actas (`jugadorSeguro`). Solo lee.
 */
export async function plantillaFrenteActas(categoria: Categoria): Promise<PlantillaFrenteActas> {
  const { db } = await obtenerDb();
  const temporada = await temporadaActiva();
  if (!temporada) return { enActasSinPlantilla: [], enPlantillaSinActas: [] };

  const inscritos = await db
    .select({
      id: schema.jugadores.id,
      nombre: schema.jugadores.nombre,
      apodo: schema.jugadores.apodo,
      dorsal: schema.jugadoresTemporada.dorsal,
    })
    .from(schema.jugadoresTemporada)
    .innerJoin(schema.jugadores, eq(schema.jugadores.id, schema.jugadoresTemporada.jugadorId))
    .where(
      and(
        eq(schema.jugadoresTemporada.temporadaId, temporada.id),
        eq(schema.jugadoresTemporada.categoria, categoria),
      ),
    );
  const plantilla: JugadorPlantilla[] = inscritos;
  const enPlantilla = new Set(inscritos.map((j) => j.id));
  const federacion = await jugadoresRfgfDeCategoria(categoria);
  const alineaciones = await alineacionesPropias(categoria);

  // Quién de la plantilla sale en algún acta: por su código, por su nombre o porque ya tiene
  // el acta guardada en el Studio.
  const vistos = new Set<string>();
  const reconocer = (nombre: string) => jugadorSeguro(nombre, plantilla)?.id ?? null;
  const porCodigo = new Map<string, { nombre: string; jugadorId: string | null }>();
  for (const fila of federacion) {
    const ya = porCodigo.get(fila.codigo);
    const enlazado =
      (fila.jugadorId && enPlantilla.has(fila.jugadorId) ? fila.jugadorId : null) ??
      ya?.jugadorId ??
      reconocer(fila.nombre);
    porCodigo.set(fila.codigo, { nombre: fila.nombre, jugadorId: enlazado });
    if (enlazado) vistos.add(enlazado);
  }
  for (const fila of alineaciones) {
    const id = reconocer(fila.persona);
    if (id) vistos.add(id);
  }
  const participaciones = await db
    .selectDistinct({ jugadorId: schema.partidoParticipaciones.jugadorId })
    .from(schema.partidoParticipaciones)
    .innerJoin(schema.partidos, eq(schema.partidos.id, schema.partidoParticipaciones.partidoId))
    .innerJoin(schema.jornadas, eq(schema.jornadas.id, schema.partidos.jornadaId))
    .innerJoin(schema.competiciones, eq(schema.competiciones.id, schema.jornadas.competicionId))
    .where(
      and(
        eq(schema.competiciones.temporadaId, temporada.id),
        eq(schema.competiciones.categoria, categoria),
      ),
    );
  for (const p of participaciones) vistos.add(p.jugadorId);

  const enActasSinPlantilla = [...porCodigo]
    .filter(([, f]) => !f.jugadorId)
    .map(([codigo, f]) => {
      const clave = claveDeFederacion(f.nombre);
      const suyas = alineaciones.filter((a) => a.personaClave === clave);
      const partidos = new Set(suyas.map((a) => a.partidoId));
      return {
        nombre: f.nombre,
        codigo,
        dorsales: dorsalesPorUso(suyas.map((a) => a.dorsal)),
        partidos: partidos.size,
        titular: new Set(suyas.filter((a) => a.titular).map((a) => a.partidoId)).size,
        ultimaFecha:
          suyas
            .map((a) => a.fecha)
            .filter((f): f is string => Boolean(f))
            .sort()
            .at(-1) ?? null,
      };
    })
    .sort((a, b) => b.partidos - a.partidos || a.nombre.localeCompare(b.nombre, "es"));

  const enPlantillaSinActas = inscritos
    .filter((j) => !vistos.has(j.id))
    .map((j) => ({ jugadorId: j.id, nombre: j.nombre, dorsal: j.dorsal }))
    .sort(
      (a, b) => (a.dorsal ?? 999) - (b.dorsal ?? 999) || a.nombre.localeCompare(b.nombre, "es"),
    );

  return { enActasSinPlantilla, enPlantillaSinActas };
}
