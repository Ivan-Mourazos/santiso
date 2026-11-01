import "server-only";
import { ClasificacionVacia, parsearCalendarioWeb, parsearClasificacionPdf } from "@santiso/actas";
import { schema as s } from "@santiso/db";
import { esEquipoPropio, normalizarNombreEquipo } from "@santiso/domain";
import { asc, desc, eq } from "drizzle-orm";
import { urlCalendarioWeb, urlClasificacionPdf } from "@/lib/rfgf/enlace";
import { obtenerDb } from "@/lib/server/db";
import { enlaceGrupo } from "./historico-partidos";
import type { DescargadorRfgf } from "./descargador";

const tabla = s.rfgfHistoricoClasificaciones;
const mensaje = (e: unknown) => (e instanceof Error ? e.message : "No se pudo leer la federación.");

/** Bajo el candado compartido. Sin repetir fallos de red dentro del mismo tic. */
export async function avanzarClasificacionesSinCandado(
  d: DescargadorRfgf,
  ahora: Date,
  maximo: number,
): Promise<number> {
  const { db } = await obtenerDb();
  const grupos = await db
    .select()
    .from(s.rfgfGruposHistoricos)
    .orderBy(desc(s.rfgfGruposHistoricos.temporada), asc(s.rfgfGruposHistoricos.codGrupo));
  let paginas = 0;
  for (const g of grupos) {
    await db.insert(tabla).values({ codGrupo: g.codGrupo }).onConflictDoNothing();
    let [estado] = await db.select().from(tabla).where(eq(tabla.codGrupo, g.codGrupo));
    if (estado!.estado !== "pendiente" || paginas >= maximo) continue;
    const filtro = eq(tabla.codGrupo, g.codGrupo);
    const actualizar = async (valores: Partial<typeof tabla.$inferInsert>) => {
      await db
        .update(tabla)
        .set({ ...valores, actualizadoEn: ahora.toISOString() })
        .where(filtro);
    };
    const red = async (error: unknown) =>
      actualizar({
        intentos: estado!.intentos + 1,
        estado: estado!.intentos + 1 >= 3 ? "error" : "pendiente",
        aviso: mensaje(error),
      });
    let enlace: ReturnType<typeof enlaceGrupo>;
    try {
      enlace = enlaceGrupo(g);
    } catch (e) {
      await actualizar({ estado: "sin_datos", aviso: mensaje(e) });
      continue;
    }
    if (!estado!.formato) {
      paginas++;
      let html: string;
      try {
        html = await d.html(urlCalendarioWeb(enlace));
      } catch (e) {
        await red(e);
        continue;
      }
      try {
        const calendario = parsearCalendarioWeb(html);
        if (calendario.temporada !== g.temporada)
          throw Error("El calendario corresponde a otra temporada.");
        if (calendario.jornadas.some((j) => j.fase)) {
          const ultima = calendario.jornadas
            .filter((j) =>
              j.partidos.some(
                (p) => esEquipoPropio(p.local.nombre) || esEquipoPropio(p.visitante.nombre),
              ),
            )
            .at(-1);
          await actualizar({
            formato: "copa",
            // Una eliminatoria a doble partido es la misma ronda: «Final», no «Final vuelta».
            ronda: ultima?.fase?.replace(/\s+(?:ida|vuelta)$/iu, "") ?? null,
            jornada: ultima?.numero ?? null,
            estado: ultima?.fase ? "leido" : "sin_datos",
            intentos: 0,
            aviso: ultima?.fase ? "" : "El Santiso no aparece en las rondas publicadas.",
          });
          continue;
        }
        const ultima = Math.max(...calendario.jornadas.map((j) => j.numero));
        if (!Number.isFinite(ultima) || ultima < 1) throw Error("El calendario no trae jornadas.");
        await actualizar({ formato: "liga", jornada: ultima, intentos: 0, aviso: "" });
        [estado] = await db.select().from(tabla).where(filtro);
      } catch (e) {
        await actualizar({ estado: "sin_datos", aviso: mensaje(e) });
        continue;
      }
    }
    if (paginas >= maximo) continue;
    // Una sola clasificación por grupo en cada tic, también cuando está vacía.
    paginas++;
    let bytes: Uint8Array;
    try {
      bytes = await d.pdf(urlClasificacionPdf(enlace, estado!.jornada!));
    } catch (e) {
      if (mensaje(e) === "La federación no devolvió un PDF.")
        await actualizar({ estado: "sin_datos", aviso: mensaje(e) });
      else await red(e);
      continue;
    }
    try {
      const clasificacion = await parsearClasificacionPdf(bytes);
      if (!clasificacion.filas.length)
        throw new ClasificacionVacia("La clasificación no trae equipos.");
      // Una temporada cortada se queda en una jornada anterior a la pedida: esa es su tabla final.
      const filas = clasificacion.filas.map((f) => ({
        ...f,
        equipo: normalizarNombreEquipo(f.equipo, g.categoria),
      }));
      await actualizar({
        filas,
        jornada: clasificacion.jornada,
        estado: filas.some((f) => esEquipoPropio(f.equipo)) ? "leido" : "sin_datos",
        intentos: 0,
        aviso: filas.some((f) => esEquipoPropio(f.equipo))
          ? ""
          : "El Santiso no aparece en la clasificación.",
      });
    } catch (e) {
      if (e instanceof ClasificacionVacia) {
        const vacias = estado!.vacias + 1;
        const final = vacias >= 3 || estado!.jornada! <= 1;
        await actualizar({
          vacias,
          intentos: 0,
          jornada: final ? estado!.jornada : estado!.jornada! - 1,
          estado: final ? "sin_datos" : "pendiente",
          aviso: final
            ? "No hay clasificación publicada en las últimas jornadas."
            : "Clasificación vacía; se buscará la jornada anterior.",
        });
      } else await actualizar({ estado: "sin_datos", aviso: mensaje(e) });
    }
  }
  return paginas;
}
