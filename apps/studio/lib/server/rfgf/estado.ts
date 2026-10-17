import "server-only";

import { schema } from "@santiso/db";
import { asc, eq } from "drizzle-orm";
import type { ComparacionClasificacion } from "@/lib/rfgf/clasificacion";
import {
  jornadasPendientes,
  jornadasSinEventos,
  leFaltaAlgo,
  partidoDeActa,
} from "@/lib/rfgf/plan";
import { listarJugadores } from "@/lib/server/consultas/jugadores";
import { obtenerDb } from "@/lib/server/db";
import { horaLocal, partidosDeCompeticion } from "./sincronizar";

export interface PartidoFederacion {
  id: string;
  local: string;
  visitante: string;
  marcador: [number, number] | null;
  fecha: string | null;
  propio: boolean;
  acta: {
    codActa: string | null;
    estado: (typeof schema.ESTADOS_ACTA_RFGF)[number] | "sin_acta";
    detalle: string;
    aviso: string;
  };
}

export interface JornadaFederacion {
  numero: number;
  fecha: string | null;
  estado: "completa" | "incompleta" | "por_jugar";
  partidos: number;
  conResultado: number;
  conActaTratada: number;
  /** Jugados a los que falta resultado, acta del club o tratamiento de eventos. */
  pendientes: number;
  encuentros: PartidoFederacion[];
}

export interface EstadoFederacion {
  competicion: {
    id: string;
    nombre: string;
    categoria: string;
    enlace: string;
    comprobadoEn: string | null;
    horariosEn: string | null;
    resumen: string;
    /** Última comparación guardada; no se descarga ni se recalcula al consultar. */
    clasificacion: ComparacionClasificacion | null;
  };
  jornadas: JornadaFederacion[];
  jugadores: {
    plantilla: number;
    conCifras: number;
    lecturaMasAntigua: string | null;
    lecturaMasReciente: string | null;
  };
}

/** Solo consulta datos locales. `null` si la competición no existe; no necesita estar enlazada. */
export async function estadoFederacion(
  competicionId: string,
  ahora = new Date(),
): Promise<EstadoFederacion | null> {
  const { db } = await obtenerDb();
  const [fila] = await db
    .select({
      id: schema.competiciones.id,
      nombre: schema.competiciones.nombre,
      categoria: schema.competiciones.categoria,
      temporadaId: schema.competiciones.temporadaId,
      enlace: schema.rfgfCompeticiones.enlace,
      comprobadoEn: schema.rfgfCompeticiones.comprobadoEn,
      horariosEn: schema.rfgfCompeticiones.horariosEn,
      resumen: schema.rfgfCompeticiones.resumen,
      clasificacion: schema.rfgfCompeticiones.clasificacion,
    })
    .from(schema.competiciones)
    .leftJoin(
      schema.rfgfCompeticiones,
      eq(schema.rfgfCompeticiones.competicionId, schema.competiciones.id),
    )
    .where(eq(schema.competiciones.id, competicionId));
  if (!fila) return null;
  const partidos = await partidosDeCompeticion(competicionId);
  const jornadas = await db
    .select({ numero: schema.jornadas.numero })
    .from(schema.jornadas)
    .where(eq(schema.jornadas.competicionId, competicionId))
    .orderBy(asc(schema.jornadas.numero));
  const actas = await db
    .select()
    .from(schema.rfgfActas)
    .where(eq(schema.rfgfActas.competicionId, competicionId))
    .orderBy(asc(schema.rfgfActas.actualizadoEn), asc(schema.rfgfActas.codActa));
  const porPartido = new Map(actas.filter((a) => a.partidoId).map((a) => [a.partidoId!, a]));
  // Los errores antiguos guardaban el cruce en el detalle, sin partidoId. Solo se asignan
  // cuando el emparejado existente encuentra un único partido claro en esta competición.
  for (const acta of actas.filter((a) => !a.partidoId && a.estado === "error")) {
    const [cruce] = acta.detalle.split(": ");
    const [local, visitante] = (cruce ?? "").split(" – ");
    if (!local || !visitante) continue;
    const partido = partidoDeActa(local, visitante, partidos);
    if (partido && !porPartido.has(partido.id)) porPartido.set(partido.id, acta);
  }
  const plantilla = await listarJugadores(fila.categoria, fila.temporadaId);
  const ids = new Set(plantilla.map((j) => j.id));
  const cifras = (
    await db
      .select()
      .from(schema.rfgfJugadores)
      .where(eq(schema.rfgfJugadores.competicionId, competicionId))
  ).filter((j) => j.jugadorId && ids.has(j.jugadorId) && j.cifras !== null);
  const lecturas = cifras.flatMap((j) => (j.leidoEn ? [j.leidoEn] : [])).sort();
  const hoy = horaLocal(ahora);
  return {
    competicion: {
      id: fila.id,
      nombre: fila.nombre,
      categoria: fila.categoria,
      enlace: fila.enlace ?? "",
      comprobadoEn: fila.comprobadoEn,
      horariosEn: fila.horariosEn,
      resumen: fila.resumen ?? "",
      clasificacion: fila.clasificacion,
    },
    jornadas: jornadas.map(({ numero }) => {
      const encuentros = partidos
        .filter((p) => p.jornada === numero)
        .sort(
          (a, b) =>
            (a.fecha ?? "9999").localeCompare(b.fecha ?? "9999") || a.id.localeCompare(b.id),
        );
      const jugados = encuentros.filter((p) => p.conMarcador || (p.fecha && p.fecha <= hoy));
      const pendientes = jugados.filter((p) => leFaltaAlgo(p) || !p.conEventos).length;
      // Por jornada: los límites por pasada de estas funciones no ocultan otras jornadas.
      const falta =
        jornadasPendientes(encuentros, hoy).length > 0 ||
        jornadasSinEventos(encuentros, hoy).length > 0 ||
        pendientes > 0;
      return {
        numero,
        fecha: encuentros[0]?.fecha ?? null,
        estado:
          jugados.length === 0
            ? "por_jugar"
            : falta || jugados.length < encuentros.length
              ? "incompleta"
              : "completa",
        partidos: encuentros.length,
        conResultado: encuentros.filter((p) => p.conMarcador).length,
        conActaTratada: encuentros.filter((p) => p.conEventos).length,
        pendientes,
        encuentros: encuentros.map((p) => {
          const acta = porPartido.get(p.id);
          return {
            id: p.id,
            local: p.local,
            visitante: p.visitante,
            marcador:
              p.golesLocal !== null && p.golesVisitante !== null
                ? ([p.golesLocal, p.golesVisitante] as [number, number])
                : null,
            fecha: p.fecha,
            propio: p.propio,
            acta: {
              codActa: acta?.codActa ?? null,
              estado: acta?.estado ?? "sin_acta",
              detalle: acta?.detalle ?? "",
              aviso: acta?.aviso ?? "",
            },
          };
        }),
      };
    }),
    jugadores: {
      plantilla: plantilla.length,
      conCifras: new Set(cifras.map((j) => j.jugadorId)).size,
      lecturaMasAntigua: lecturas[0] ?? null,
      lecturaMasReciente: lecturas.at(-1) ?? null,
    },
  };
}
