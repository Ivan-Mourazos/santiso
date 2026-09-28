import { existsSync, mkdirSync, renameSync } from "node:fs";
import path from "node:path";
import type { Client, InStatement, Transaction } from "@libsql/client";
import {
  normalizacionEnMarkdown,
  normalizarEnTransaccion,
  type InformeNormalizacion,
} from "./normalizacion";

/**
 * Retira una temporada entera de la base de datos: sus competiciones con todo lo que cuelga de
 * ellas, las inscripciones de jugadores y staff, y lo que solo existía por ella (equipos, campos,
 * personas y fotos). Deja intactas las demás temporadas, salvo las inscripciones fantasma: un
 * equipo inscrito en una liga con calendario en la que no juega ningún partido.
 *
 * Todo ocurre en una transacción. En ensayo se deshace al final, así que el informe del ensayo
 * es exactamente lo que haría la limpieza de verdad.
 */

export interface InformeLimpieza {
  temporada: string;
  borrados: Record<string, number>;
  fantasmas: { equipo: string; competicion: string; temporada: string }[];
  huerfanos: { equipos: string[]; campos: string[]; jugadores: string[]; staff: string[] };
  /** Rutas relativas a `data/media` que dejan de usarse. Se mueven, no se borran. */
  media: string[];
  /** Lo que queda de las demás temporadas: igual antes y después. */
  resto: Record<string, number>;
  /** Solo con `normalizar`: textos corregidos tras la limpieza, en la misma transacción. */
  normalizacion?: InformeNormalizacion;
}

export interface OpcionesLimpieza {
  normalizar?: boolean;
}

async function todoEnTransaccion(tx: Ejecutor, temporada: string, opciones: OpcionesLimpieza) {
  const informe = await limpiarEnTransaccion(tx, temporada);
  if (opciones.normalizar) informe.normalizacion = await normalizarEnTransaccion(tx);
  return informe;
}

type Ejecutor = Pick<Transaction, "execute">;

async function filas<T>(tx: Ejecutor, sentencia: InStatement): Promise<T[]> {
  return (await tx.execute(sentencia)).rows as unknown as T[];
}

async function borrar(tx: Ejecutor, sentencia: InStatement): Promise<number> {
  return (await tx.execute(sentencia)).rowsAffected;
}

/** Recuento de lo que pertenece a las temporadas que no se tocan. */
async function contarResto(tx: Ejecutor, temporadaId: string) {
  const [f] = await filas<Record<string, number>>(tx, {
    sql: `select
      (select count(*) from competiciones where temporada_id <> :t) competiciones,
      (select count(*) from jornadas j join competiciones c on c.id = j.competicion_id where c.temporada_id <> :t) jornadas,
      (select count(*) from partidos p join jornadas j on j.id = p.jornada_id join competiciones c on c.id = j.competicion_id where c.temporada_id <> :t) partidos,
      (select count(*) from partido_eventos e join partidos p on p.id = e.partido_id join jornadas j on j.id = p.jornada_id join competiciones c on c.id = j.competicion_id where c.temporada_id <> :t) eventos,
      (select count(*) from partido_participaciones x join partidos p on p.id = x.partido_id join jornadas j on j.id = p.jornada_id join competiciones c on c.id = j.competicion_id where c.temporada_id <> :t) convocatorias,
      (select count(*) from jugadores_temporada where temporada_id <> :t) jugadores_temporada,
      (select count(*) from staff_temporada where temporada_id <> :t) staff_temporada`,
    args: { t: temporadaId },
  });
  return Object.fromEntries(Object.entries(f ?? {}).map(([k, v]) => [k, Number(v)]));
}

async function limpiarEnTransaccion(
  tx: Ejecutor,
  temporadaNombre: string,
): Promise<InformeLimpieza> {
  const [temporada] = await filas<{ id: string; activa: number }>(tx, {
    sql: "select id, activa from temporadas where nombre = ?",
    args: [temporadaNombre],
  });
  if (!temporada) throw new Error(`No existe la temporada ${temporadaNombre}.`);
  if (temporada.activa) throw new Error(`${temporadaNombre} es la temporada activa: no se retira.`);
  const t = temporada.id;

  // Candidatos a huérfanos: lo que la temporada usaba. Solo eso puede borrarse después.
  const idsDe = async (sentencia: string) =>
    (await filas<{ id: string }>(tx, { sql: sentencia, args: { t } })).map((r) => r.id);
  const deTemporada = `select p.id from partidos p join jornadas j on j.id = p.jornada_id
    join competiciones c on c.id = j.competicion_id where c.temporada_id = :t`;
  const equiposCandidatos = new Set(
    await idsDe(`select equipo_local_id id from partidos where id in (${deTemporada})
      union select equipo_visitante_id from partidos where id in (${deTemporada})
      union select ce.equipo_id from competicion_equipos ce join competiciones c on c.id = ce.competicion_id where c.temporada_id = :t
      union select d.equipo_id from jornada_descansos d join jornadas j on j.id = d.jornada_id join competiciones c on c.id = j.competicion_id where c.temporada_id = :t
      union select a.equipo_id from clasificacion_ajustes a join competiciones c on c.id = a.competicion_id where c.temporada_id = :t`),
  );
  const camposCandidatos = await idsDe(
    `select distinct campo_id id from partidos where id in (${deTemporada}) and campo_id is not null`,
  );
  // De quién era casa cada campo (ver la regla de campos huérfanos, más abajo).
  const localesPorCampo = new Map<string, Set<string>>();
  for (const f of await filas<{ campo: string; local: string }>(tx, {
    sql: `select distinct campo_id campo, equipo_local_id local from partidos
      where id in (${deTemporada}) and campo_id is not null`,
    args: { t },
  })) {
    if (!localesPorCampo.has(f.campo)) localesPorCampo.set(f.campo, new Set());
    localesPorCampo.get(f.campo)!.add(f.local);
  }
  const jugadoresCandidatos = await idsDe(
    `select jugador_id id from jugadores_temporada where temporada_id = :t
     union select jugador_id from partido_participaciones where partido_id in (${deTemporada})
     union select jugador_id from partido_eventos where partido_id in (${deTemporada}) and jugador_id is not null
     union select jugador_sale_id from partido_eventos where partido_id in (${deTemporada}) and jugador_sale_id is not null`,
  );
  const staffCandidatos = await idsDe(
    `select staff_id id from staff_temporada where temporada_id = :t`,
  );
  // Ficheros de media que usaban las filas que se van.
  const mediaCandidata = new Set(
    (
      await filas<{ ruta: string | null }>(tx, {
        sql: `select foto ruta from jugadores_temporada where temporada_id = :t
          union select foto from staff_temporada where temporada_id = :t`,
        args: { t },
      })
    )
      .map((r) => r.ruta)
      .filter((r): r is string => Boolean(r)),
  );

  const restoAntes = await contarResto(tx, t);

  // Inscripciones fantasma en las demás temporadas: liga con calendario, equipo sin partidos.
  const fantasmas = await filas<{
    competicion_id: string;
    equipo_id: string;
    equipo: string;
    competicion: string;
    temporada: string;
  }>(tx, {
    sql: `select ce.competicion_id, ce.equipo_id, e.nombre equipo, c.nombre competicion, tp.nombre temporada
      from competicion_equipos ce
      join competiciones c on c.id = ce.competicion_id
      join temporadas tp on tp.id = c.temporada_id
      join equipos e on e.id = ce.equipo_id
      where c.temporada_id <> :t and c.formato = 'liga' and e.es_propio = 0
        and exists (select 1 from partidos p join jornadas j on j.id = p.jornada_id where j.competicion_id = c.id)
        and not exists (select 1 from partidos p join jornadas j on j.id = p.jornada_id
          where j.competicion_id = c.id and (p.equipo_local_id = e.id or p.equipo_visitante_id = e.id))
      order by tp.nombre, c.nombre, e.nombre`,
    args: { t },
  });
  for (const f of fantasmas) {
    await borrar(tx, {
      sql: "delete from competicion_equipos where competicion_id = ? and equipo_id = ?",
      args: [f.competicion_id, f.equipo_id],
    });
    equiposCandidatos.add(f.equipo_id);
  }

  const borrados: Record<string, number> = {};
  const deCompeticiones = "select id from competiciones where temporada_id = :t";
  const deJornadas = `select id from jornadas where competicion_id in (${deCompeticiones})`;
  const pasos: [string, string][] = [
    ["eventos", `delete from partido_eventos where partido_id in (${deTemporada})`],
    ["convocatorias", `delete from partido_participaciones where partido_id in (${deTemporada})`],
    ["descansos", `delete from jornada_descansos where jornada_id in (${deJornadas})`],
    ["partidos", `delete from partidos where jornada_id in (${deJornadas})`],
    ["jornadas", `delete from jornadas where competicion_id in (${deCompeticiones})`],
    ["alias", `delete from competicion_alias where competicion_id in (${deCompeticiones})`],
    [
      "ajustes_clasificacion",
      `delete from clasificacion_ajustes where competicion_id in (${deCompeticiones})`,
    ],
    [
      "inscripciones_equipos",
      `delete from competicion_equipos where competicion_id in (${deCompeticiones})`,
    ],
    ["competiciones", `delete from competiciones where temporada_id = :t`],
    ["jugadores_temporada", `delete from jugadores_temporada where temporada_id = :t`],
    ["staff_temporada", `delete from staff_temporada where temporada_id = :t`],
    ["temporada", `delete from temporadas where id = :t`],
  ];
  for (const [nombre, sentencia] of pasos) {
    borrados[nombre] = await borrar(tx, { sql: sentencia, args: { t } });
  }

  // Huérfanos: candidatos que ya no usa nada. Los equipos del club no se tocan nunca.
  const enLista = (ids: readonly string[]) => ids.map(() => "?").join(", ") || "null";
  const equiposIds = [...equiposCandidatos];
  const equiposHuerfanos = await filas<{ id: string; nombre: string; escudo: string | null }>(tx, {
    sql: `select id, nombre, escudo from equipos e where id in (${enLista(equiposIds)}) and es_propio = 0
      and not exists (select 1 from partidos p where p.equipo_local_id = e.id or p.equipo_visitante_id = e.id)
      and not exists (select 1 from competicion_equipos ce where ce.equipo_id = e.id)
      and not exists (select 1 from jornada_descansos d where d.equipo_id = e.id)
      and not exists (select 1 from clasificacion_ajustes a where a.equipo_id = e.id)
      order by nombre`,
    args: equiposIds,
  });
  // Un campo viejo solo se queda si su equipo sigue y aún no tiene campo de casa en lo que
  // queda: si ya lo tiene (a menudo el mismo campo con otro nombre), el viejo sería un duplicado.
  const equiposQueSeVan = new Set(equiposHuerfanos.map((e) => e.id));
  const conCasa = new Set(
    (
      await filas<{ id: string }>(tx, {
        sql: "select distinct equipo_local_id id from partidos where campo_id is not null",
      })
    ).map((r) => r.id),
  );
  const sinDuenoQueSiga = camposCandidatos.filter((id) =>
    [...(localesPorCampo.get(id) ?? [])].every(
      (local) => equiposQueSeVan.has(local) || conCasa.has(local),
    ),
  );
  const camposHuerfanos = await filas<{ id: string; nombre: string }>(tx, {
    sql: `select id, nombre from campos c where id in (${enLista(sinDuenoQueSiga)})
      and not exists (select 1 from partidos p where p.campo_id = c.id) order by nombre`,
    args: sinDuenoQueSiga,
  });
  const jugadoresHuerfanos = await filas<{ id: string; nombre: string }>(tx, {
    sql: `select id, nombre from jugadores j where id in (${enLista(jugadoresCandidatos)})
      and not exists (select 1 from jugadores_temporada x where x.jugador_id = j.id)
      and not exists (select 1 from partido_participaciones x where x.jugador_id = j.id)
      and not exists (select 1 from partido_eventos x where x.jugador_id = j.id or x.jugador_sale_id = j.id)
      order by nombre`,
    args: jugadoresCandidatos,
  });
  const staffHuerfano = await filas<{ id: string; nombre: string }>(tx, {
    sql: `select id, nombre from staff s where id in (${enLista(staffCandidatos)})
      and not exists (select 1 from staff_temporada x where x.staff_id = s.id) order by nombre`,
    args: staffCandidatos,
  });
  const quitar = async (tabla: string, ids: string[]) =>
    ids.length
      ? borrar(tx, { sql: `delete from ${tabla} where id in (${enLista(ids)})`, args: ids })
      : 0;
  borrados.equipos = await quitar(
    "equipos",
    equiposHuerfanos.map((e) => e.id),
  );
  borrados.campos = await quitar(
    "campos",
    camposHuerfanos.map((c) => c.id),
  );
  borrados.jugadores = await quitar(
    "jugadores",
    jugadoresHuerfanos.map((j) => j.id),
  );
  borrados.staff = await quitar(
    "staff",
    staffHuerfano.map((s) => s.id),
  );
  for (const e of equiposHuerfanos) if (e.escudo) mediaCandidata.add(e.escudo);

  // Media: solo se mueve lo que ya no nombra ninguna fila ni ningún ajuste.
  const enUso = new Set(
    (
      await filas<{ ruta: string | null }>(tx, {
        sql: `select escudo ruta from equipos union select foto from jugadores_temporada
          union select foto from staff_temporada union select logo from patrocinadores`,
      })
    )
      .map((r) => r.ruta)
      .filter((r): r is string => Boolean(r)),
  );
  const ajustes = (await filas<{ valor: string }>(tx, { sql: "select valor from ajustes" }))
    .map((a) => String(a.valor))
    .join("\n");
  const media = [...mediaCandidata]
    .filter((ruta) => !enUso.has(ruta) && !ajustes.includes(ruta))
    .sort();

  const resto = await contarResto(tx, t);
  for (const [clave, valor] of Object.entries(restoAntes)) {
    if (resto[clave] !== valor) {
      throw new Error(`Se iba a tocar otra temporada (${clave}: ${valor} → ${resto[clave]}).`);
    }
  }

  return {
    temporada: temporadaNombre,
    borrados,
    fantasmas: fantasmas.map(({ equipo, competicion, temporada: nombre }) => ({
      equipo,
      competicion,
      temporada: nombre,
    })),
    huerfanos: {
      equipos: equiposHuerfanos.map((e) => e.nombre),
      campos: camposHuerfanos.map((c) => c.nombre),
      jugadores: jugadoresHuerfanos.map((j) => j.nombre),
      staff: staffHuerfano.map((s) => s.nombre),
    },
    media,
    resto,
  };
}

/** Calcula la limpieza y la deshace: no cambia nada. */
export async function ensayarLimpieza(
  cliente: Client,
  temporada: string,
  opciones: OpcionesLimpieza = {},
): Promise<InformeLimpieza> {
  const tx = await cliente.transaction("write");
  try {
    return await todoEnTransaccion(tx, temporada, opciones);
  } finally {
    await tx.rollback();
    tx.close();
  }
}

/**
 * Aplica la limpieza y mueve la media que sobra a `dirArchivoMedia`. La copia de seguridad la
 * hace quien llama, antes: aquí no se comprueba.
 */
export async function aplicarLimpieza(
  cliente: Client,
  temporada: string,
  dirMedia: string,
  dirArchivoMedia: string,
  opciones: OpcionesLimpieza = {},
): Promise<InformeLimpieza> {
  const tx = await cliente.transaction("write");
  let informe: InformeLimpieza;
  try {
    informe = await todoEnTransaccion(tx, temporada, opciones);
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
  for (const ruta of informe.media) {
    const origen = path.join(dirMedia, ruta);
    if (!existsSync(origen)) continue;
    const destino = path.join(dirArchivoMedia, ruta);
    mkdirSync(path.dirname(destino), { recursive: true });
    renameSync(origen, destino);
  }
  await cliente.execute("VACUUM");
  return informe;
}

/** El informe en Markdown, para `data/informes`. */
export function informeEnMarkdown(informe: InformeLimpieza, aplicado: boolean): string {
  const lista = (titulo: string, valores: string[]) =>
    `### ${titulo} (${valores.length})\n\n${valores.length ? valores.map((v) => `- ${v}`).join("\n") : "_Ninguno._"}\n`;
  return [
    `# Limpieza de la temporada ${informe.temporada} — ${aplicado ? "APLICADA" : "ensayo (no se ha cambiado nada)"}`,
    "",
    "## Filas que se borran",
    "",
    "| Qué | Filas |",
    "|---|---|",
    ...Object.entries(informe.borrados).map(([k, v]) => `| ${k} | ${v} |`),
    "",
    "## Inscripciones fantasma que se quitan (otras temporadas)",
    "",
    informe.fantasmas.length
      ? informe.fantasmas.map((f) => `- ${f.equipo} — ${f.competicion} (${f.temporada})`).join("\n")
      : "_Ninguna._",
    "",
    "## Lo que solo existía por esta temporada",
    "",
    lista("Equipos", informe.huerfanos.equipos),
    lista("Campos", informe.huerfanos.campos),
    lista("Jugadores", informe.huerfanos.jugadores),
    lista("Staff", informe.huerfanos.staff),
    lista("Ficheros de media que se archivan", informe.media),
    "## Lo que queda de las demás temporadas (sin cambios)",
    "",
    ...Object.entries(informe.resto).map(([k, v]) => `- ${k}: ${v}`),
    "",
    informe.normalizacion ? normalizacionEnMarkdown(informe.normalizacion) : "",
  ].join("\n");
}
