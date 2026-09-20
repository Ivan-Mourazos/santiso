import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function entorno() {
  const dir = mkdtempSync(path.join(tmpdir(), "santiso-staff-"));
  process.env.SANTISO_DATA_DIR = dir;
  vi.resetModules();
  globalThis.santisoConexionDb = undefined;
  const bd = await import("@santiso/db");
  const inicial = await bd.abrirDb(bd.urlArchivo(path.join(dir, "santiso.db")));
  await bd.migrarBd(inicial.db);
  inicial.cerrar();
  return await import("./staff");
}

const formulario = (campos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
};

describe("acciones de staff", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.SANTISO_DATA_DIR;
    vi.restoreAllMocks();
  });

  it("normaliza el tipo antiguo Tecnico y conserva la categoría", async () => {
    const { guardarMiembroStaff } = await entorno();
    expect(
      await guardarMiembroStaff(
        formulario({
          id: "",
          nombre: "Luis",
          cargo: "Entrenador",
          tipo: "Tecnico",
          categoria: "Senior",
        }),
      ),
    ).toMatchObject({ ok: true, datos: { tipo: "tecnico", categoria: "Senior" } });
  });

  it("normaliza el tipo antiguo Directiva y descarta la categoría", async () => {
    const { guardarMiembroStaff } = await entorno();
    expect(
      await guardarMiembroStaff(
        formulario({
          id: "",
          nombre: "Ana",
          cargo: "Presidenta",
          tipo: "Directiva",
          categoria: "Senior",
        }),
      ),
    ).toMatchObject({ ok: true, datos: { tipo: "directiva", categoria: null } });
  });

  it("rechaza un técnico sin categoría", async () => {
    const { guardarMiembroStaff } = await entorno();
    expect(
      await guardarMiembroStaff(
        formulario({ id: "", nombre: "Luis", cargo: "Entrenador", tipo: "Tecnico", categoria: "" }),
      ),
    ).toMatchObject({ ok: false });
  });

  it("rechaza un tipo desconocido", async () => {
    const { guardarMiembroStaff } = await entorno();
    expect(
      await guardarMiembroStaff(
        formulario({ id: "", nombre: "Luis", cargo: "X", tipo: "Utillero", categoria: "Senior" }),
      ),
    ).toMatchObject({ ok: false });
  });

  it("rechaza nombre o cargo vacíos", async () => {
    const { guardarMiembroStaff } = await entorno();
    expect(
      await guardarMiembroStaff(formulario({ id: "", nombre: " ", cargo: "X", tipo: "Directiva" })),
    ).toMatchObject({ ok: false });
    expect(
      await guardarMiembroStaff(
        formulario({ id: "", nombre: "Ana", cargo: " ", tipo: "Directiva" }),
      ),
    ).toMatchObject({ ok: false });
  });

  it("asigna el orden siguiente dentro del mismo tipo", async () => {
    const { guardarMiembroStaff } = await entorno();
    const primero = await guardarMiembroStaff(
      formulario({ id: "", nombre: "Ana", cargo: "Presidenta", tipo: "Directiva" }),
    );
    const segundo = await guardarMiembroStaff(
      formulario({ id: "", nombre: "Bea", cargo: "Tesorera", tipo: "Directiva" }),
    );
    if (!primero.ok || !segundo.ok) throw new Error("no se crearon");
    expect(segundo.datos.orden).toBeGreaterThan(primero.datos.orden);
  });

  it("filtra los técnicos por categoría y no mezcla con la directiva", async () => {
    const { guardarMiembroStaff, cargarStaff } = await entorno();
    await guardarMiembroStaff(
      formulario({
        id: "",
        nombre: "Luis",
        cargo: "Entrenador",
        tipo: "Tecnico",
        categoria: "Senior",
      }),
    );
    await guardarMiembroStaff(
      formulario({
        id: "",
        nombre: "Marta",
        cargo: "Entrenadora",
        tipo: "Tecnico",
        categoria: "Femenino",
      }),
    );
    await guardarMiembroStaff(
      formulario({ id: "", nombre: "Ana", cargo: "Presidenta", tipo: "Directiva" }),
    );

    expect((await cargarStaff("Tecnico", "Senior")).map((s) => s.nombre)).toEqual(["Luis"]);
    expect((await cargarStaff("Directiva")).map((s) => s.nombre)).toEqual(["Ana"]);
  });

  it("borra un miembro", async () => {
    const { guardarMiembroStaff, borrarMiembroStaff, cargarStaff } = await entorno();
    const creado = await guardarMiembroStaff(
      formulario({ id: "", nombre: "Ana", cargo: "Presidenta", tipo: "Directiva" }),
    );
    if (!creado.ok) throw new Error("no se creó");
    expect(await borrarMiembroStaff(creado.datos.id)).toEqual({ ok: true, datos: null });
    expect(await cargarStaff("Directiva")).toHaveLength(0);
  });
});
