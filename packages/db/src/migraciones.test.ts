import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { abrirDb, type ConexionDb } from "./client";
import { dirMigraciones, migrarBd } from "./migraciones";

/**
 * La 0001 es la primera migración que se aplica sobre datos reales, y lleva un traspaso escrito
 * a mano. Aquí se monta una base de datos en el esquema 0000, se llena como la real y se migra.
 */

/** Carpeta de migraciones recortada a las `n` primeras, para dejar la BD en un punto concreto. */
function migracionesHasta(n: number): string {
  const origen = dirMigraciones();
  const destino = mkdtempSync(path.join(tmpdir(), "santiso-migr-"));
  mkdirSync(path.join(destino, "meta"));
  const diario = JSON.parse(readFileSync(path.join(origen, "meta", "_journal.json"), "utf8")) as {
    entries: { tag: string }[];
  };
  const entradas = diario.entries.slice(0, n);
  writeFileSync(
    path.join(destino, "meta", "_journal.json"),
    JSON.stringify({ ...diario, entries: entradas }),
  );
  for (const { tag } of entradas) {
    copyFileSync(path.join(origen, `${tag}.sql`), path.join(destino, `${tag}.sql`));
  }
  return destino;
}

let conexion: ConexionDb | null = null;
afterEach(() => {
  conexion?.cerrar();
  conexion = null;
});

async function sql(consulta: string, args: (string | number | null)[] = []) {
  if (!conexion) throw new Error("sin conexión");
  return (await conexion.cliente.execute({ sql: consulta, args })).rows;
}

describe("0001 plantillas por temporada", () => {
  it("reparte jugadores y staff por temporada sin perder nada", async () => {
    conexion = await abrirDb(":memory:");
    await migrarBd(conexion.db, migracionesHasta(1));

    // Tres temporadas; la activa es la última, como en la base de datos real.
    for (const [id, nombre, activa] of [
      ["t24", "2024/25", 0],
      ["t25", "2025/26", 0],
      ["t26", "2026/27", 1],
    ] as const) {
      await sql("insert into temporadas (id, nombre, activa) values (?, ?, ?)", [
        id,
        nombre,
        activa,
      ]);
      await sql(
        "insert into competiciones (id, temporada_id, categoria, nombre) values (?, ?, 'Senior', 'Liga')",
        [`c-${id}`, id],
      );
      await sql("insert into jornadas (id, competicion_id, numero) values (?, ?, 1)", [
        `j-${id}`,
        `c-${id}`,
      ]);
    }
    await sql(
      "insert into equipos (id, nombre, clave, categoria) values ('e1', 'A', 'a', 'Senior')",
    );
    await sql(
      "insert into equipos (id, nombre, clave, categoria) values ('e2', 'B', 'b', 'Senior')",
    );
    for (const t of ["t24", "t25"]) {
      await sql(
        "insert into partidos (id, jornada_id, equipo_local_id, equipo_visitante_id) values (?, ?, 'e1', 'e2')",
        [`p-${t}`, `j-${t}`],
      );
    }

    // Veterano: jugó en 2024/25 y 2025/26 → va a 2025/26, la última.
    // Retirado: solo en 2024/25 → se queda allí.
    // Fichaje: sin convocatorias → a la activa.
    await sql(
      `insert into jugadores (id, nombre, categoria, dorsal, posicion, capitania, foto)
       values ('veterano', 'Brais Rei', 'Senior', 9, 'DC', 1, 'jugadores/brais.webp')`,
    );
    await sql(
      "insert into jugadores (id, nombre, categoria, dorsal) values ('retirado', 'Lois Vello', 'Senior', 4)",
    );
    await sql(
      "insert into jugadores (id, nombre, categoria, dorsal) values ('fichaje', 'Xan Novo', 'Veteranos', 17)",
    );
    for (const [partido, jugador] of [
      ["p-t24", "veterano"],
      ["p-t25", "veterano"],
      ["p-t24", "retirado"],
    ]) {
      await sql(
        "insert into partido_participaciones (partido_id, jugador_id, titular, jugo) values (?, ?, 1, 1)",
        [partido!, jugador!],
      );
    }
    await sql(
      "insert into partido_eventos (id, partido_id, tipo, lado, jugador_id, minuto) values ('ev1', 'p-t25', 'gol', 'propio', 'veterano', 10)",
    );

    await sql(
      `insert into staff (id, nombre, cargo, tipo, categoria, orden, foto)
       values ('mister', 'Manuel Adestrador', 'Entrenador', 'tecnico', 'Senior', 10, 'staff/manuel.webp')`,
    );
    await sql(
      "insert into staff (id, nombre, cargo, tipo, orden) values ('presi', 'Presidenta', 'Presidenta', 'directiva', 20)",
    );

    // ─── Se aplica la 0001 ───
    await migrarBd(conexion.db, migracionesHasta(2));

    const inscripciones = await sql(
      "select jugador_id, temporada_id, categoria, dorsal, posicion, capitania, foto from jugadores_temporada order by jugador_id",
    );
    expect(inscripciones).toEqual([
      expect.objectContaining({
        jugador_id: "fichaje",
        temporada_id: "t26",
        categoria: "Veteranos",
        dorsal: 17,
      }),
      expect.objectContaining({ jugador_id: "retirado", temporada_id: "t24", dorsal: 4 }),
      expect.objectContaining({
        jugador_id: "veterano",
        temporada_id: "t25",
        categoria: "Senior",
        dorsal: 9,
        posicion: "DC",
        capitania: 1,
        foto: "jugadores/brais.webp",
      }),
    ]);

    const staff = await sql(
      "select staff_id, temporada_id, tipo, categoria, cargo, orden, foto from staff_temporada order by staff_id",
    );
    expect(staff).toEqual([
      expect.objectContaining({
        staff_id: "mister",
        temporada_id: "t25",
        tipo: "tecnico",
        categoria: "Senior",
        cargo: "Entrenador",
        orden: 10,
        foto: "staff/manuel.webp",
      }),
      expect.objectContaining({
        staff_id: "presi",
        temporada_id: "t25",
        tipo: "directiva",
        categoria: null,
      }),
    ]);

    // Ids distintos y con forma de UUID: el `randomblob` se evalúa en cada fila.
    const ids = (
      await sql("select id from jugadores_temporada union all select id from staff_temporada")
    ).map((f) => String(f.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids)
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

    // Las personas siguen, sin las columnas que se mudaron.
    expect(await sql("select id, nombre from jugadores order by id")).toHaveLength(3);
    expect(await sql("select id, nombre from staff order by id")).toHaveLength(2);
    const columnas = (await sql("pragma table_info(jugadores)")).map((f) => String(f.name));
    expect(columnas).not.toContain("dorsal");
    expect(columnas).not.toContain("foto");

    // Nada de lo que colgaba de los jugadores se ha perdido por el camino.
    expect(await sql("select * from partido_participaciones")).toHaveLength(3);
    expect(await sql("select * from partido_eventos")).toHaveLength(1);
    expect(await sql("pragma foreign_key_check")).toEqual([]);
  });

  it("en una base de datos vacía no inventa inscripciones", async () => {
    conexion = await abrirDb(":memory:");
    await migrarBd(conexion.db);
    expect(await sql("select * from jugadores_temporada")).toEqual([]);
    expect(await sql("select * from staff_temporada")).toEqual([]);
  });
});
