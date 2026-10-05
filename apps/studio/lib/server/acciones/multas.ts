"use server";

import { schema } from "@santiso/db";
import { claveNombre } from "@santiso/domain";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { hoyLocal } from "@/lib/jornada/semana";
import {
  CONCEPTOS_DEL_CLUB,
  esDia,
  GRUPOS_MULTA,
  importeDeMulta,
  textoDeConcepto,
  unidadesDe,
  type ConceptoMulta,
  type GrupoMulta,
  type Multa,
  type PantallaMultas,
  type PersonaMulta,
} from "@/lib/multas/modelo";
import { capturar, fallo, type Resultado } from "@/lib/resultado";
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
  const [alguno] = await db.select({ id: schema.multasConceptos.id }).from(schema.multasConceptos).limit(1);
  if (alguno) return;
  await db.insert(schema.multasConceptos).values(
    CONCEPTOS_DEL_CLUB.map((c, orden) => ({ ...c, clave: claveNombre(c.nombre), orden })),
  );
}

/** Plantilla y cuerpo técnico de la temporada; cada persona una vez. */
async function personas(db: Db, temporadaId: string): Promise<PersonaMulta[]> {
  const jugadores = await db
    .select({
      id: schema.jugadores.id,
      nombre: schema.jugadores.nombre,
      apodo: schema.jugadores.apodo,
      categoria: schema.jugadoresTemporada.categoria,
      dorsal: schema.jugadoresTemporada.dorsal,
    })
    .from(schema.jugadoresTemporada)
    .innerJoin(schema.jugadores, eq(schema.jugadores.id, schema.jugadoresTemporada.jugadorId))
    .where(eq(schema.jugadoresTemporada.temporadaId, temporadaId))
    .orderBy(asc(schema.jugadoresTemporada.categoria), asc(schema.jugadores.nombre));
  const tecnicos = await db
    .select({
      id: schema.staff.id,
      nombre: schema.staff.nombre,
      categoria: schema.staffTemporada.categoria,
      cargo: schema.staffTemporada.cargo,
    })
    .from(schema.staffTemporada)
    .innerJoin(schema.staff, eq(schema.staff.id, schema.staffTemporada.staffId))
    .where(
      and(
        eq(schema.staffTemporada.temporadaId, temporadaId),
        eq(schema.staffTemporada.tipo, "tecnico"),
      ),
    )
    .orderBy(asc(schema.staff.nombre));

  const lista = new Map<string, PersonaMulta>();
  for (const j of jugadores) {
    const clave = `jugador:${j.id}`;
    if (lista.has(clave)) continue;
    lista.set(clave, {
      clave,
      tipo: "jugador",
      id: j.id,
      nombre: j.apodo?.trim() ? `${j.nombre} (${j.apodo.trim()})` : j.nombre,
      detalle: `${j.categoria}${j.dorsal === null ? "" : ` · ${j.dorsal}`}`,
      adestrador: false,
    });
  }
  for (const t of tecnicos) {
    const clave = `staff:${t.id}`;
    if (lista.has(clave)) continue;
    lista.set(clave, {
      clave,
      tipo: "staff",
      id: t.id,
      nombre: t.nombre,
      detalle: [t.categoria, t.cargo].filter(Boolean).join(" · "),
      adestrador: true,
    });
  }
  return [...lista.values()];
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
      return { temporada: null, conceptos: await conceptos(db), personas: [], multas: [] };
    }
    return {
      temporada,
      conceptos: await conceptos(db),
      personas: await personas(db, temporada.id),
      multas: await multasDe(db, temporada.id),
    };
  });
}

export interface NuevaMulta {
  /** `jugador:<id>` o `staff:<id>`. */
  personaClave: string;
  conceptoId: string;
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
  const [concepto] = await db
    .select(COLUMNAS_CONCEPTO)
    .from(schema.multasConceptos)
    .where(eq(schema.multasConceptos.id, entrada.conceptoId));
  if (!concepto) return fallo("Elige el motivo de la multa.");
  const gente = await personas(db, temporada.id);
  const persona = gente.find((p) => p.clave === entrada.personaClave);
  if (!persona) return fallo("Esa persona no está en la plantilla de esta temporada.");

  const aMano = entrada.importeCentimos;
  if (aMano !== undefined && aMano !== null && !(Number.isInteger(aMano) && aMano > 0)) {
    return fallo("El importe no es válido.");
  }
  const elegidas = (entrada.opciones ?? []).filter((o) => concepto.opciones.includes(o));
  const unidades = unidadesDe(concepto, entrada.unidades, elegidas);
  const importeCentimos = aMano ?? importeDeMulta(concepto, unidades, persona.adestrador);

  return capturar("No se pudo guardar la multa.", async () => {
    await db.insert(schema.multas).values({
      temporadaId: temporada.id,
      jugadorId: tipo === "jugador" ? personaId : null,
      staffId: tipo === "staff" ? personaId : null,
      concepto: textoDeConcepto(concepto, unidades, elegidas),
      importeCentimos,
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
      opciones: entrada.porUnidad ? [...new Set((entrada.opciones ?? []).map((o) => o.trim()))].filter(Boolean) : [],
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
