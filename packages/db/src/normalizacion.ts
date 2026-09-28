import type { InStatement, Transaction } from "@libsql/client";
import {
  claveNombre,
  normalizarCampo,
  normalizarNombreCompeticion,
  normalizarNombreEquipo,
  normalizarNombrePersona,
} from "@santiso/domain";

/**
 * Deja con texto uniforme lo que hay en la base: equipos, competiciones, campos y personas
 * (reglas en `@santiso/domain/normalizar`). Los campos que quedan con el mismo nombre son el
 * mismo campo escrito de dos formas: se juntan en uno y sus partidos pasan a él.
 * Se ejecuta dentro de la transacción de quien llama.
 */

export interface Cambio {
  antes: string;
  despues: string;
}

export interface InformeNormalizacion {
  equipos: Cambio[];
  competiciones: Cambio[];
  campos: Cambio[];
  /** Campos juntados: los de `juntados` desaparecen y sus partidos pasan a `queda`. */
  camposJuntados: { queda: string; juntados: string[] }[];
  personas: Cambio[];
  /** Cambios que no se aplican porque chocarían con otro registro. */
  conflictos: string[];
}

type Ejecutor = Pick<Transaction, "execute">;

async function filas<T>(tx: Ejecutor, sentencia: InStatement): Promise<T[]> {
  return (await tx.execute(sentencia)).rows as unknown as T[];
}

const conPoblacion = (nombre: string, poblacion: string | null) =>
  poblacion ? `${nombre} (${poblacion})` : nombre;

export async function normalizarEnTransaccion(tx: Ejecutor): Promise<InformeNormalizacion> {
  const informe: InformeNormalizacion = {
    equipos: [],
    competiciones: [],
    campos: [],
    camposJuntados: [],
    personas: [],
    conflictos: [],
  };

  // Equipos: la clave es única por categoría; si el nombre nuevo choca, no se toca.
  const equipos = await filas<{ id: string; nombre: string; categoria: string; clave: string }>(
    tx,
    {
      sql: "select id, nombre, categoria, clave from equipos order by categoria, nombre",
    },
  );
  const ocupadas = new Set(equipos.map((e) => `${e.categoria}|${e.clave}`));
  for (const e of equipos) {
    const nombre = normalizarNombreEquipo(e.nombre, e.categoria);
    if (nombre === e.nombre) continue;
    const clave = claveNombre(nombre);
    if (clave !== e.clave && ocupadas.has(`${e.categoria}|${clave}`)) {
      informe.conflictos.push(
        `Equipo «${e.nombre}» → «${nombre}»: ya existe otro con ese nombre en ${e.categoria}.`,
      );
      continue;
    }
    ocupadas.delete(`${e.categoria}|${e.clave}`);
    ocupadas.add(`${e.categoria}|${clave}`);
    await tx.execute({
      sql: "update equipos set nombre = ?, clave = ? where id = ?",
      args: [nombre, clave, e.id],
    });
    informe.equipos.push({ antes: e.nombre, despues: nombre });
  }

  // Competiciones: el nombre antiguo queda como alias, que es como lo traen actas y PDF.
  const competiciones = await filas<{ id: string; nombre: string }>(tx, {
    sql: "select id, nombre from competiciones order by nombre",
  });
  for (const c of competiciones) {
    const nombre = normalizarNombreCompeticion(c.nombre);
    if (nombre === c.nombre) continue;
    await tx.execute({
      sql: "update competiciones set nombre = ? where id = ?",
      args: [nombre, c.id],
    });
    await tx.execute({
      sql: "insert into competicion_alias (competicion_id, alias, clave) values (?, ?, ?) on conflict do nothing",
      args: [c.id, c.nombre, claveNombre(c.nombre)],
    });
    informe.competiciones.push({ antes: c.nombre, despues: nombre });
  }

  // Campos: se agrupan por el nombre normalizado. En cada grupo se queda el que ya tenía
  // población, luego el que la gana al normalizar y, a igualdad, el que más partidos tiene.
  const campos = await filas<{
    id: string;
    nombre: string;
    poblacion: string | null;
    usos: number;
  }>(tx, {
    sql: `select c.id, c.nombre, c.poblacion, (select count(*) from partidos p where p.campo_id = c.id) usos
      from campos c order by c.nombre`,
  });
  const grupos = new Map<
    string,
    { campo: (typeof campos)[number]; nuevo: ReturnType<typeof normalizarCampo> }[]
  >();
  for (const c of campos) {
    const nuevo = normalizarCampo(c.nombre, c.poblacion);
    const clave = claveNombre(nuevo.nombre);
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave)!.push({ campo: c, nuevo });
  }
  for (const [clave, grupo] of grupos) {
    grupo.sort(
      (a, b) =>
        // Primero la población escrita a mano, que suele ser más completa.
        Number(Boolean(b.campo.poblacion)) - Number(Boolean(a.campo.poblacion)) ||
        Number(Boolean(b.nuevo.poblacion)) - Number(Boolean(a.nuevo.poblacion)) ||
        Number(b.campo.usos) - Number(a.campo.usos),
    );
    const [queda, ...resto] = grupo;
    if (!queda) continue;
    for (const r of resto) {
      await tx.execute({
        sql: "update partidos set campo_id = ? where campo_id = ?",
        args: [queda.campo.id, r.campo.id],
      });
      await tx.execute({ sql: "delete from campos where id = ?", args: [r.campo.id] });
    }
    if (resto.length) {
      informe.camposJuntados.push({
        queda: conPoblacion(queda.nuevo.nombre, queda.nuevo.poblacion),
        juntados: resto.map((r) => conPoblacion(r.campo.nombre, r.campo.poblacion)),
      });
    }
    const antes = conPoblacion(queda.campo.nombre, queda.campo.poblacion);
    const despues = conPoblacion(queda.nuevo.nombre, queda.nuevo.poblacion);
    await tx.execute({
      sql: "update campos set nombre = ?, poblacion = ?, clave = ? where id = ?",
      args: [queda.nuevo.nombre, queda.nuevo.poblacion, clave, queda.campo.id],
    });
    if (antes !== despues) informe.campos.push({ antes, despues });
  }

  // Personas: solo nombres sin cuidar (todo mayúsculas o minúsculas).
  for (const tabla of ["jugadores", "staff"] as const) {
    const personas = await filas<{ id: string; nombre: string }>(tx, {
      sql: `select id, nombre from ${tabla} order by nombre`,
    });
    for (const p of personas) {
      const nombre = normalizarNombrePersona(p.nombre);
      if (nombre === p.nombre) continue;
      await tx.execute({
        sql: `update ${tabla} set nombre = ? where id = ?`,
        args: [nombre, p.id],
      });
      informe.personas.push({ antes: p.nombre, despues: nombre });
    }
  }
  return informe;
}

export function normalizacionEnMarkdown(informe: InformeNormalizacion): string {
  const tabla = (titulo: string, cambios: Cambio[]) =>
    [
      `### ${titulo} (${cambios.length})`,
      "",
      ...(cambios.length
        ? [
            "| Antes | Después |",
            "|---|---|",
            ...cambios.map((c) => `| ${c.antes} | ${c.despues} |`),
          ]
        : ["_Sin cambios._"]),
      "",
    ].join("\n");
  return [
    "## Textos normalizados",
    "",
    tabla("Equipos", informe.equipos),
    tabla("Competiciones", informe.competiciones),
    tabla("Campos", informe.campos),
    `### Campos juntados (${informe.camposJuntados.length})`,
    "",
    informe.camposJuntados.length
      ? informe.camposJuntados.map((j) => `- ${j.juntados.join(", ")} → **${j.queda}**`).join("\n")
      : "_Ninguno._",
    "",
    tabla("Personas", informe.personas),
    `### Conflictos (${informe.conflictos.length})`,
    "",
    informe.conflictos.length ? informe.conflictos.map((c) => `- ${c}`).join("\n") : "_Ninguno._",
    "",
  ].join("\n");
}
