"use server";
import { schema } from "@santiso/db";
import { normalizarCategoria } from "@santiso/domain";
import { and, eq, inArray } from "drizzle-orm";
import {
  errorDeConvocatoria,
  type Convocatoria,
  type PantallaConvocatoria,
} from "@/lib/convocatoria/modelo";
import { hoyLocal } from "@/lib/jornada/semana";
import { capturar, exito, fallo, type Resultado } from "@/lib/resultado";
import {
  pantallaConvocatoria,
  tablasConvocatoriaDisponibles,
} from "@/lib/server/consultas/convocatoria";
import { obtenerDb } from "@/lib/server/db";

export async function cargarPantallaConvocatoria(
  categoria: string,
  partidoId?: string | null,
): Promise<Resultado<PantallaConvocatoria>> {
  return capturar("No se pudo cargar la convocatoria.", () =>
    pantallaConvocatoria(categoria, hoyLocal(), partidoId || null),
  );
}
export async function guardarConvocatoria(
  partidoId: string,
  c: Convocatoria,
): Promise<Resultado<null>> {
  const error = errorDeConvocatoria(c);
  if (error) return fallo(error);
  const r = await capturar(
    "No se pudo guardar la convocatoria.",
    async (): Promise<Resultado<null>> => {
      if (!(await tablasConvocatoriaDisponibles()))
        return fallo("Migración de convocatorias pendiente de aplicar.");
      const { db } = await obtenerDb();
      const partido = await db
        .select({
          estado: schema.partidos.estado,
          temporada: schema.competiciones.temporadaId,
          categoria: schema.competiciones.categoria,
        })
        .from(schema.partidos)
        .innerJoin(schema.jornadas, eq(schema.jornadas.id, schema.partidos.jornadaId))
        .innerJoin(schema.competiciones, eq(schema.competiciones.id, schema.jornadas.competicionId))
        .where(eq(schema.partidos.id, partidoId))
        .get();
      if (!partido) return fallo("El partido ya no existe.");
      if (partido.estado === "finalizado")
        return fallo("El partido ya se jugó: su convocatoria no se cambia.");
      const inscritos = await db
        .select({ id: schema.jugadoresTemporada.jugadorId })
        .from(schema.jugadoresTemporada)
        .where(
          and(
            eq(schema.jugadoresTemporada.temporadaId, partido.temporada),
            eq(schema.jugadoresTemporada.categoria, normalizarCategoria(partido.categoria)),
            inArray(schema.jugadoresTemporada.jugadorId, c.jugadores),
          ),
        );
      if (inscritos.length !== c.jugadores.length)
        return fallo("Algún jugador no está inscrito en esta categoría y temporada.");
      await db.transaction(async (tx) => {
        const datos = {
          horaQuedada: c.horaQuedada,
          lugarQuedada: c.lugarQuedada.trim(),
          equipacion: c.equipacion.trim(),
          nota: c.nota.trim(),
        };
        await tx
          .insert(schema.partidoConvocatorias)
          .values({ partidoId, ...datos })
          .onConflictDoUpdate({
            target: schema.partidoConvocatorias.partidoId,
            set: { ...datos, actualizadoEn: new Date().toISOString() },
          });
        await tx
          .delete(schema.partidoConvocados)
          .where(eq(schema.partidoConvocados.partidoId, partidoId));
        await tx
          .insert(schema.partidoConvocados)
          .values(c.jugadores.map((jugadorId) => ({ partidoId, jugadorId })));
      });
      return exito(null);
    },
  );
  return r.ok ? r.datos : r;
}
