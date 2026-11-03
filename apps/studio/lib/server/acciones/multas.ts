"use server";

import { schema } from "@santiso/db";
import { claveNombre } from "@santiso/domain";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { hoyLocal } from "@/lib/jornada/semana";
import {
  CONCEPTOS_DEL_CLUB,
  esDia,
  errorGasto,
  GRUPOS_MULTA,
  importeDeMulta,
  OTRO_MOTIVO,
  textoDeConcepto,
  unidadesDe,
  type ConceptoMulta,
  type GrupoMulta,
  type Multa,
  type PantallaMultas,
} from "@/lib/multas/modelo";
import { capturar, fallo, type Resultado } from "@/lib/resultado";
import { personas } from "../personas-multas";
import { obtenerDb } from "@/lib/server/db";

type Db = Awaited<ReturnType<typeof obtenerDb>>["db"];

const COLUMNAS_CONCEPTO = {
  id: schema.multasConceptos.id,
  nombre: schema.multasConceptos.nombre,
  grupo: schema.multasConceptos.grupo,
  importeCentimos: schema.multasConceptos.importeCentimos,
  porUnidad: schema.multasConceptos.porUnidad,
  opciones: schema.multasConceptos.opciones,
  activo: schema.multasConceptos.activo,
};

async function conceptos(db: Db): Promise<ConceptoMulta[]> {
  return await db
    .select(COLUMNAS_CONCEPTO)
    .from(schema.multasConceptos)
    .orderBy(
      asc(schema.multasConceptos.grupo),
      asc(schema.multasConceptos.orden),
      asc(schema.multasConceptos.nombre),
    );
}

/** La primera vez, el catálogo son las normas del club; después manda lo que haya en la tabla. */
async function sembrarConceptos(db: Db) {
  const [alguno] = await db
    .select({ id: schema.multasConceptos.id })
    .from(schema.multasConceptos)
    .limit(1);
  if (alguno) return;
  await db
    .insert(schema.multasConceptos)
    .values(CONCEPTOS_DEL_CLUB.map((c, orden) => ({ ...c, clave: claveNombre(c.nombre), orden })));
}

async function multasDe(db: Db, temporadaId: string): Promise<Multa[]> {
  const filas = await db
    .select({
      id: schema.multas.id,
      jugadorId: schema.multas.jugadorId,
      staffId: schema.multas.staffId,
      jugador: schema.jugadores.nombre,
      staff: schema.staff.nombre,
      concepto: schema.multas.concepto,
      importeCentimos: schema.multas.importeCentimos,
      fecha: schema.multas.fecha,
      nota: schema.multas.nota,
      pagadaEn: schema.multas.pagadaEn,
    })
    .from(schema.multas)
    .leftJoin(schema.jugadores, eq(schema.jugadores.id, schema.multas.jugadorId))
    .leftJoin(schema.staff, eq(schema.staff.id, schema.multas.staffId))
    .where(eq(schema.multas.temporadaId, temporadaId))
    .orderBy(desc(schema.multas.fecha), desc(schema.multas.creadoEn));
  return filas.map((f) => ({
    id: f.id,
    persona: f.jugador ?? f.staff ?? "—",
    personaClave: f.jugadorId ? `jugador:${f.jugadorId}` : `staff:${f.staffId}`,
    concepto: f.concepto,
    importeCentimos: f.importeCentimos,
    fecha: f.fecha,
    nota: f.nota,
    pagadaEn: f.pagadaEn,
  }));
}

/** Todo lo de la pantalla de Multas, de la temporada activa, en un viaje. */
export async function cargarPantallaMultas(): Promise<Resultado<PantallaMultas>> {
  return capturar("No se pudieron cargar las multas.", async () => {
    const { db } = await obtenerDb();
    await sembrarConceptos(db);
    const [temporada] = await db
      .select({ id: schema.temporadas.id, nombre: schema.temporadas.nombre })
      .from(schema.temporadas)
      .where(eq(schema.temporadas.activa, true));
    if (!temporada) {
      return {
        temporada: null,
        conceptos: await conceptos(db),
        personas: [],
        multas: [],
        gastos: [],
      };
    }
    return {
      temporada,
      conceptos: await conceptos(db),
      personas: await personas(db, temporada.id),
      multas: await multasDe(db, temporada.id),
      gastos: await db
        .select()
        .from(schema.boteGastos)
        .where(eq(schema.boteGastos.temporadaId, temporada.id)),
    };
  });
}

export interface NuevaMulta {
  /** `jugador:<id>` o `staff:<id>`. */
  personaClave: string;
  /** Concepto de las normas, o `OTRO_MOTIVO` con `motivo` e importe escritos a mano. */
  conceptoId: string;
  /** Motivo libre: solo con `OTRO_MOTIVO`. */
  motivo?: string;
  /** Solo cuenta en conceptos por unidad sin opciones. */
  unidades: number;
  /** Opciones marcadas («Medias 1ª», «Peto»): cada una es una unidad. */
  opciones?: string[];
  /** Importe total escrito a mano; sin él, el que marcan las normas. */
  importeCentimos?: number | null;
  fecha: string;
  nota?: string;
}

/** Pone una multa en la temporada activa. El importe sale de las normas salvo que se escriba otro. */
export async function ponerMulta(entrada: NuevaMulta): Promise<Resultado<null>> {
  const [tipo, personaId] = entrada.personaClave.split(":");
  if ((tipo !== "jugador" && tipo !== "staff") || !personaId) return fallo("Elige a quién.");
  if (!esDia(entrada.fecha)) return fallo("La fecha no es válida.");
  const { db } = await obtenerDb();
  const [temporada] = await db
    .select({ id: schema.temporadas.id })
    .from(schema.temporadas)
    .where(eq(schema.temporadas.activa, true));
  if (!temporada) return fallo("No hay temporada activa.");
  const libre = entrada.conceptoId === OTRO_MOTIVO;
  const motivo = entrada.motivo?.trim() ?? "";
  if (libre && !motivo) return fallo("Escribe el motivo de la multa.");
  const [concepto] = libre
    ? []
    : await db
        .select(COLUMNAS_CONCEPTO)
        .from(schema.multasConceptos)
        .where(eq(schema.multasConceptos.id, entrada.conceptoId));
  if (!libre && !concepto) return fallo("Elige el motivo de la multa.");
  const gente = await personas(db, temporada.id);
  const persona = gente.find((p) => p.clave === entrada.personaClave);
  if (!persona) return fallo("Esa persona no está en la plantilla de esta temporada.");

  const aMano = entrada.importeCentimos;
  if (aMano !== undefined && aMano !== null && !(Number.isInteger(aMano) && aMano > 0)) {
    return fallo("El importe no es válido.");
  }
  // Motivo libre: no hay norma de la que sacar el importe, así que hay que escribirlo.
  let texto = motivo;
  let importeCentimos = aMano ?? null;
  if (concepto) {
    const elegidas = (entrada.opciones ?? []).filter((o) => concepto.opciones.includes(o));
    const unidades = unidadesDe(concepto, entrada.unidades, elegidas);
    texto = textoDeConcepto(concepto, unidades, elegidas);
    importeCentimos ??= importeDeMulta(concepto, unidades, persona.adestrador);
  }
  if (importeCentimos === null) return fallo("Escribe el importe de la multa.");
  const importe = importeCentimos;

  return capturar("No se pudo guardar la multa.", async () => {
    await db.insert(schema.multas).values({
      temporadaId: temporada.id,
      jugadorId: tipo === "jugador" ? personaId : null,
      staffId: tipo === "staff" ? personaId : null,
      concepto: texto,
      importeCentimos: importe,
      fecha: entrada.fecha,
      nota: entrada.nota?.trim() || null,
    });
    return null;
  });
}

/** Marca una multa como pagada (hoy) o la vuelve a dejar pendiente. */
export async function cambiarPagoMulta(id: string, pagada: boolean): Promise<Resultado<null>> {
  return capturar("No se pudo cambiar el pago.", async () => {
    const { db } = await obtenerDb();
    await db
      .update(schema.multas)
      .set({ pagadaEn: pagada ? hoyLocal() : null })
      .where(eq(schema.multas.id, id));
    return null;
  });
}

/** Quita una multa puesta por error. */
export async function quitarMulta(id: string): Promise<Resultado<null>> {
  return capturar("No se pudo quitar la multa.", async () => {
    const { db } = await obtenerDb();
    await db.delete(schema.multas).where(eq(schema.multas.id, id));
    return null;
  });
}

export interface ConceptoEditado {
  id?: string;
  nombre: string;
  grupo: string;
  importeCentimos: number;
  porUnidad: boolean;
  opciones?: string[];
  activo: boolean;
}

/** Crea o cambia un concepto del catálogo. Las multas ya puestas no cambian. */
export async function guardarConcepto(entrada: ConceptoEditado): Promise<Resultado<null>> {
  const nombre = entrada.nombre.trim();
  if (!nombre) return fallo("El concepto necesita un nombre.");
  if (!GRUPOS_MULTA.includes(entrada.grupo as GrupoMulta)) return fallo("Grupo desconocido.");
  if (!(Number.isInteger(entrada.importeCentimos) && entrada.importeCentimos > 0)) {
    return fallo("El importe no es válido.");
  }
  const grupo = entrada.grupo as GrupoMulta;
  const clave = claveNombre(nombre);
  const { db } = await obtenerDb();
  const [repetido] = await db
    .select({ id: schema.multasConceptos.id })
    .from(schema.multasConceptos)
    .where(
      and(
        eq(schema.multasConceptos.grupo, grupo),
        eq(schema.multasConceptos.clave, clave),
        entrada.id ? ne(schema.multasConceptos.id, entrada.id) : undefined,
      ),
    );
  if (repetido) return fallo("Ya hay un concepto con ese nombre en ese grupo.");

  return capturar("No se pudo guardar el concepto.", async () => {
    const valores = {
      nombre,
      clave,
      grupo,
      importeCentimos: entrada.importeCentimos,
      porUnidad: entrada.porUnidad,
      opciones: entrada.porUnidad
        ? [...new Set((entrada.opciones ?? []).map((o) => o.trim()))].filter(Boolean)
        : [],
      activo: entrada.activo,
    };
    if (entrada.id) {
      await db
        .update(schema.multasConceptos)
        .set(valores)
        .where(eq(schema.multasConceptos.id, entrada.id));
    } else {
      await db.insert(schema.multasConceptos).values({ ...valores, orden: 999 });
    }
    return null;
  });
}

export interface GastoEditado {
  id?: string;
  concepto: string;
  importeCentimos: number;
  fecha: string;
  nota?: string;
}

/** Alta y edición solo en la temporada activa; misma barrera de sesión que ponerMulta. */
export async function guardarGasto(entrada: GastoEditado): Promise<Resultado<null>> {
  const error = errorGasto(entrada);
  if (error) return fallo(error);
  const { db } = await obtenerDb();
  const [temporada] = await db
    .select()
    .from(schema.temporadas)
    .where(eq(schema.temporadas.activa, true));
  if (!temporada) return fallo("No hay temporada activa.");
  if (entrada.id) {
    const [gasto] = await db
      .select()
      .from(schema.boteGastos)
      .where(
        and(eq(schema.boteGastos.id, entrada.id), eq(schema.boteGastos.temporadaId, temporada.id)),
      );
    if (!gasto) return fallo("Ese gasto no pertenece a la temporada activa.");
  }
  return capturar("No se pudo guardar el gasto.", async () => {
    const valores = {
      concepto: entrada.concepto.trim(),
      importeCentimos: entrada.importeCentimos,
      fecha: entrada.fecha,
      nota: entrada.nota?.trim() || null,
    };
    if (entrada.id) {
      await db
        .update(schema.boteGastos)
        .set(valores)
        .where(
          and(
            eq(schema.boteGastos.id, entrada.id),
            eq(schema.boteGastos.temporadaId, temporada.id),
          ),
        );
    } else {
      await db.insert(schema.boteGastos).values({ ...valores, temporadaId: temporada.id });
    }
    return null;
  });
}

export async function borrarGasto(id: string): Promise<Resultado<null>> {
  const { db } = await obtenerDb();
  const [temporada] = await db
    .select()
    .from(schema.temporadas)
    .where(eq(schema.temporadas.activa, true));
  if (!temporada) return fallo("No hay temporada activa.");
  const filtro = and(eq(schema.boteGastos.id, id), eq(schema.boteGastos.temporadaId, temporada.id));
  const [gasto] = await db.select().from(schema.boteGastos).where(filtro);
  if (!gasto) return fallo("Ese gasto no pertenece a la temporada activa.");
  return capturar("No se pudo borrar el gasto.", async () => {
    await db.delete(schema.boteGastos).where(filtro);
    return null;
  });
}
