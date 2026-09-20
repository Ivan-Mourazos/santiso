import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** BD migrada con temporada activa y una competición Senior. */
async function entorno() {
  const dir = mkdtempSync(path.join(tmpdir(), "santiso-equipos-"));
  process.env.SANTISO_DATA_DIR = dir;
  vi.resetModules();
  globalThis.santisoConexionDb = undefined;
  const bd = await import("@santiso/db");
  const { db, cerrar } = await bd.abrirDb(bd.urlArchivo(path.join(dir, "santiso.db")));
  await bd.migrarBd(db);
  const [temporada] = await db
    .insert(bd.schema.temporadas)
    .values({ nombre: "2026/27", activa: true })
    .returning({ id: bd.schema.temporadas.id });
  if (!temporada) throw new Error("sin temporada");
  const [competicion] = await db
    .insert(bd.schema.competiciones)
    .values({ temporadaId: temporada.id, categoria: "Senior", nombre: "Liga" })
    .returning({ id: bd.schema.competiciones.id });
  if (!competicion) throw new Error("sin competición");
  cerrar();
  return { acciones: await import("./equipos"), competicionId: competicion.id };
}

const pngRojo = () =>
  sharp({
    create: { width: 30, height: 30, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
  })
    .png()
    .toBuffer();

const formulario = (campos: Record<string, string>, escudo?: File) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  if (escudo) f.set("escudo", escudo);
  return f;
};

describe("acciones de equipos", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.SANTISO_DATA_DIR;
    vi.restoreAllMocks();
  });

  it("crea un equipo con su clave normalizada", async () => {
    const { acciones } = await entorno();
    expect(
      await acciones.guardarEquipo(
        formulario({ id: "", nombre: "  S.D. Touro ", categoria: "Senior" }),
      ),
    ).toMatchObject({
      ok: true,
      datos: { nombre: "S.D. Touro", categoria: "Senior", es_propio: false, escudo_url: null },
    });
  });

  it("marca como propio cualquier equipo del club", async () => {
    const { acciones } = await entorno();
    expect(
      await acciones.guardarEquipo(
        formulario({ id: "", nombre: "U.D. Santiso F.C.", categoria: "Senior" }),
      ),
    ).toMatchObject({ ok: true, datos: { es_propio: true } });
  });

  it("rechaza un nombre repetido en la misma categoría", async () => {
    const { acciones } = await entorno();
    await acciones.guardarEquipo(formulario({ id: "", nombre: "S.D. Touro", categoria: "Senior" }));
    expect(
      await acciones.guardarEquipo(
        formulario({ id: "", nombre: "s.d.  touro", categoria: "Senior" }),
      ),
    ).toMatchObject({ ok: false, error: "Ya existe un equipo con ese nombre en esta categoría." });
  });

  it("admite el mismo nombre en otra categoría", async () => {
    const { acciones } = await entorno();
    await acciones.guardarEquipo(formulario({ id: "", nombre: "S.D. Touro", categoria: "Senior" }));
    expect(
      await acciones.guardarEquipo(
        formulario({ id: "", nombre: "S.D. Touro", categoria: "Femenino" }),
      ),
    ).toMatchObject({ ok: true });
  });

  it("rechaza un nombre vacío", async () => {
    const { acciones } = await entorno();
    expect(
      await acciones.guardarEquipo(formulario({ id: "", nombre: "   ", categoria: "Senior" })),
    ).toMatchObject({ ok: false });
  });

  it("guarda el escudo como clave relativa y lo devuelve como ruta de media", async () => {
    const { acciones } = await entorno();
    const escudo = new File([await pngRojo()], "e.png", { type: "image/png" });
    const creado = await acciones.guardarEquipo(
      formulario({ id: "", nombre: "Con Escudo", categoria: "Senior" }, escudo),
    );
    if (!creado.ok) throw new Error("no se creó");
    expect(creado.datos.escudo_url).toMatch(/^\/media\/escudos\/[0-9a-f-]{36}\.webp$/);
  });

  it("al editar sin escudo nuevo conserva el que tenía", async () => {
    const { acciones } = await entorno();
    const escudo = new File([await pngRojo()], "e.png", { type: "image/png" });
    const creado = await acciones.guardarEquipo(
      formulario({ id: "", nombre: "Con Escudo", categoria: "Senior" }, escudo),
    );
    if (!creado.ok) throw new Error("no se creó");

    expect(
      await acciones.guardarEquipo(
        formulario({ id: creado.datos.id, nombre: "Renombrado", categoria: "Senior" }),
      ),
    ).toMatchObject({
      ok: true,
      datos: { nombre: "Renombrado", escudo_url: creado.datos.escudo_url },
    });
  });

  it("inscribe el equipo en la competición indicada al crearlo", async () => {
    const { acciones, competicionId } = await entorno();
    const creado = await acciones.guardarEquipo(
      formulario({ id: "", nombre: "Inscrito", categoria: "Senior", competicionId }),
    );
    if (!creado.ok) throw new Error("no se creó");

    const { inscritos } = await acciones.cargarPantallaEquipos("Senior", competicionId);
    expect(inscritos.map((e) => e.nombre)).toEqual(["Inscrito"]);
  });

  it("inscribir dos veces no duplica ni falla", async () => {
    const { acciones, competicionId } = await entorno();
    const creado = await acciones.guardarEquipo(
      formulario({ id: "", nombre: "Inscrito", categoria: "Senior", competicionId }),
    );
    if (!creado.ok) throw new Error("no se creó");

    expect(await acciones.inscribirEquipo(competicionId, creado.datos.id)).toEqual({
      ok: true,
      datos: null,
    });
    const { inscritos } = await acciones.cargarPantallaEquipos("Senior", competicionId);
    expect(inscritos).toHaveLength(1);
  });

  it("quitar de la competición no borra el equipo", async () => {
    const { acciones, competicionId } = await entorno();
    const creado = await acciones.guardarEquipo(
      formulario({ id: "", nombre: "Inscrito", categoria: "Senior", competicionId }),
    );
    if (!creado.ok) throw new Error("no se creó");

    expect(await acciones.quitarEquipoDeCompeticion(competicionId, creado.datos.id)).toEqual({
      ok: true,
      datos: null,
    });
    const { todos, inscritos } = await acciones.cargarPantallaEquipos("Senior", competicionId);
    expect(inscritos).toHaveLength(0);
    expect(todos).toHaveLength(1);
  });

  it("borra un equipo sin partidos", async () => {
    const { acciones, competicionId } = await entorno();
    const creado = await acciones.guardarEquipo(
      formulario({ id: "", nombre: "Efímero", categoria: "Senior" }),
    );
    if (!creado.ok) throw new Error("no se creó");

    expect(await acciones.borrarEquipo(creado.datos.id)).toEqual({ ok: true, datos: null });
    const { todos } = await acciones.cargarPantallaEquipos("Senior", competicionId);
    expect(todos).toHaveLength(0);
  });

  it("se niega a borrar un equipo que tiene partidos", async () => {
    const { acciones, competicionId } = await entorno();
    const local = await acciones.guardarEquipo(
      formulario({ id: "", nombre: "Local", categoria: "Senior" }),
    );
    const visitante = await acciones.guardarEquipo(
      formulario({ id: "", nombre: "Visitante", categoria: "Senior" }),
    );
    if (!local.ok || !visitante.ok) throw new Error("no se crearon");

    const bd = await import("@santiso/db");
    const { db } = await (await import("@/lib/server/db")).obtenerDb();
    const [jornada] = await db
      .insert(bd.schema.jornadas)
      .values({ competicionId, numero: 1 })
      .returning({ id: bd.schema.jornadas.id });
    if (!jornada) throw new Error("sin jornada");
    await db.insert(bd.schema.partidos).values({
      jornadaId: jornada.id,
      equipoLocalId: local.datos.id,
      equipoVisitanteId: visitante.datos.id,
    });

    expect(await acciones.borrarEquipo(local.datos.id)).toMatchObject({
      ok: false,
      error: "No se puede borrar: el equipo tiene partidos.",
    });
  });
});
