import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { abrirDb } from "./client";
import { abrirLecturaEstadisticas } from "./lectura-estadisticas";
import { urlArchivo } from "./rutas";

it("rechaza escrituras sobre la conexión de auditoría", async () => {
  const archivo = path.join(mkdtempSync(path.join(tmpdir(), "santiso-lectura-")), "test.db");
  const escritura = await abrirDb(urlArchivo(archivo));
  await escritura.cliente.execute("CREATE TABLE prueba (valor INTEGER)");
  await escritura.cliente.execute("INSERT INTO prueba VALUES (7)");
  escritura.cerrar();
  const lectura = await abrirLecturaEstadisticas(archivo);
  try {
    expect((await lectura.ejecutar("SELECT valor FROM prueba")).rows[0]?.valor).toBe(7);
    await expect(lectura.ejecutar("UPDATE prueba SET valor = 99")).rejects.toThrow();
    await expect(lectura.db.run(sql`UPDATE prueba SET valor = 99`)).rejects.toThrow();
    expect((await lectura.ejecutar("SELECT valor FROM prueba")).rows[0]?.valor).toBe(7);
  } finally {
    await lectura.cerrar();
  }
});

describe("ruta de auditoría", () => {
  it("no crea base inexistente y exige ruta absoluta", async () => {
    const archivo = path.join(mkdtempSync(path.join(tmpdir(), "santiso-lectura-")), "ausente.db");
    await expect(abrirLecturaEstadisticas(archivo)).rejects.toThrow();
    expect(existsSync(archivo)).toBe(false);
    await expect(abrirLecturaEstadisticas("data/santiso.db")).rejects.toThrow("absoluta");
  });
});
