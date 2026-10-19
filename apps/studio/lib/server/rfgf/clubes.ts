import "server-only";

import { schema } from "@santiso/db";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  emparejarClubes,
  parsearClubesExcel,
  urlClubesExcel,
  type ClubRfgf,
} from "@/lib/rfgf/clubes";
import { coloresDeEquipacion } from "@/lib/rfgf/colores";
import { obtenerDb } from "@/lib/server/db";
import { AVISO_RFGF_OCUPADA, conCandadoRfgf } from "./candado";
import type { DescargadorRfgf } from "./descargador";

/** Cada cuánto se vuelve a bajar el listado de clubes: cambia muy poco. */
export const DIAS_ENTRE_CLUBES = 7;

/** ¿Toca bajar otra vez el listado? Nunca bajado, o hace una semana o más. */
export function tocaTraerClubes(ultimo: string | null, ahora: Date): boolean {
  if (!ultimo) return true;
  const antes = Date.parse(ultimo);
  return !Number.isFinite(antes) || ahora.getTime() - antes >= DIAS_ENTRE_CLUBES * 86_400_000;
}

export interface ClubCandidato {
  codigo: string;
  nombre: string;
  localidad: string | null;
}

export interface EquipoPorEnlazar {
  equipoId: string;
  nombre: string;
  categoria: string;
  candidatos: ClubCandidato[];
}

export interface ResumenClubesRfgf {
  /** Clubes leídos del listado; 0 si no se llegó a pedir. */
  clubes: number;
  /** Equipos enlazados ahora con su club. */
  enlazados: number;
  /** Equipos a los que se les pusieron los colores de su equipación. */
  colores: number;
  /** Los que tienen donde elegir: se enlazan a mano. */
  dudosos: EquipoPorEnlazar[];
  avisos: string[];
}

/** Guarda (o pone al día) los clubes del listado. Los que ya no salen se quedan como estaban. */
export async function guardarClubes(clubes: readonly ClubRfgf[], ahora: Date): Promise<void> {
  const { db } = await obtenerDb();
  const leidoEn = ahora.toISOString();
  // Por tandas: el listado completo trae cientos de clubes.
  for (let i = 0; i < clubes.length; i += 200) {
    const tanda = clubes.slice(i, i + 200).map((club) => ({ ...club, leidoEn }));
    await db
      .insert(schema.rfgfClubes)
      .values(tanda)
      .onConflictDoUpdate({
        target: schema.rfgfClubes.codigo,
        set: {
          nombre: sql`excluded.nombre`,
          clave: sql`excluded.clave`,
          delegacion: sql`excluded.delegacion`,
          comarca: sql`excluded.comarca`,
          direccion: sql`excluded.direccion`,
          localidad: sql`excluded.localidad`,
          provincia: sql`excluded.provincia`,
          codigoPostal: sql`excluded.codigo_postal`,
          fechaFundacion: sql`excluded.fecha_fundacion`,
          fechaInscripcionFederacion: sql`excluded.fecha_inscripcion_federacion`,
          camiseta: sql`excluded.camiseta`,
          pantalon: sql`excluded.pantalon`,
          medias: sql`excluded.medias`,
          numeroEquipos: sql`excluded.numero_equipos`,
          leidoEn,
        },
      });
  }
}

/**
 * Pone a cada equipo enlazado los colores de su equipación, solo si no tiene colores o si los
 * que tiene ya salieron de la federación. Los puestos a mano no se tocan. Devuelve cuántos cambió.
 */
export async function aplicarColoresDeClub(equipoIds?: readonly string[]): Promise<number> {
  const { db } = await obtenerDb();
  const filas = await db
    .select({
      id: schema.equipos.id,
      color: schema.equipos.color,
      color2: schema.equipos.color2,
      colorFederacion: schema.equipos.colorFederacion,
      camiseta: schema.rfgfClubes.camiseta,
      pantalon: schema.rfgfClubes.pantalon,
    })
    .from(schema.equipos)
    .innerJoin(schema.rfgfClubes, eq(schema.rfgfClubes.codigo, schema.equipos.clubCodigo))
    .where(equipoIds ? inArray(schema.equipos.id, [...equipoIds]) : undefined);
  let cambiados = 0;
  for (const fila of filas) {
    if (fila.color && !fila.colorFederacion) continue;
    const colores = coloresDeEquipacion(fila);
    if (!colores || (colores.color === fila.color && colores.color2 === fila.color2)) continue;
    await db
      .update(schema.equipos)
      .set({ ...colores, colorFederacion: true })
      .where(eq(schema.equipos.id, fila.id));
    cambiados++;
  }
  return cambiados;
}

/** Los clubes candidatos, con lo justo para elegir. */
async function candidatos(codigos: readonly string[]): Promise<ClubCandidato[]> {
  if (!codigos.length) return [];
  const { db } = await obtenerDb();
  const filas = await db
    .select({
      codigo: schema.rfgfClubes.codigo,
      nombre: schema.rfgfClubes.nombre,
      localidad: schema.rfgfClubes.localidad,
    })
    .from(schema.rfgfClubes)
    .where(inArray(schema.rfgfClubes.codigo, [...codigos]));
  return codigos.flatMap((codigo) => filas.filter((f) => f.codigo === codigo));
}

/**
 * Empareja con su club los equipos que aún no lo tienen (y que nadie dejó sin club a mano).
 * Enlaza los inequívocos, les pone colores y devuelve los dudosos para elegir.
 */
export async function enlazarEquiposConClubes(): Promise<{
  enlazados: number;
  colores: number;
  dudosos: EquipoPorEnlazar[];
}> {
  const { db } = await obtenerDb();
  const equipos = await db
    .select({
      id: schema.equipos.id,
      nombre: schema.equipos.nombre,
      categoria: schema.equipos.categoria,
    })
    .from(schema.equipos)
    .where(and(isNull(schema.equipos.clubCodigo), eq(schema.equipos.clubManual, false)))
    .orderBy(asc(schema.equipos.categoria), asc(schema.equipos.nombre));
  if (!equipos.length) return { enlazados: 0, colores: 0, dudosos: [] };
  const clubes = await db
    .select({ codigo: schema.rfgfClubes.codigo, nombre: schema.rfgfClubes.nombre })
    .from(schema.rfgfClubes);
  const { enlazados, dudosos } = emparejarClubes(equipos, clubes);
  for (const enlace of enlazados) {
    await db
      .update(schema.equipos)
      .set({ clubCodigo: enlace.codigo })
      .where(and(eq(schema.equipos.id, enlace.equipoId), isNull(schema.equipos.clubCodigo)));
  }
  const colores = enlazados.length
    ? await aplicarColoresDeClub(enlazados.map((e) => e.equipoId))
    : 0;
  const salida: EquipoPorEnlazar[] = [];
  for (const duda of dudosos) {
    const equipo = equipos.find((e) => e.id === duda.equipoId)!;
    salida.push({
      equipoId: equipo.id,
      nombre: equipo.nombre,
      categoria: equipo.categoria,
      candidatos: await candidatos(duda.candidatos),
    });
  }
  return { enlazados: enlazados.length, colores, dudosos: salida };
}

/** Los equipos sin club que tienen candidatos, para elegir a mano. No escribe nada. */
export async function equiposPorEnlazar(): Promise<EquipoPorEnlazar[]> {
  const { db } = await obtenerDb();
  const equipos = await db
    .select({
      id: schema.equipos.id,
      nombre: schema.equipos.nombre,
      categoria: schema.equipos.categoria,
    })
    .from(schema.equipos)
    .where(and(isNull(schema.equipos.clubCodigo), eq(schema.equipos.clubManual, false)))
    .orderBy(asc(schema.equipos.categoria), asc(schema.equipos.nombre));
  if (!equipos.length) return [];
  const clubes = await db
    .select({ codigo: schema.rfgfClubes.codigo, nombre: schema.rfgfClubes.nombre })
    .from(schema.rfgfClubes);
  const { enlazados, dudosos } = emparejarClubes(equipos, clubes);
  const salida: EquipoPorEnlazar[] = [];
  // Un inequívoco todavía sin enlazar (el listado llegó antes que el equipo) también se ofrece.
  for (const { equipoId, codigos } of [
    ...enlazados.map((e) => ({ equipoId: e.equipoId, codigos: [e.codigo] })),
    ...dudosos.map((d) => ({ equipoId: d.equipoId, codigos: d.candidatos })),
  ]) {
    const equipo = equipos.find((e) => e.id === equipoId)!;
    salida.push({
      equipoId,
      nombre: equipo.nombre,
      categoria: equipo.categoria,
      candidatos: await candidatos(codigos),
    });
  }
  return salida.sort(
    (a, b) => a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre, "es"),
  );
}

/**
 * Enlace elegido a mano. `null` deja al equipo sin club y así se queda: el emparejamiento
 * automático ya no lo toca. Con club, se le ponen sus colores si no los tiene puestos a mano.
 */
export async function elegirClubDeEquipo(equipoId: string, codigo: string | null): Promise<void> {
  const { db } = await obtenerDb();
  if (codigo) {
    const [club] = await db
      .select({ codigo: schema.rfgfClubes.codigo })
      .from(schema.rfgfClubes)
      .where(eq(schema.rfgfClubes.codigo, codigo));
    if (!club) throw new Error("Ese club no está en el listado de la federación.");
  }
  const cambiados = await db
    .update(schema.equipos)
    .set({ clubCodigo: codigo, clubManual: true })
    .where(eq(schema.equipos.id, equipoId))
    .returning({ id: schema.equipos.id });
  if (!cambiados.length) throw new Error("Ese equipo no existe.");
  if (codigo) await aplicarColoresDeClub([equipoId]);
}

/** Cuándo se leyó el listado por última vez, ISO; `null` si nunca. */
export async function ultimaLecturaClubes(): Promise<string | null> {
  const { db } = await obtenerDb();
  const [fila] = await db
    .select({ leidoEn: sql<string | null>`max(${schema.rfgfClubes.leidoEn})` })
    .from(schema.rfgfClubes);
  return fila?.leidoEn ?? null;
}

/**
 * Baja el listado de clubes de toda Galicia (una sola petición), lo guarda y empareja los
 * equipos. Comparte la reserva con el resto de operaciones con la federación.
 */
export async function traerClubes(
  descargador: DescargadorRfgf,
  ahora = new Date(),
): Promise<ResumenClubesRfgf> {
  const resultado = await conCandadoRfgf(async () => {
    const clubes = parsearClubesExcel(await descargador.html(urlClubesExcel()));
    if (!clubes.length) throw new Error("El listado de clubes llegó vacío.");
    await guardarClubes(clubes, ahora);
    const enlace = await enlazarEquiposConClubes();
    return { clubes: clubes.length, ...enlace, avisos: [] };
  });
  return (
    resultado ?? {
      clubes: 0,
      enlazados: 0,
      colores: 0,
      dudosos: [],
      avisos: [AVISO_RFGF_OCUPADA],
    }
  );
}

declare global {
  // Último intento del programador: un fallo no se repite en cada tic.
  var santisoClubesIntentoEn: number | undefined;
}

/** Para el programador: una vez por semana, y si falla, no antes de un día. */
export async function traerClubesSiToca(
  descargador: DescargadorRfgf,
  ahora = new Date(),
): Promise<ResumenClubesRfgf | null> {
  if (!tocaTraerClubes(await ultimaLecturaClubes(), ahora)) return null;
  const intento = globalThis.santisoClubesIntentoEn;
  if (intento && ahora.getTime() - intento < 86_400_000) return null;
  globalThis.santisoClubesIntentoEn = ahora.getTime();
  return traerClubes(descargador, ahora);
}
