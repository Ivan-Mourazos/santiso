"use server";

import { schema } from "@santiso/db";
import { and, asc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { capturar, fallo, type Resultado } from "@/lib/resultado";
import { grupoDeEnlace, urlActaPdf } from "@/lib/rfgf/enlace";
import { obtenerDb } from "@/lib/server/db";
import { crearDescargador } from "@/lib/server/rfgf/descargador";
import { sincronizarTodo } from "@/lib/server/rfgf/sincronizar";
import { estadoFederacion, type EstadoFederacion } from "@/lib/server/rfgf/estado";
import {
  actualizarClasificacion,
  traerActa,
  traerCifrasJugadores,
  traerHorarios,
  traerJornada,
  type ResumenPeticionRfgf,
  type ResultadoClasificacionRfgf,
} from "@/lib/server/rfgf/demanda";
import {
  estadoHistorico,
  traerTemporadaHistorica,
  type ResumenHistoricoRfgf,
} from "@/lib/server/rfgf/historico";
import { soloAdmin } from "@/lib/server/acceso/permisos";
import { pedirPartidosHistoricos, partidosHistoricos } from "@/lib/server/rfgf/historico-partidos";
import {
  elegirClubDeEquipo,
  equiposPorEnlazar,
  traerClubes,
  type EquipoPorEnlazar,
  type ResumenClubesRfgf,
} from "@/lib/server/rfgf/clubes";

export interface ActaPorRevisar {
  codActa: string;
  partido: string;
  motivo: string;
  /** `acta`: el acta del Santiso no se pudo guardar. `datos`: faltan goles y tarjetas. `red`: no llegó. */
  tipo: "acta" | "datos" | "red";
  /** El PDF del acta en la web de la federación, para verla. */
  enlace: string;
}

export interface CompeticionRfgf {
  competicionId: string;
  nombre: string;
  categoria: string;
  /** Vacío si la competición no está enlazada con la federación. */
  enlace: string;
  /** ISO de la última comprobación, o `null`. */
  comprobadoEn: string | null;
  /** Lo último que se trajo, en una frase. */
  resumen: string;
  revisar: ActaPorRevisar[];
}

/** Las competiciones de la temporada activa y cómo va su sincronización con la federación. */
export async function cargarEstadoRfgf(): Promise<Resultado<CompeticionRfgf[]>> {
  return capturar("No se pudo cargar el estado de la federación.", async () => {
    const { db } = await obtenerDb();
    const competiciones = await db
      .select({
        competicionId: schema.competiciones.id,
        nombre: schema.competiciones.nombre,
        categoria: schema.competiciones.categoria,
        enlace: schema.rfgfCompeticiones.enlace,
        comprobadoEn: schema.rfgfCompeticiones.comprobadoEn,
        resumen: schema.rfgfCompeticiones.resumen,
      })
      .from(schema.competiciones)
      .innerJoin(schema.temporadas, eq(schema.temporadas.id, schema.competiciones.temporadaId))
      .leftJoin(
        schema.rfgfCompeticiones,
        eq(schema.rfgfCompeticiones.competicionId, schema.competiciones.id),
      )
      .where(eq(schema.temporadas.activa, true))
      .orderBy(asc(schema.competiciones.categoria), asc(schema.competiciones.orden));

    const pendientes = await db
      .select({
        codActa: schema.rfgfActas.codActa,
        competicionId: schema.rfgfActas.competicionId,
        motivo: schema.rfgfActas.detalle,
        aviso: schema.rfgfActas.aviso,
        estado: schema.rfgfActas.estado,
        local: sql<
          string | null
        >`(select e.nombre from ${schema.partidos} p join ${schema.equipos} e on e.id = p.equipo_local_id where p.id = ${schema.rfgfActas.partidoId})`,
        visitante: sql<
          string | null
        >`(select e.nombre from ${schema.partidos} p join ${schema.equipos} e on e.id = p.equipo_visitante_id where p.id = ${schema.rfgfActas.partidoId})`,
      })
      .from(schema.rfgfActas)
      .where(
        or(
          and(
            eq(schema.rfgfActas.estado, "revisar"),
            // Deja de estar pendiente en cuanto el partido tiene su acta, venga de donde venga.
            sql`not exists (select 1 from ${schema.partidoParticipaciones} where ${schema.partidoParticipaciones.partidoId} = ${schema.rfgfActas.partidoId})`,
          ),
          eq(schema.rfgfActas.estado, "error"),
          ne(schema.rfgfActas.aviso, ""),
        ),
      );

    return competiciones.map((c) => ({
      competicionId: c.competicionId,
      nombre: c.nombre,
      categoria: c.categoria,
      enlace: c.enlace ?? "",
      comprobadoEn: c.comprobadoEn ?? null,
      resumen: c.resumen ?? "",
      revisar: pendientes
        .filter((p) => p.competicionId === c.competicionId)
        .map((p) => {
          const grupo = grupoDeEnlace(c.enlace ?? "");
          // En un fallo de red el cruce va delante del motivo: aún no se casó con un partido.
          const [cruce, ...resto] = p.estado === "error" ? p.motivo.split(": ") : [];
          return {
            codActa: p.codActa,
            partido:
              p.local && p.visitante
                ? `${p.local} – ${p.visitante}`
                : cruce && resto.length
                  ? cruce
                  : "Partido sin identificar",
            motivo: p.estado === "error" ? resto.join(": ") || p.motivo : p.aviso || p.motivo,
            tipo:
              p.estado === "error"
                ? ("red" as const)
                : p.estado === "revisar"
                  ? ("acta" as const)
                  : ("datos" as const),
            enlace: grupo ? urlActaPdf(grupo, p.codActa) : "",
          };
        }),
    }));
  });
}

/** Enlaza una competición con su calendario en la federación. Vacío = dejar de sincronizarla. */
export async function guardarEnlaceRfgf(
  competicionId: string,
  enlace: string,
): Promise<Resultado<null>> {
  const sinPermiso = await soloAdmin();
  if (sinPermiso) return sinPermiso;
  const texto = enlace.trim();
  const { db } = await obtenerDb();
  if (!texto) {
    return capturar("No se pudo quitar el enlace.", async () => {
      await db
        .delete(schema.rfgfCompeticiones)
        .where(eq(schema.rfgfCompeticiones.competicionId, competicionId));
      return null;
    });
  }
  if (!grupoDeEnlace(texto)) {
    return fallo(
      "Ese enlace no vale. Pega el del calendario o el de una jornada de la competición en futgal.es.",
    );
  }
  return capturar("No se pudo guardar el enlace.", async () => {
    await db
      .insert(schema.rfgfCompeticiones)
      .values({ competicionId, enlace: texto })
      .onConflictDoUpdate({
        target: schema.rfgfCompeticiones.competicionId,
        set: { enlace: texto },
      });
    return null;
  });
}

/** Mira ahora mismo la federación, sin esperar a la siguiente comprobación periódica. */
export async function comprobarRfgfAhora(): Promise<Resultado<string>> {
  const sinPermiso = await soloAdmin();
  if (sinPermiso) return sinPermiso;
  return capturar("No se pudo consultar la federación.", async () => {
    // A mano se trae todo: resultados, horarios y dos jornadas atrasadas de goles y tarjetas.
    const resumenes = await sincronizarTodo(crearDescargador(), new Date(), false, true);
    if (resumenes.length === 0)
      return "No hay competiciones enlazadas, o ya hay una comprobación en marcha.";
    const actas = resumenes.reduce((n, r) => n + r.actas, 0);
    const resultados = resumenes.reduce((n, r) => n + r.resultados, 0);
    const horarios = resumenes.reduce((n, r) => n + r.horarios.length, 0);
    const revisar = resumenes.reduce((n, r) => n + r.revisar.length, 0);
    const errores = resumenes.reduce((n, r) => n + r.errores.length, 0);
    if (!actas && !resultados && !horarios && !revisar && !errores) {
      return "Sin novedades en la federación.";
    }
    return [
      actas ? `${actas} acta${actas > 1 ? "s" : ""}` : "",
      resultados ? `${resultados} resultado${resultados > 1 ? "s" : ""}` : "",
      horarios ? `${horarios} horario${horarios > 1 ? "s" : ""} al día` : "",
      revisar ? `${revisar} por revisar` : "",
      errores ? `${errores} con error` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  });
}

/** Tras arreglar lo que impedía guardar un acta (dar de alta a un jugador), se vuelve a intentar. */
export async function reintentarActaRfgf(codActa: string): Promise<Resultado<null>> {
  const sinPermiso = await soloAdmin();
  if (sinPermiso) return sinPermiso;
  return capturar("No se pudo preparar el reintento.", async () => {
    const { db } = await obtenerDb();
    await db
      .delete(schema.rfgfActas)
      // Fuera el apunte si tiene algún problema: la próxima comprobación la vuelve a traer.
      // Lo que se guardó bien no se toca.
      .where(
        and(
          eq(schema.rfgfActas.codActa, codActa),
          or(
            inArray(schema.rfgfActas.estado, ["revisar", "error"]),
            ne(schema.rfgfActas.aviso, ""),
          ),
        ),
      );
    return null;
  });
}

/** Lectura local: obtenerDb comprueba la sesión, sin exigir rol de administrador. */
export async function cargarEstadoFederacion(
  competicionId: string,
): Promise<Resultado<EstadoFederacion | null>> {
  return capturar("No se pudo cargar el estado de la federación.", () =>
    estadoFederacion(competicionId),
  );
}

export async function traerJornadaRfgf(
  competicionId: string,
  numero: number,
): Promise<Resultado<ResumenPeticionRfgf>> {
  const sinPermiso = await soloAdmin();
  if (sinPermiso) return sinPermiso;
  return capturar("No se pudo traer la jornada de la federación.", () =>
    traerJornada(competicionId, numero, crearDescargador()),
  );
}

export async function traerActaRfgf(
  competicionId: string,
  partidoId: string,
): Promise<Resultado<ResumenPeticionRfgf>> {
  const sinPermiso = await soloAdmin();
  if (sinPermiso) return sinPermiso;
  return capturar("No se pudo traer el acta de la federación.", () =>
    traerActa(competicionId, partidoId, crearDescargador()),
  );
}

export async function traerHorariosRfgf(
  competicionId: string,
): Promise<Resultado<ResumenPeticionRfgf>> {
  const sinPermiso = await soloAdmin();
  if (sinPermiso) return sinPermiso;
  return capturar("No se pudieron traer los horarios de la federación.", () =>
    traerHorarios(competicionId, crearDescargador()),
  );
}

export async function traerCifrasJugadoresRfgf(
  competicionId: string,
): Promise<Resultado<ResumenPeticionRfgf>> {
  const sinPermiso = await soloAdmin();
  if (sinPermiso) return sinPermiso;
  return capturar("No se pudieron traer las cifras de los jugadores.", () =>
    traerCifrasJugadores(competicionId, crearDescargador()),
  );
}

export async function actualizarClasificacionRfgf(
  competicionId: string,
): Promise<Resultado<ResultadoClasificacionRfgf>> {
  const sinPermiso = await soloAdmin();
  if (sinPermiso) return sinPermiso;
  return capturar("No se pudo actualizar la clasificación oficial.", () =>
    actualizarClasificacion(competicionId, crearDescargador()),
  );
}

export async function cargarEstadoHistoricoRfgf(): Promise<
  Resultado<Awaited<ReturnType<typeof estadoHistorico>>>
> {
  const sinPermiso = await soloAdmin();
  if (sinPermiso) return sinPermiso;
  return capturar("No se pudo cargar el estado de las temporadas pasadas.", () =>
    estadoHistorico(),
  );
}

export async function traerTemporadaHistoricaRfgf(
  codGrupo: string,
): Promise<Resultado<ResumenHistoricoRfgf>> {
  const sinPermiso = await soloAdmin();
  if (sinPermiso) return sinPermiso;
  return capturar("No se pudo avanzar en esa temporada pasada.", () =>
    traerTemporadaHistorica(codGrupo, crearDescargador()),
  );
}

export async function pedirPartidosHistoricosRfgf(codGrupo: string): Promise<Resultado<null>> {
  const sinPermiso = await soloAdmin();
  if (sinPermiso) return sinPermiso;
  return capturar("No se pudieron encolar los partidos de esa temporada.", async () => {
    await pedirPartidosHistoricos(codGrupo);
    return null;
  });
}

export async function cargarPartidosHistoricosRfgf(
  codGrupo: string,
): Promise<Resultado<Awaited<ReturnType<typeof partidosHistoricos>>>> {
  const sinPermiso = await soloAdmin();
  if (sinPermiso) return sinPermiso;
  return capturar("No se pudieron cargar los partidos de esa temporada.", () =>
    partidosHistoricos(codGrupo),
  );
}

/** Baja el listado de clubes de la federación (una petición) y enlaza los equipos inequívocos. */
export async function traerClubesRfgf(): Promise<Resultado<ResumenClubesRfgf>> {
  const sinPermiso = await soloAdmin();
  if (sinPermiso) return sinPermiso;
  return capturar("No se pudo traer el listado de clubes de la federación.", () =>
    traerClubes(crearDescargador()),
  );
}

/** Los equipos sin club con candidatos para elegir. Solo lee, pero es cosa del administrador. */
export async function cargarEquiposPorEnlazarRfgf(): Promise<Resultado<EquipoPorEnlazar[]>> {
  const sinPermiso = await soloAdmin();
  if (sinPermiso) return sinPermiso;
  return capturar("No se pudieron cargar los equipos sin club.", () => equiposPorEnlazar());
}

/** Enlaza a mano un equipo con su club de la federación; `null` lo deja sin club para siempre. */
export async function enlazarEquipoConClubRfgf(
  equipoId: string,
  codigo: string | null,
): Promise<Resultado<null>> {
  const sinPermiso = await soloAdmin();
  if (sinPermiso) return sinPermiso;
  if (codigo !== null && !/^\d{1,12}$/u.test(codigo)) return fallo("Código de club no válido.");
  return capturar("No se pudo enlazar el equipo con su club.", async () => {
    await elegirClubDeEquipo(equipoId, codigo);
    return null;
  });
}
