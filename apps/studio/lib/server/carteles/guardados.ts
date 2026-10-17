import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { schema } from "@santiso/db";
import { aliasedTable, and, asc, eq, inArray } from "drizzle-orm";
import sharp from "sharp";
import { leerPeticion } from "@/lib/cartel2/esquema";
import type { FormatoCartel, PeticionCartel, Plantilla } from "@/lib/cartel2/modelo";
import { renderizarCartel } from "@/lib/server/cartel2/render";
import { exigirSesion, obtenerDb } from "@/lib/server/db";
import { resolverRutaMedia } from "@/lib/server/media";

export type PasoCartelPartido = schema.PasoCartelPartido;

/** Único catálogo de los formatos disponibles y de la plantilla técnica de cada paso. */
const PASOS: Record<
  PasoCartelPartido,
  { plantilla: Plantilla; formatos: readonly FormatoCartel[] }
> = {
  partido: { plantilla: "partido", formatos: ["publicacion", "historia"] },
  convocatoria: { plantilla: "convocatoria", formatos: ["publicacion"] },
  once: { plantilla: "alineacion", formatos: ["historia"] },
  resultado: { plantilla: "resultado", formatos: ["publicacion"] },
  cronoloxia: { plantilla: "cronoloxia", formatos: ["publicacion"] },
  noso11: { plantilla: "once", formatos: ["publicacion"] },
};

export function formatosDe(paso: PasoCartelPartido): readonly FormatoCartel[] {
  return PASOS[paso].formatos;
}

export class ErrorDatosCartel extends Error {
  constructor() {
    super("Datos del cartel no válidos para ese paso.");
  }
}

export class ErrorPartidoCartel extends Error {
  constructor() {
    super("El partido ya no existe.");
  }
}

/** Valida también el formato explícito antes de que zod quite campos ajenos a la plantilla. */
export function leerPeticionesPaso(paso: PasoCartelPartido, entrada: unknown): PeticionCartel[] {
  if (
    !Object.hasOwn(PASOS, paso) ||
    !Array.isArray(entrada) ||
    !entrada.length ||
    entrada.length > formatosDe(paso).length
  )
    throw new ErrorDatosCartel();
  const formatos = new Set<FormatoCartel>();
  return entrada.map((valor: unknown) => {
    const peticion = leerPeticion(valor);
    if (!peticion || peticion.plantilla !== PASOS[paso].plantilla) throw new ErrorDatosCartel();
    const formato = formatoDe(paso, peticion);
    const explicito = (valor as Record<string, unknown>).formato;
    if (
      (explicito !== undefined && explicito !== formato) ||
      !formatosDe(paso).includes(formato) ||
      formatos.has(formato)
    )
      throw new ErrorDatosCartel();
    formatos.add(formato);
    return peticion;
  });
}

function formatoDe(paso: PasoCartelPartido, peticion: PeticionCartel): FormatoCartel {
  return "formato" in peticion && peticion.formato ? peticion.formato : formatosDe(paso)[0]!;
}

/** Ordena claves, conserva el orden significativo de las listas y excluye marcas de tiempo. */
const comparar = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
function ordenado(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenado);
  if (valor !== null && typeof valor === "object")
    return Object.fromEntries(
      Object.entries(valor)
        .sort(([a], [b]) => comparar(a, b))
        .map(([k, v]) => [k, ordenado(v)]),
    );
  return valor;
}
const json = (valor: unknown) => JSON.stringify(ordenado(valor));
const hash = (valor: unknown) => createHash("sha256").update(json(valor)).digest("hex");
const listaEstable = <T>(filas: T[]): T[] => filas.sort((a, b) => comparar(json(a), json(b)));

function agrupar<T extends { partidoId: string }>(filas: T[]): Map<string, T[]> {
  const grupos = new Map<string, T[]>();
  for (const fila of filas) {
    const grupo = grupos.get(fila.partidoId) ?? [];
    grupo.push(fila);
    grupos.set(fila.partidoId, grupo);
  }
  return grupos;
}

/** Un lote de consultas, independiente del número de partidos. Nunca consulta dentro del map. */
async function huellasDe(ids: string[]): Promise<Map<string, Record<PasoCartelPartido, string>>> {
  const { db } = await obtenerDb();
  const local = aliasedTable(schema.equipos, "cartel_local");
  const visitante = aliasedTable(schema.equipos, "cartel_visitante");
  const partidos = await db
    .select({
      id: schema.partidos.id,
      fecha: schema.partidos.fecha,
      campo: schema.campos.nombre,
      poblacion: schema.campos.poblacion,
      local: local.nombre,
      localPropio: local.esPropio,
      visitante: visitante.nombre,
      visitantePropio: visitante.esPropio,
      competicion: schema.competiciones.nombre,
      categoria: schema.competiciones.categoria,
      temporadaId: schema.competiciones.temporadaId,
      jornada: schema.jornadas.numero,
      golesLocal: schema.partidos.golesLocal,
      golesVisitante: schema.partidos.golesVisitante,
    })
    .from(schema.partidos)
    .innerJoin(schema.jornadas, eq(schema.jornadas.id, schema.partidos.jornadaId))
    .innerJoin(schema.competiciones, eq(schema.competiciones.id, schema.jornadas.competicionId))
    .innerJoin(local, eq(local.id, schema.partidos.equipoLocalId))
    .innerJoin(visitante, eq(visitante.id, schema.partidos.equipoVisitanteId))
    .leftJoin(schema.campos, eq(schema.campos.id, schema.partidos.campoId))
    .where(inArray(schema.partidos.id, ids));
  if (!partidos.length) return new Map();
  const convocatorias = await db
    .select({
      partidoId: schema.partidoConvocatorias.partidoId,
      horaQuedada: schema.partidoConvocatorias.horaQuedada,
      lugarQuedada: schema.partidoConvocatorias.lugarQuedada,
      equipacion: schema.partidoConvocatorias.equipacion,
      nota: schema.partidoConvocatorias.nota,
    })
    .from(schema.partidoConvocatorias)
    .where(inArray(schema.partidoConvocatorias.partidoId, ids));
  const convocados = await db
    .select()
    .from(schema.partidoConvocados)
    .where(inArray(schema.partidoConvocados.partidoId, ids));
  const alineaciones = await db
    .select()
    .from(schema.partidoAlineaciones)
    .where(inArray(schema.partidoAlineaciones.partidoId, ids))
    .orderBy(asc(schema.partidoAlineaciones.orden), asc(schema.partidoAlineaciones.jugadorId));
  const participaciones = await db
    .select()
    .from(schema.partidoParticipaciones)
    .where(inArray(schema.partidoParticipaciones.partidoId, ids));
  const eventos = await db
    .select({
      partidoId: schema.partidoEventos.partidoId,
      tipo: schema.partidoEventos.tipo,
      lado: schema.partidoEventos.lado,
      propia: schema.partidoEventos.propia,
      minuto: schema.partidoEventos.minuto,
      jugadorId: schema.partidoEventos.jugadorId,
      jugadorSaleId: schema.partidoEventos.jugadorSaleId,
      nombreRival: schema.partidoEventos.nombreRival,
    })
    .from(schema.partidoEventos)
    .where(inArray(schema.partidoEventos.partidoId, ids));
  const jugadorIds = [
    ...new Set(
      [...convocados, ...alineaciones, ...participaciones, ...eventos]
        .flatMap((f) => [f.jugadorId, "jugadorSaleId" in f ? f.jugadorSaleId : null])
        .filter((id): id is string => !!id),
    ),
  ];
  const personas = jugadorIds.length
    ? await db
        .select({
          id: schema.jugadores.id,
          nombre: schema.jugadores.nombre,
          apodo: schema.jugadores.apodo,
        })
        .from(schema.jugadores)
        .where(inArray(schema.jugadores.id, jugadorIds))
    : [];
  const inscripciones = jugadorIds.length
    ? await db
        .select({
          jugadorId: schema.jugadoresTemporada.jugadorId,
          temporadaId: schema.jugadoresTemporada.temporadaId,
          categoria: schema.jugadoresTemporada.categoria,
          dorsal: schema.jugadoresTemporada.dorsal,
        })
        .from(schema.jugadoresTemporada)
        .where(
          and(
            inArray(schema.jugadoresTemporada.jugadorId, jugadorIds),
            inArray(schema.jugadoresTemporada.temporadaId, [
              ...new Set(partidos.map((p) => p.temporadaId)),
            ]),
          ),
        )
        .orderBy(asc(schema.jugadoresTemporada.categoria))
    : [];
  const nombres = new Map(personas.map((p) => [p.id, p.apodo || p.nombre]));
  const dorsales = new Map<string, typeof inscripciones>();
  for (const fila of inscripciones) {
    const clave = `${fila.temporadaId}/${fila.jugadorId}`;
    const grupo = dorsales.get(clave) ?? [];
    grupo.push(fila);
    dorsales.set(clave, grupo);
  }
  const convocatoriasPorPartido = new Map(
    convocatorias.map(({ partidoId, ...datos }) => [partidoId, datos]),
  );
  const convocadosPorPartido = agrupar(convocados);
  const alineacionesPorPartido = agrupar(alineaciones);
  const participacionesPorPartido = agrupar(participaciones);
  const eventosPorPartido = agrupar(eventos);
  return new Map(
    partidos.map((p) => {
      const base = {
        fecha: p.fecha,
        campo: p.campo,
        poblacion: p.poblacion,
        local: p.local,
        localPropio: p.localPropio,
        visitante: p.visitante,
        visitantePropio: p.visitantePropio,
        competicion: p.competicion,
        categoria: p.categoria,
        jornada: p.jornada,
      };
      const jugador = (id: string) => {
        const fichas = dorsales.get(`${p.temporadaId}/${id}`) ?? [];
        const propia = fichas.find((f) => f.categoria === p.categoria);
        return {
          nombre: nombres.get(id) ?? "",
          dorsal: propia?.dorsal ?? fichas.find((f) => f.dorsal !== null)?.dorsal ?? null,
        };
      };
      const convocatoria = {
        ...convocatoriasPorPartido.get(p.id),
        jugadores: listaEstable(
          (convocadosPorPartido.get(p.id) ?? []).map((f) => jugador(f.jugadorId)),
        ),
      };
      const alineacion = (alineacionesPorPartido.get(p.id) ?? []).map((f) => ({
        ...jugador(f.jugadorId),
        titular: f.titular,
        capitan: f.capitan,
      }));
      // El acta no guarda capitán por partido. La capitanía de la previa no es la del acta.
      const onceActa = listaEstable(
        (participacionesPorPartido.get(p.id) ?? []).map((f) => ({
          ...jugador(f.jugadorId),
          titular: f.titular,
        })),
      );
      const marcador = { golesLocal: p.golesLocal, golesVisitante: p.golesVisitante };
      const eventos = (eventosPorPartido.get(p.id) ?? []).map((f) => ({
        tipo: f.tipo,
        lado: f.lado,
        propia: f.propia,
        minuto: f.minuto,
        jugador: f.jugadorId ? nombres.get(f.jugadorId) : f.nombreRival,
        sale: f.jugadorSaleId ? nombres.get(f.jugadorSaleId) : null,
      }));
      // Resultado solo muestra goleadores y número de goles, nunca minutos ni tarjetas.
      const goles = listaEstable(
        eventos
          .filter((e) => e.tipo === "gol")
          .map((e) => ({ tipo: e.tipo, lado: e.lado, propia: e.propia, jugador: e.jugador })),
      );
      return [
        p.id,
        {
          partido: hash(base),
          convocatoria: hash({ base, convocatoria }),
          once: hash({ base, alineacion }),
          resultado: hash({ base, marcador, goles }),
          cronoloxia: hash({ base, marcador, eventos: listaEstable(eventos) }),
          noso11: hash({ base, jugadores: onceActa }),
        },
      ];
    }),
  );
}

export async function huellaPaso(partidoId: string, paso: PasoCartelPartido): Promise<string> {
  const huella = (await huellasDe([partidoId])).get(partidoId)?.[paso];
  if (!huella) throw new ErrorPartidoCartel();
  return huella;
}

function rutaDe(clave: string): string {
  const ruta = resolverRutaMedia(clave.split("/"));
  if (!ruta) throw new ErrorDatosCartel();
  return ruta;
}

/** Las fotos se deduplican por contenido; SVG se rasteriza porque /media no sirve SVG. */
async function guardarFotos(valor: unknown, partidoId: string): Promise<unknown> {
  if (typeof valor === "string" && valor.startsWith("data:image/")) {
    const m = /^data:image\/(png|jpeg|webp|gif|avif|svg\+xml)((?:;[^,]*)?),([\s\S]*)$/.exec(valor);
    if (!m) throw new ErrorDatosCartel();
    let bytes = m[2]!.split(";").includes("base64")
      ? Buffer.from(m[3]!, "base64")
      : Buffer.from(decodeURIComponent(m[3]!));
    let extension = m[1] === "jpeg" ? "jpg" : m[1]!;
    if (extension === "svg+xml") {
      bytes = await sharp(bytes).png().toBuffer();
      extension = "png";
    }
    const clave = `carteles/${partidoId}/fotos/${createHash("sha256").update(bytes).digest("hex")}.${extension}`;
    const ruta = rutaDe(clave);
    await mkdir(path.dirname(ruta), { recursive: true });
    await writeFile(ruta, bytes);
    return `/media/${clave}`;
  }
  if (Array.isArray(valor))
    return Promise.all(valor.map((v: unknown) => guardarFotos(v, partidoId)));
  if (valor !== null && typeof valor === "object") {
    const pares = [];
    for (const [k, v] of Object.entries(valor)) pares.push([k, await guardarFotos(v, partidoId)]);
    return Object.fromEntries(pares);
  }
  return valor;
}

async function borrarPng(clave: string): Promise<void> {
  try {
    await unlink(rutaDe(clave));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
      console.error("No se pudo borrar el PNG del cartel.", error);
  }
}

/** Todos los renders terminan antes de tocar media o las filas ya guardadas. */
export async function guardarCartelesPaso({
  partidoId,
  paso,
  peticiones: entrada,
  origen,
  sesion,
}: {
  partidoId: string;
  paso: PasoCartelPartido;
  peticiones: unknown;
  origen: string;
  sesion?: string;
}): Promise<void> {
  await exigirSesion();
  if (!resolverRutaMedia(["carteles", partidoId])) throw new ErrorDatosCartel();
  const peticiones = leerPeticionesPaso(paso, entrada);
  // Si los datos cambian mientras Chromium trabaja, la huella queda antigua y el estado lo avisa.
  const huella = await huellaPaso(partidoId, paso);
  const pngs = [];
  for (const peticion of peticiones) pngs.push(await renderizarCartel(origen, peticion, sesion));
  const generadoEn = new Date().toISOString();
  const nuevas: (typeof schema.cartelesPartido.$inferInsert)[] = [];
  try {
    for (const [i, peticion] of peticiones.entries()) {
      const formato = formatoDe(paso, peticion);
      const clave = `carteles/${partidoId}/${paso}-${formato}-${Date.now()}-${randomUUID()}.png`;
      const guardada = (await guardarFotos(peticion, partidoId)) as Record<string, unknown>;
      const ruta = rutaDe(clave);
      await mkdir(path.dirname(ruta), { recursive: true });
      nuevas.push({ partidoId, paso, formato, clave, huella, peticion: guardada, generadoEn });
      await writeFile(ruta, pngs[i]!);
    }
    const { db } = await obtenerDb();
    const anteriores = await db.transaction(async (tx) => {
      const anteriores = await tx
        .select({ clave: schema.cartelesPartido.clave })
        .from(schema.cartelesPartido)
        .where(
          and(
            eq(schema.cartelesPartido.partidoId, partidoId),
            eq(schema.cartelesPartido.paso, paso),
            inArray(
              schema.cartelesPartido.formato,
              nuevas.map((f) => f.formato),
            ),
          ),
        );
      for (const fila of nuevas)
        await tx
          .insert(schema.cartelesPartido)
          .values(fila)
          .onConflictDoUpdate({
            target: [
              schema.cartelesPartido.partidoId,
              schema.cartelesPartido.paso,
              schema.cartelesPartido.formato,
            ],
            set: {
              clave: fila.clave,
              huella: fila.huella,
              peticion: fila.peticion,
              generadoEn: fila.generadoEn,
            },
          });
      return anteriores;
    });
    for (const fila of anteriores) await borrarPng(fila.clave);
  } catch (error) {
    for (const fila of nuevas) await borrarPng(fila.clave);
    throw error;
  }
}

export interface CartelGuardado {
  formato: FormatoCartel;
  url: string;
  generadoEn: string;
  desactualizado: boolean;
}
export type CartelesDePartidos = Record<
  string,
  Partial<Record<PasoCartelPartido, CartelGuardado[]>>
>;

/** Lotes de 200 para no agotar los parámetros SQL, sin una consulta por partido. */
export async function cartelesDePartidos(
  partidoIds: readonly string[],
): Promise<CartelesDePartidos> {
  const salida: CartelesDePartidos = {};
  const ids = [...new Set(partidoIds)];
  if (!ids.length) return salida;
  const { db } = await obtenerDb();
  for (let i = 0; i < ids.length; i += 200) {
    const lote = ids.slice(i, i + 200);
    const filas = await db
      .select()
      .from(schema.cartelesPartido)
      .where(inArray(schema.cartelesPartido.partidoId, lote))
      .orderBy(asc(schema.cartelesPartido.formato));
    if (!filas.length) continue;
    const huellas = await huellasDe([...new Set(filas.map((f) => f.partidoId))]);
    for (const fila of filas) {
      const partido = (salida[fila.partidoId] ??= {});
      const paso = (partido[fila.paso] ??= []);
      paso.push({
        formato: fila.formato,
        url: `/media/${fila.clave}`,
        generadoEn: fila.generadoEn,
        desactualizado: fila.huella !== huellas.get(fila.partidoId)?.[fila.paso],
      });
    }
  }
  return salida;
}

/** Una petición por formato, en el orden de formatosDe; [] cuando aún no hay cartel. */
export async function peticionGuardada(
  partidoId: string,
  paso: PasoCartelPartido,
): Promise<PeticionCartel[]> {
  const { db } = await obtenerDb();
  const filas = await db
    .select({ peticion: schema.cartelesPartido.peticion, formato: schema.cartelesPartido.formato })
    .from(schema.cartelesPartido)
    .where(
      and(eq(schema.cartelesPartido.partidoId, partidoId), eq(schema.cartelesPartido.paso, paso)),
    );
  return formatosDe(paso).flatMap((formato) => {
    const fila = filas.find((f) => f.formato === formato);
    if (!fila) return [];
    const peticion = leerPeticion(fila.peticion);
    if (!peticion) throw new ErrorDatosCartel();
    return [peticion];
  });
}
