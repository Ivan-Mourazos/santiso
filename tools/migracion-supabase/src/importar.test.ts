import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { schema as s } from "@santiso/db";
import { crearDbPrueba } from "@santiso/db/testing";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { importarModelo } from "./importar";
import { renderizarInforme } from "./informe";
import { manifiestoPara, snapshotMinimo } from "./test/fabricas";
import { transformar } from "./transformar";
import { verificarImportacion } from "./verificar";

async function escenario() {
  const { snapshot, ids } = snapshotMinimo();
  const { modelo, informe } = transformar(snapshot);
  const conexion = await crearDbPrueba();
  await importarModelo(conexion.db, modelo);

  const dirMedia = mkdtempSync(path.join(tmpdir(), "santiso-media-"));
  const escudo = new Uint8Array([1, 2, 3]);
  writeFileSync(path.join(dirMedia, "escudo_club.webp"), escudo);
  const manifiesto = manifiestoPara(snapshot, { "escudo_club.webp": escudo });

  const verificar = () =>
    verificarImportacion({
      db: conexion.db,
      cliente: conexion.cliente,
      origen: snapshot,
      modelo,
      dirMedia,
      manifiesto,
    });
  return { ids, modelo, informe, conexion, dirMedia, verificar };
}

describe("importarModelo + verificarImportacion", () => {
  it("importa el modelo completo y todas las comprobaciones pasan", async () => {
    const { verificar, conexion, modelo } = await escenario();

    const resultado = await verificar();

    expect(resultado.comprobaciones.filter((c) => !c.ok)).toEqual([]);
    expect(resultado.ok).toBe(true);
    expect(await conexion.db.select().from(s.partidos)).toHaveLength(modelo.partidos.length);
    conexion.cerrar();
  });

  it("detecta marcadores alterados, eventos perdidos y media corrupta", async () => {
    const { verificar, conexion, ids, dirMedia } = await escenario();
    await conexion.db
      .update(s.partidos)
      .set({ golesLocal: 9 })
      .where(eq(s.partidos.id, ids.partido));
    await conexion.db.delete(s.partidoEventos);
    writeFileSync(path.join(dirMedia, "escudo_club.webp"), new Uint8Array([0]));

    const resultado = await verificar();

    expect(resultado.ok).toBe(false);
    expect(resultado.comprobaciones.filter((c) => !c.ok).map((c) => c.nombre)).toEqual(
      expect.arrayContaining([
        "Filas en partidoEventos",
        "Marcadores de partidos",
        "Goles por jugador",
        "Ficheros de media",
      ]),
    );
    conexion.cerrar();
  });

  it("revierte toda la importación si falla una fila", async () => {
    const { snapshot } = snapshotMinimo();
    const { modelo } = transformar(snapshot);
    const conexion = await crearDbPrueba();
    const [evento] = modelo.partidoEventos;
    const roto = { ...modelo, partidoEventos: [{ ...evento!, minuto: 500 }] };

    await expect(importarModelo(conexion.db, roto)).rejects.toThrow();

    expect(await conexion.db.select().from(s.temporadas)).toHaveLength(0);
    conexion.cerrar();
  });

  it("renderiza un informe legible", async () => {
    const { verificar, modelo, informe, conexion } = await escenario();

    const texto = renderizarInforme({
      dirSnapshot: "data/snapshots/prueba",
      modelo,
      informe,
      verificacion: await verificar(),
      fecha: new Date("2026-09-13T20:00:00Z"),
    });

    expect(texto).toContain("# Informe de migración Supabase → SQLite");
    expect(texto).toContain("| partidos | 1 |");
    expect(texto).toContain("| Marcadores de partidos | OK |");
    expect(texto).toContain("## Clasificación manual antigua");
    conexion.cerrar();
  });
});
