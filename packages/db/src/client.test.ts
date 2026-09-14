import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { abrirDb } from "./client";
import { urlArchivo } from "./rutas";

// Los ficheros quedan en el temporal del sistema: libSQL no los libera hasta que termina el proceso.
const rutaTemporal = () => path.join(mkdtempSync(path.join(tmpdir(), "santiso-db-")), "prueba.db");

describe("abrirDb", () => {
  it("crea el fichero en la ruta absoluta indicada y activa WAL", async () => {
    const ruta = rutaTemporal();
    const { cliente, cerrar } = await abrirDb(urlArchivo(ruta));
    const modo = (await cliente.execute("PRAGMA journal_mode")).rows[0]?.["journal_mode"];
    cerrar();
    expect(existsSync(ruta)).toBe(true);
    expect(modo).toBe("wal");
  });

  it("sin WAL usa el diario DELETE (un único fichero)", async () => {
    const { cliente, cerrar } = await abrirDb(urlArchivo(rutaTemporal()), { wal: false });
    const modo = (await cliente.execute("PRAGMA journal_mode")).rows[0]?.["journal_mode"];
    cerrar();
    expect(modo).toBe("delete");
  });

  it("activa las claves foráneas", async () => {
    const { cliente, cerrar } = await abrirDb(":memory:");
    const fk = (await cliente.execute("PRAGMA foreign_keys")).rows[0]?.["foreign_keys"];
    cerrar();
    expect(fk).toBe(1);
  });
});
