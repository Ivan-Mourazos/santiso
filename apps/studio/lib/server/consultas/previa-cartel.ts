import "server-only";
import { schema as s } from "@santiso/db";
import { calcularClasificacion } from "@santiso/domain";
import { and, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { FormaEquipo } from "@/lib/cartel2/modelo";
import type { PreviaCartel } from "@/lib/cartel2/previa";
import { obtenerDb } from "@/lib/server/db";

/** Solo lectura: liga y racha antes del encuentro, dentro de su propia competición. */
export async function previasCartel(ids: string[]): Promise<Record<string, PreviaCartel>> {
  if (!ids.length) return {};
  const { db } = await obtenerDb();
  const local = alias(s.equipos, "previa_local");
  const visitante = alias(s.equipos, "previa_visitante");
  const elegidos = await db
    .select({
      id: s.partidos.id,
      fecha: s.partidos.fecha,
      localId: s.partidos.equipoLocalId,
      visitanteId: s.partidos.equipoVisitanteId,
      localPropio: local.esPropio,
      visitantePropio: visitante.esPropio,
      localNombre: local.nombre,
      visitanteNombre: visitante.nombre,
      localidad: s.campos.poblacion,
      competicionId: s.competiciones.id,
      formato: s.competiciones.formato,
      categoria: s.competiciones.categoria,
    })
    .from(s.partidos)
    .innerJoin(s.jornadas, eq(s.jornadas.id, s.partidos.jornadaId))
    .innerJoin(s.competiciones, eq(s.competiciones.id, s.jornadas.competicionId))
    .innerJoin(local, eq(local.id, s.partidos.equipoLocalId))
    .innerJoin(visitante, eq(visitante.id, s.partidos.equipoVisitanteId))
    .leftJoin(s.campos, eq(s.campos.id, s.partidos.campoId))
    .where(inArray(s.partidos.id, ids));
  const salida: Record<string, PreviaCartel> = {};
  for (const p of elegidos) {
    if (!p.localPropio && !p.visitantePropio) continue;
    const anteriores = (
      await db
        .select({
          id: s.partidos.id,
          fecha: s.partidos.fecha,
          numero: s.jornadas.numero,
          equipoLocalId: s.partidos.equipoLocalId,
          equipoVisitanteId: s.partidos.equipoVisitanteId,
          golesLocal: s.partidos.golesLocal,
          golesVisitante: s.partidos.golesVisitante,
          estado: s.partidos.estado,
        })
        .from(s.partidos)
        .innerJoin(s.jornadas, eq(s.jornadas.id, s.partidos.jornadaId))
        .where(
          and(eq(s.jornadas.competicionId, p.competicionId), eq(s.partidos.estado, "finalizado")),
        )
    )
      .filter(
        (a) =>
          a.id !== p.id &&
          a.golesLocal !== null &&
          a.golesVisitante !== null &&
          (!p.fecha || (a.fecha !== null && a.fecha < p.fecha)),
      )
      .sort(
        (a, b) =>
          (a.fecha ?? "").localeCompare(b.fecha ?? "") ||
          a.numero - b.numero ||
          a.id.localeCompare(b.id),
      );
    const inscritos = await db
      .select({ id: s.competicionEquipos.equipoId })
      .from(s.competicionEquipos)
      .where(eq(s.competicionEquipos.competicionId, p.competicionId));
    const tabla =
      p.formato === "liga" && anteriores.length
        ? calcularClasificacion(
            inscritos.map((e) => e.id),
            anteriores,
          )
        : [];
    const forma = (equipoId: string): FormaEquipo => {
      const indice = tabla.findIndex((f) => f.equipoId === equipoId);
      return {
        posicion: indice < 0 ? null : indice + 1,
        racha: anteriores
          .filter((a) => a.equipoLocalId === equipoId || a.equipoVisitanteId === equipoId)
          .slice(-5)
          .map((a) => {
            const casa = a.equipoLocalId === equipoId;
            const favor = casa ? a.golesLocal! : a.golesVisitante!;
            const contra = casa ? a.golesVisitante! : a.golesLocal!;
            return favor > contra ? "V" : favor === contra ? "E" : "D";
          }),
      };
    };
    salida[p.id] = {
      categoria: p.categoria,
      rivalNombre: p.localPropio ? p.visitanteNombre : p.localNombre,
      localidad: p.localidad ?? "",
      club: forma(p.localPropio ? p.localId : p.visitanteId),
      rival: forma(p.localPropio ? p.visitanteId : p.localId),
    };
  }
  return salida;
}
