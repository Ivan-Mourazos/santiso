import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function entorno() {
  const dir = mkdtempSync(path.join(tmpdir(), "santiso-patrocinadores-"));
  process.env.SANTISO_DATA_DIR = dir;
  vi.resetModules();
  globalThis.santisoConexionDb = undefined;
  const bd = await import("@santiso/db");
  const inicial = await bd.abrirDb(bd.urlArchivo(path.join(dir, "santiso.db")));
  await bd.migrarBd(inicial.db);
  inicial.cerrar();
  return await import("./patrocinadores");
}

const pngRojo = () =>
  sharp({
    create: { width: 30, height: 30, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
  })
    .png()
    .toBuffer();

const formulario = (campos: Record<string, string>, logo?: File) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  if (logo) f.set("logo", logo);
  return f;
};

describe("acciones de patrocinadores", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.SANTISO_DATA_DIR;
    vi.restoreAllMocks();
  });

  it("crea un patrocinador de web, no de cartel", async () => {
    const { guardarPatrocinador } = await entorno();
    expect(
      await guardarPatrocinador(formulario({ id: "", nombre: "Bar Central", webUrl: "" })),
    ).toMatchObject({ ok: true, datos: { nombre: "Bar Central", en_carteles: false } });
  });

  it("rechaza un nombre repetido, aunque cambien tildes y mayúsculas", async () => {
    const { guardarPatrocinador } = await entorno();
    await guardarPatrocinador(formulario({ id: "", nombre: "Café Central" }));
    expect(
      await guardarPatrocinador(formulario({ id: "", nombre: "  cafe central " })),
    ).toMatchObject({ ok: false, error: "Ya existe un patrocinador con ese nombre." });
  });

  it("rechaza un nombre vacío", async () => {
    const { guardarPatrocinador } = await entorno();
    expect(await guardarPatrocinador(formulario({ id: "", nombre: " " }))).toMatchObject({
      ok: false,
    });
  });

  it("guarda el logo como ruta de media y lo conserva al editar sin logo nuevo", async () => {
    const { guardarPatrocinador } = await entorno();
    const logo = new File([await pngRojo()], "l.png", { type: "image/png" });
    const creado = await guardarPatrocinador(formulario({ id: "", nombre: "Con Logo" }, logo));
    if (!creado.ok) throw new Error("no se creó");
    expect(creado.datos.logo_url).toMatch(/^\/media\/sponsors\/[0-9a-f-]{36}\.webp$/);

    expect(
      await guardarPatrocinador(
        formulario({ id: creado.datos.id, nombre: "Con Logo", webUrl: "https://ejemplo.gal" }),
      ),
    ).toMatchObject({
      ok: true,
      datos: { web_url: "https://ejemplo.gal", logo_url: creado.datos.logo_url },
    });
  });

  it("el catálogo es uno solo: lista también los que salen en carteles", async () => {
    const { guardarPatrocinador, cargarPatrocinadores } = await entorno();
    const deWeb = await guardarPatrocinador(formulario({ id: "", nombre: "De web" }));
    if (!deWeb.ok) throw new Error("no se creó");

    const bd = await import("@santiso/db");
    const { db } = await (await import("@/lib/server/db")).obtenerDb();
    const [deCartel] = await db
      .insert(bd.schema.patrocinadores)
      .values({ nombre: "De cartel", clave: "de cartel", enCarteles: true, orden: 0 })
      .returning({ id: bd.schema.patrocinadores.id });

    // Primero los que salen en carteles, en su orden; después el resto, por nombre.
    expect(await cargarPatrocinadores()).toEqual([
      expect.objectContaining({ id: deCartel!.id, nombre: "De cartel", en_carteles: true }),
      expect.objectContaining({ id: deWeb.datos.id, nombre: "De web", en_carteles: false }),
    ]);
  });

  it("encuentra el registro que choca por nombre, sin contar el que se está editando", async () => {
    const { guardarPatrocinador, buscarCoincidenciaPatrocinador } = await entorno();
    const creado = await guardarPatrocinador(formulario({ id: "", nombre: "Autobuses Santiso" }));
    if (!creado.ok) throw new Error("no se creó");

    const coincide = await buscarCoincidenciaPatrocinador("AUTOBUSES  SANTISO");
    expect(coincide).toMatchObject({ ok: true, datos: { id: creado.datos.id } });
    // Al editarse a sí mismo no choca consigo mismo.
    expect(await buscarCoincidenciaPatrocinador("Autobuses Santiso", creado.datos.id)).toEqual({
      ok: true,
      datos: null,
    });
    expect(await buscarCoincidenciaPatrocinador("Otro cualquiera")).toEqual({
      ok: true,
      datos: null,
    });
  });

  it("borra un patrocinador", async () => {
    const { guardarPatrocinador, borrarPatrocinador, cargarPatrocinadores } = await entorno();
    const creado = await guardarPatrocinador(formulario({ id: "", nombre: "Efímero" }));
    if (!creado.ok) throw new Error("no se creó");
    expect(await borrarPatrocinador(creado.datos.id)).toEqual({ ok: true, datos: null });
    expect(await cargarPatrocinadores()).toHaveLength(0);
  });
});
