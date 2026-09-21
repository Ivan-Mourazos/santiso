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
  const temporadas = await inicial.db
    .insert(bd.schema.temporadas)
    .values([
      { nombre: "2025/26", activa: false },
      { nombre: "2026/27", activa: true },
    ])
    .returning({ id: bd.schema.temporadas.id, nombre: bd.schema.temporadas.nombre });
  inicial.cerrar();
  const idDe = (nombre: string) => temporadas.find((t) => t.nombre === nombre)?.id ?? "";
  return { ...(await import("./staff")), anterior: idDe("2025/26"), activa: idDe("2026/27") };
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

  it("el entrenador nuevo no borra al del año pasado", async () => {
    const { guardarMiembroStaff, cargarStaff, anterior, activa } = await entorno();
    const tecnico = { id: "", cargo: "Entrenador", tipo: "Tecnico", categoria: "Senior" };
    await guardarMiembroStaff(formulario({ ...tecnico, nombre: "Luis", temporadaId: anterior }));
    await guardarMiembroStaff(formulario({ ...tecnico, nombre: "Pepe", temporadaId: activa }));

    expect((await cargarStaff("Tecnico", "Senior", anterior)).map((s) => s.nombre)).toEqual(["Luis"]);
    expect((await cargarStaff("Tecnico", "Senior", activa)).map((s) => s.nombre)).toEqual(["Pepe"]);
  });

  it("trae del año pasado a quien sigue, con su cargo y su foto", async () => {
    const { guardarMiembroStaff, cargarCandidatosStaff, incorporarStaff, cargarStaff, anterior, activa } =
      await entorno();
    const presidenta = await guardarMiembroStaff(
      formulario({ id: "", nombre: "Ana", cargo: "Presidenta", tipo: "Directiva", temporadaId: anterior }),
    );
    await guardarMiembroStaff(
      formulario({ id: "", nombre: "Xosé", cargo: "Tesorero", tipo: "Directiva", temporadaId: anterior }),
    );
    if (!presidenta.ok) throw new Error("no se creó");

    const candidatos = await cargarCandidatosStaff("Directiva", undefined, activa);
    expect(candidatos.miembros.map((m) => m.nombre).sort()).toEqual(["Ana", "Xosé"]);

    expect(await incorporarStaff({ temporadaId: activa, inscripciones: [presidenta.datos.inscripcion_id] })).toEqual({
      ok: true,
      datos: 1,
    });
    expect(await cargarStaff("Directiva", undefined, activa)).toEqual([
      expect.objectContaining({ id: presidenta.datos.id, cargo: "Presidenta" }),
    ]);
    expect((await cargarCandidatosStaff("Directiva", undefined, activa)).miembros.map((m) => m.nombre)).toEqual([
      "Xosé",
    ]);
  });

  it("quitar un papel no borra a quien lo tiene en otra temporada", async () => {
    const { guardarMiembroStaff, incorporarStaff, quitarMiembroStaffDeTemporada, cargarStaff, anterior, activa } =
      await entorno();
    const creado = await guardarMiembroStaff(
      formulario({ id: "", nombre: "Ana", cargo: "Presidenta", tipo: "Directiva", temporadaId: anterior }),
    );
    if (!creado.ok) throw new Error("no se creó");
    await incorporarStaff({ temporadaId: activa, inscripciones: [creado.datos.inscripcion_id] });
    const [deEsteAno] = await cargarStaff("Directiva", undefined, activa);
    if (!deEsteAno) throw new Error("no se incorporó");

    expect(await quitarMiembroStaffDeTemporada(deEsteAno.inscripcion_id)).toEqual({ ok: true, datos: null });
    expect(await cargarStaff("Directiva", undefined, activa)).toHaveLength(0);
    expect(await cargarStaff("Directiva", undefined, anterior)).toHaveLength(1);
  });
});
