import { schema as s, type ConexionDb } from "@santiso/db";
import { crearDbPrueba } from "@santiso/db/testing";
import { afterEach, beforeEach, expect, it } from "vitest";
import { listarCompeticionesDeTemporada } from "./competiciones";

let conexion: ConexionDb;

beforeEach(async () => {
  conexion = await crearDbPrueba();
  await conexion.db.insert(s.temporadas).values([
    { id: "anterior", nombre: "2025/26" },
    { id: "actual", nombre: "2026/27", activa: true },
  ]);
  await conexion.db.insert(s.competiciones).values([
    { id: "liga-25", temporadaId: "anterior", categoria: "Senior", nombre: "Liga", orden: 1 },
    { id: "copa-25", temporadaId: "anterior", categoria: "Senior", nombre: "Copa", orden: 0 },
    { id: "vet-25", temporadaId: "anterior", categoria: "Veteranos", nombre: "Liga V" },
    { id: "liga-26", temporadaId: "actual", categoria: "Senior", nombre: "Liga nueva" },
  ]);
  globalThis.santisoConexionDb = Promise.resolve(conexion);
});

afterEach(() => {
  globalThis.santisoConexionDb = undefined;
  conexion.cerrar();
});

it("trae las de esa temporada y categoría, por orden", async () => {
  expect((await listarCompeticionesDeTemporada("anterior", "Senior")).map((c) => c.id)).toEqual([
    "copa-25",
    "liga-25",
  ]);
});

it("no cruza temporadas ni categorías", async () => {
  expect((await listarCompeticionesDeTemporada("actual", "Senior")).map((c) => c.id)).toEqual([
    "liga-26",
  ]);
  expect((await listarCompeticionesDeTemporada("anterior", "Veteranos")).map((c) => c.id)).toEqual([
    "vet-25",
  ]);
  expect(await listarCompeticionesDeTemporada("anterior", "Femenino")).toEqual([]);
});
