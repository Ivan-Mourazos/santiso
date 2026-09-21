import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { it, expect, vi } from "vitest";
it("consultar contexto incluye temporadas históricas sin activar ninguna", async () => {
  const previous = process.env.SANTISO_DATA_DIR;
  const dir = mkdtempSync(path.join(tmpdir(), "studio-contexto-"));
  process.env.SANTISO_DATA_DIR = dir;
  vi.resetModules();
  globalThis.santisoConexionDb = undefined;
  const bd = await import("@santiso/db");
  const connection = await bd.abrirDb(bd.urlArchivo(path.join(dir, "santiso.db")));
  try {
    await bd.migrarBd(connection.db);
    await connection.db.insert(bd.schema.temporadas).values([
      { id: "actual", nombre: "2026/27", activa: true },
      { id: "historica", nombre: "2025/26", activa: false },
    ]);
    await connection.db.insert(bd.schema.competiciones).values([
      {
        id: "c1",
        temporadaId: "actual",
        categoria: "Senior",
        nombre: "Liga actual",
        formato: "liga",
      },
      {
        id: "c2",
        temporadaId: "historica",
        categoria: "Senior",
        nombre: "Liga anterior",
        formato: "liga",
      },
    ]);
    const { cargarContextoStudio } = await import("./contexto-studio");
    const result = await cargarContextoStudio();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.datos.competiciones.map((c) => c.temporadaId).sort()).toEqual([
      "actual",
      "historica",
    ]);
    expect(result.datos.temporadas.filter((t) => t.activa).map((t) => t.id)).toEqual(["actual"]);
    expect(
      (await connection.db.select().from(bd.schema.temporadas))
        .filter((t) => t.activa)
        .map((t) => t.id),
    ).toEqual(["actual"]);
  } finally {
    connection.cerrar();
    (await (await import("./db")).obtenerDb()).cerrar();
    globalThis.santisoConexionDb = undefined;
    if (previous === undefined) delete process.env.SANTISO_DATA_DIR;
    else process.env.SANTISO_DATA_DIR = previous;
  }
});
