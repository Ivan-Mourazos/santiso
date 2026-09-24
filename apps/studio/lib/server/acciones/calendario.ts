"use server";

import { schema } from "@santiso/db";
import { ESTADOS_PARTIDO, esValorDe, fechaHoraDePartido } from "@santiso/domain";
import { and, eq, or } from "drizzle-orm";
import type { JornadaDto, PantallaCalendario, PartidoDto } from "@/lib/dto";
import { capturar, exito, fallo, type Resultado } from "@/lib/resultado";
import { asegurarCampo } from "@/lib/server/acciones/campos";
import {
  aJornadaDto,
  aPartidoDto,
  COLUMNAS_JORNADA,
  COLUMNAS_PARTIDO,
  listarDescansos,
  listarJornadas,
  listarPartidos,
} from "@/lib/server/consultas/calendario";
import { listarCampos } from "@/lib/server/consultas/campos";
import { equiposDeCompeticion } from "@/lib/server/consultas/equipos";
import { obtenerDb } from "@/lib/server/db";

/** Toda fecha de partido entra por aquí: hora de pared sin zona, o un error que se enseña. */
function leerFecha(valor: string): Resultado<string | null> {
  try {
    return exito(fechaHoraDePartido(valor));
  } catch (error) {
    return fallo(error instanceof Error ? error.message : "Fecha u hora no válida.");
  }
}

/** Partidos de una jornada suelta, para los consumidores que no cargan la pantalla entera. */
export async function cargarPartidosDeJornada(jornadaId: string): Promise<PartidoDto[]> {
  return jornadaId ? listarPartidos(jornadaId) : [];
}

/** Jornadas de una competición, para los consumidores que no cargan la pantalla entera. */
export async function cargarJornadasDeCompeticion(competicionId: string): Promise<JornadaDto[]> {
  return competicionId ? listarJornadas(competicionId) : [];
}

/** Carga de la pantalla en una sola acción: Next despacha las del cliente en serie. */
export async function cargarPantallaCalendario(
  competicionId: string,
  jornadaId: string,
): Promise<PantallaCalendario> {
  const [jornadas, equipos, campos] = await Promise.all([
    competicionId ? listarJornadas(competicionId) : Promise.resolve([]),
    competicionId ? equiposDeCompeticion(competicionId) : Promise.resolve([]),
    listarCampos(),
  ]);
  const [partidos, descansos] = jornadaId
    ? await Promise.all([listarPartidos(jornadaId), listarDescansos(jornadaId)])
    : [[], []];
  return { jornadas, partidos, descansos, equipos, campos };
}

export async function crearJornada(entrada: {
  competicionId: string;
  numero: string;
  fechaInicio: string;
  nombreFase: string;
}): Promise<Resultado<JornadaDto>> {
  const numero = Number(entrada.numero);
  if (!Number.isInteger(numero) || numero <= 0) {
    return fallo("El número de jornada debe ser un entero positivo.", { numero: "No válido" });
  }
  if (!entrada.competicionId) return fallo("Elige una competición antes de crear jornadas.");

  const { db } = await obtenerDb();
  const [existente] = await db
    .select({ id: schema.jornadas.id })
    .from(schema.jornadas)
    .where(
      and(
        eq(schema.jornadas.competicionId, entrada.competicionId),
        eq(schema.jornadas.numero, numero),
      ),
    );
  if (existente) return fallo(`Ya existe la jornada ${numero} en esta competición.`);

  return capturar("No se pudo crear la jornada.", async () => {
    const [fila] = await db
      .insert(schema.jornadas)
      .values({
        competicionId: entrada.competicionId,
        numero,
        fechaInicio: entrada.fechaInicio.trim() || null,
        nombreFase: entrada.nombreFase.trim() || null,
      })
      .returning(COLUMNAS_JORNADA);
    if (!fila) throw new Error("La inserción no devolvió ninguna fila");
    return aJornadaDto(fila);
  });
}

/** Crea las jornadas 1..`hasta` que falten. Devuelve cuántas ha creado. */
export async function crearJornadasEnLote(
  competicionId: string,
  hasta: number,
): Promise<Resultado<number>> {
  if (!Number.isInteger(hasta) || hasta <= 0) return fallo("Indica cuántas jornadas quieres.");
  if (!competicionId) return fallo("Elige una competición antes de crear jornadas.");

  return capturar("No se pudieron crear las jornadas.", async () => {
    const { db } = await obtenerDb();
    const existentes = await db
      .select({ numero: schema.jornadas.numero })
      .from(schema.jornadas)
      .where(eq(schema.jornadas.competicionId, competicionId));
    const ya = new Set(existentes.map((j) => j.numero));
    const faltan = Array.from({ length: hasta }, (_, i) => i + 1).filter((n) => !ya.has(n));
    if (faltan.length === 0) return 0;
    await db.insert(schema.jornadas).values(faltan.map((numero) => ({ competicionId, numero })));
    return faltan.length;
  });
}

/** Borra la jornada. Partidos y descansos caen con ella por cascada. */
export async function borrarJornada(id: string): Promise<Resultado<null>> {
  const { db } = await obtenerDb();
  const resultado = await capturar("No se pudo borrar la jornada.", async () => {
    await db.delete(schema.jornadas).where(eq(schema.jornadas.id, id));
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}

export async function crearPartido(entrada: {
  jornadaId: string;
  equipoLocalId: string;
  equipoVisitanteId: string;
  fecha: string;
  campoId: string;
}): Promise<Resultado<PartidoDto>> {
  const { jornadaId, equipoLocalId, equipoVisitanteId } = entrada;
  if (!jornadaId) return fallo("Elige una jornada.");
  if (!equipoLocalId || !equipoVisitanteId) return fallo("Elige los dos equipos.");
  if (equipoLocalId === equipoVisitanteId) {
    return fallo("Un equipo no puede jugar contra sí mismo.");
  }
  const fecha = leerFecha(entrada.fecha);
  if (!fecha.ok) return fecha;

  const { db } = await obtenerDb();
  const enJornada = await db
    .select({
      local: schema.partidos.equipoLocalId,
      visitante: schema.partidos.equipoVisitanteId,
    })
    .from(schema.partidos)
    .where(eq(schema.partidos.jornadaId, jornadaId));
  const ocupados = new Set(enJornada.flatMap((p) => [p.local, p.visitante]));
  if (ocupados.has(equipoLocalId) || ocupados.has(equipoVisitanteId)) {
    return fallo("Uno de los equipos ya juega en esta jornada.");
  }

  return capturar("No se pudo añadir el partido.", async () => {
    const [fila] = await db
      .insert(schema.partidos)
      .values({
        jornadaId,
        equipoLocalId,
        equipoVisitanteId,
        fecha: fecha.datos,
        campoId: entrada.campoId.trim() || null,
      })
      .returning(COLUMNAS_PARTIDO);
    if (!fila) throw new Error("La inserción no devolvió ninguna fila");
    return aPartidoDto(fila);
  });
}

/**
 * Alta o actualización de un partido tal y como lo trae el importador de jornada: identifica el
 * partido por el cruce dentro de la jornada, resuelve el campo por nombre y deja el estado
 * coherente con el marcador. Va en una sola acción porque Next serializa las del cliente y
 * hacerlo en cuatro pasos sería cuatro viajes por cada fila importada.
 */
export async function guardarPartidoDeJornada(entrada: {
  jornadaId: string;
  equipoLocalId: string;
  equipoVisitanteId: string;
  golesLocal: string;
  golesVisitante: string;
  fecha: string;
  campoId: string;
  campoNombre: string;
  campoPoblacion: string;
}): Promise<Resultado<null>> {
  const { jornadaId, equipoLocalId, equipoVisitanteId } = entrada;
  if (!jornadaId) return fallo("Elige una jornada de destino.");
  if (!equipoLocalId || !equipoVisitanteId) return fallo("Faltan equipos en la fila.");
  if (equipoLocalId === equipoVisitanteId) {
    return fallo("Un equipo no puede jugar contra sí mismo.");
  }

  const textoLocal = entrada.golesLocal.trim();
  const textoVisitante = entrada.golesVisitante.trim();
  if (!textoLocal !== !textoVisitante) {
    return fallo("El marcador debe tener los dos goles o ninguno.");
  }
  let golesLocal: number | null = null;
  let golesVisitante: number | null = null;
  if (textoLocal && textoVisitante) {
    golesLocal = Number(textoLocal);
    golesVisitante = Number(textoVisitante);
    const valido = (n: number) => Number.isInteger(n) && n >= 0;
    if (!valido(golesLocal) || !valido(golesVisitante)) {
      return fallo("Los goles deben ser números enteros no negativos.");
    }
  }

  const fecha = leerFecha(entrada.fecha);
  if (!fecha.ok) return fecha;

  let campoId = entrada.campoId.trim() || null;
  if (!campoId && entrada.campoNombre.trim()) {
    const campo = await asegurarCampo(entrada.campoNombre, entrada.campoPoblacion);
    if (!campo.ok) return campo;
    campoId = campo.datos.id;
  }

  const { db } = await obtenerDb();
  const resultado = await capturar("No se pudo guardar el partido.", async () => {
    const [existente] = await db
      .select({ id: schema.partidos.id })
      .from(schema.partidos)
      .where(
        and(
          eq(schema.partidos.jornadaId, jornadaId),
          eq(schema.partidos.equipoLocalId, equipoLocalId),
          eq(schema.partidos.equipoVisitanteId, equipoVisitanteId),
        ),
      );

    const valores = {
      golesLocal,
      golesVisitante,
      estado: golesLocal === null ? ("programado" as const) : ("finalizado" as const),
      fecha: fecha.datos,
      ...(campoId ? { campoId } : {}),
    };

    if (existente) {
      await db.update(schema.partidos).set(valores).where(eq(schema.partidos.id, existente.id));
    } else {
      await db
        .insert(schema.partidos)
        .values({ jornadaId, equipoLocalId, equipoVisitanteId, ...valores });
    }
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}

/**
 * Guarda el marcador. Los dos goles o ninguno: el CHECK `partidos_marcador_completo_ck` no
 * admite medios marcadores. Poner marcador finaliza el partido; quitarlo lo devuelve a
 * programado, porque `partidos_finalizado_con_marcador_ck` no deja un finalizado sin goles.
 */
export async function guardarMarcador(
  id: string,
  local: string,
  visitante: string,
): Promise<Resultado<PartidoDto>> {
  const textoLocal = local.trim();
  const textoVisitante = visitante.trim();
  if (!textoLocal !== !textoVisitante) {
    return fallo("El marcador debe tener los dos goles o ninguno.");
  }

  let golesLocal: number | null = null;
  let golesVisitante: number | null = null;
  if (textoLocal && textoVisitante) {
    golesLocal = Number(textoLocal);
    golesVisitante = Number(textoVisitante);
    const valido = (n: number) => Number.isInteger(n) && n >= 0;
    if (!valido(golesLocal) || !valido(golesVisitante)) {
      return fallo("Los goles deben ser números enteros no negativos.");
    }
  }

  const { db } = await obtenerDb();
  return capturar("No se pudo guardar el marcador.", async () => {
    const [fila] = await db
      .update(schema.partidos)
      .set({
        golesLocal,
        golesVisitante,
        estado: golesLocal === null ? "programado" : "finalizado",
      })
      .where(eq(schema.partidos.id, id))
      .returning(COLUMNAS_PARTIDO);
    if (!fila) throw new Error("El partido no existe");
    return aPartidoDto(fila);
  });
}

/** Cambia el estado. `finalizado` exige marcador, así que se comprueba antes de escribir. */
export async function cambiarEstadoPartido(id: string, estado: string): Promise<Resultado<null>> {
  if (!esValorDe(ESTADOS_PARTIDO, estado)) return fallo("Estado de partido desconocido.");

  const { db } = await obtenerDb();
  const [partido] = await db
    .select({ golesLocal: schema.partidos.golesLocal })
    .from(schema.partidos)
    .where(eq(schema.partidos.id, id));
  if (!partido) return fallo("Ese partido ya no existe.");
  if (estado === "finalizado" && partido.golesLocal === null) {
    return fallo("Un partido finalizado necesita marcador.");
  }

  const resultado = await capturar("No se pudo cambiar el estado del partido.", async () => {
    await db.update(schema.partidos).set({ estado }).where(eq(schema.partidos.id, id));
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}

export async function cambiarFechaPartido(id: string, fecha: string): Promise<Resultado<null>> {
  const leida = leerFecha(fecha);
  if (!leida.ok) return leida;
  const { db } = await obtenerDb();
  const resultado = await capturar("No se pudo cambiar la fecha del partido.", async () => {
    await db.update(schema.partidos).set({ fecha: leida.datos }).where(eq(schema.partidos.id, id));
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}

export async function cambiarCampoPartido(id: string, campoId: string): Promise<Resultado<null>> {
  const { db } = await obtenerDb();
  const resultado = await capturar("No se pudo cambiar el campo del partido.", async () => {
    await db
      .update(schema.partidos)
      .set({ campoId: campoId.trim() || null })
      .where(eq(schema.partidos.id, id));
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}

export async function borrarPartido(id: string): Promise<Resultado<null>> {
  const { db } = await obtenerDb();
  const resultado = await capturar("No se pudo borrar el partido.", async () => {
    await db.delete(schema.partidos).where(eq(schema.partidos.id, id));
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}

/** Marca el descanso de un equipo. Repetirlo no falla: la clave primaria compuesta lo absorbe. */
export async function anadirDescanso(
  jornadaId: string,
  equipoId: string,
): Promise<Resultado<null>> {
  if (!jornadaId || !equipoId) return fallo("Elige la jornada y el equipo.");

  const { db } = await obtenerDb();
  const [juega] = await db
    .select({ id: schema.partidos.id })
    .from(schema.partidos)
    .where(
      and(
        eq(schema.partidos.jornadaId, jornadaId),
        or(
          eq(schema.partidos.equipoLocalId, equipoId),
          eq(schema.partidos.equipoVisitanteId, equipoId),
        ),
      ),
    );
  if (juega) return fallo("Ese equipo ya tiene partido en esta jornada.");

  const resultado = await capturar("No se pudo registrar el descanso.", async () => {
    await db.insert(schema.jornadaDescansos).values({ jornadaId, equipoId }).onConflictDoNothing();
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}

export async function quitarDescanso(
  jornadaId: string,
  equipoId: string,
): Promise<Resultado<null>> {
  const { db } = await obtenerDb();
  const resultado = await capturar("No se pudo quitar el descanso.", async () => {
    await db
      .delete(schema.jornadaDescansos)
      .where(
        and(
          eq(schema.jornadaDescansos.jornadaId, jornadaId),
          eq(schema.jornadaDescansos.equipoId, equipoId),
        ),
      );
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}
