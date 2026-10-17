import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { abrirDb } from "./client";
import { dirMigraciones, migrarBd } from "./migraciones";
import { rfgfGruposHistoricos, rfgfHistorico } from "./schema";

it("migrar archivo conserva grupos y cifras previos, con claves foráneas activas", async () => {
  const carpeta = mkdtempSync(path.join(tmpdir(), "santiso-migracion-historico-"));
  const conexion = await abrirDb(":memory:");
  try {
    const origen = dirMigraciones();
    const diario = JSON.parse(readFileSync(path.join(origen, "meta/_journal.json"), "utf8"));
    diario.entries = diario.entries.filter((e: { idx: number }) => e.idx < 21);
    mkdirSync(path.join(carpeta, "meta"));
    writeFileSync(path.join(carpeta, "meta/_journal.json"), JSON.stringify(diario));
    for (const e of diario.entries)
      copyFileSync(path.join(origen, `${e.tag}.sql`), path.join(carpeta, `${e.tag}.sql`));
    await migrarBd(conexion.db, carpeta);
    await conexion.cliente.execute("insert into jugadores (id,nombre) values ('j','Jugador')");
    await conexion.cliente.execute(
      "insert into rfgf_grupos_historicos (cod_grupo,categoria,temporada,competicion,grupo,cod_competicion,cod_equipo) values ('300','Senior','2025-2026','Liga','4','30','12')",
    );
    await conexion.cliente.execute(
      "insert into rfgf_historico (jugador_id,cod_grupo,codigo,cifras) values ('j','300','45','{\"goles\":2}')",
    );
    await migrarBd(conexion.db);
    expect((await conexion.db.select().from(rfgfGruposHistoricos))[0]).toMatchObject({
      codGrupo: "300",
      partidosEstado: "no_pedido",
      partidosPedidosEn: null,
    });
    expect((await conexion.db.select().from(rfgfHistorico))[0]).toMatchObject({
      jugadorId: "j",
      codGrupo: "300",
      cifras: { goles: 2 },
    });
    expect((await conexion.cliente.execute("PRAGMA foreign_key_check")).rows).toEqual([]);
    expect((await conexion.cliente.execute("PRAGMA foreign_keys")).rows[0]?.foreign_keys).toBe(1);
  } finally {
    conexion.cerrar();
    rmSync(carpeta, { recursive: true });
  }
});
