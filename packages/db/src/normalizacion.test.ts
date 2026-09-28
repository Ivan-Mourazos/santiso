import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { abrirDb, type ConexionDb } from "./client";
import { migrarBd } from "./migraciones";
import { normalizarEnTransaccion } from "./normalizacion";
import { urlArchivo } from "./rutas";
import * as s from "./schema";

let conexion: ConexionDb;

beforeEach(async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "santiso-normalizar-"));
  conexion = await abrirDb(urlArchivo(path.join(dir, "santiso.db")));
  const { db } = conexion;
  await migrarBd(db);
  await db.insert(s.temporadas).values({ id: "t", nombre: "2026/27", activa: true });
  await db.insert(s.competiciones).values({
    id: "liga",
    temporadaId: "t",
    categoria: "Veteranos",
    nombre: "Veteranos 1ª Galicia - Gr. 2",
  });
  await db.insert(s.equipos).values([
    { id: "melide", nombre: "MELIDE VETERANOS", clave: "melide veteranos", categoria: "Veteranos" },
    // Ya existe «Touro» a secas: renombrar el otro chocaría.
    { id: "touro", nombre: "Touro", clave: "touro", categoria: "Veteranos" },
    { id: "touro2", nombre: "TOURO VETERANOS", clave: "touro veteranos", categoria: "Veteranos" },
  ]);
  await db.insert(s.campos).values([
    { id: "a", nombre: "San Lorenzo", clave: "san lorenzo", poblacion: "Vilatuxe (Lalín)" },
    { id: "b", nombre: "San Lorenzo - Vilatuxe", clave: "san lorenzo vilatuxe" },
    { id: "c", nombre: "Mpal Do Camballón", clave: "mpal do camballon" },
  ]);
  await db.insert(s.jornadas).values({ id: "j", competicionId: "liga", numero: 1 });
  await db.insert(s.partidos).values({
    id: "p",
    jornadaId: "j",
    equipoLocalId: "melide",
    equipoVisitanteId: "touro2",
    campoId: "b",
  });
  await db.insert(s.jugadores).values({ id: "x", nombre: "JOSÉ A. MARTÍNEZ IGLESIAS" });
});

afterEach(() => conexion.cerrar());

describe("normalizarEnTransaccion", () => {
  it("normaliza, junta campos, guarda alias y respeta los choques", async () => {
    const tx = await conexion.cliente.transaction("write");
    const informe = await normalizarEnTransaccion(tx);
    await tx.commit();
    tx.close();

    const q = async (sql: string) =>
      (await conexion.cliente.execute(sql)).rows.map((r) => Object.values(r));
    expect(await q("select id, nombre, clave from equipos order by id")).toEqual([
      ["melide", "Melide", "melide"],
      ["touro", "Touro", "touro"],
      ["touro2", "TOURO VETERANOS", "touro veteranos"],
    ]);
    expect(informe.conflictos).toHaveLength(1);
    expect(await q("select nombre from competiciones")).toEqual([
      ["Veteranos 1ª Galicia - Grupo 2"],
    ]);
    expect(await q("select alias from competicion_alias")).toEqual([
      ["Veteranos 1ª Galicia - Gr. 2"],
    ]);
    // El partido del campo repetido pasa al que tiene población.
    expect(await q("select id, nombre, poblacion from campos order by id")).toEqual([
      ["a", "San Lorenzo", "Vilatuxe (Lalín)"],
      ["c", "Municipal do Camballón", null],
    ]);
    expect(await q("select campo_id from partidos")).toEqual([["a"]]);
    expect(informe.camposJuntados).toEqual([
      { queda: "San Lorenzo (Vilatuxe (Lalín))", juntados: ["San Lorenzo - Vilatuxe"] },
    ]);
    expect(await q("select nombre from jugadores")).toEqual([["José A. Martínez Iglesias"]]);
  });
});
