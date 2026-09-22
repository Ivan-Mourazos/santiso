import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function entorno() {
  const dir = mkdtempSync(path.join(tmpdir(), "santiso-ajustes-"));
  process.env.SANTISO_DATA_DIR = dir;
  vi.resetModules();
  globalThis.santisoConexionDb = undefined;
  const bd = await import("@santiso/db");
  const inicial = await bd.abrirDb(bd.urlArchivo(path.join(dir, "santiso.db")));
  await bd.migrarBd(inicial.db);
  inicial.cerrar();
  return await import("./ajustes-cartel");
}

const pngRojo = () =>
  sharp({
    create: { width: 30, height: 30, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
  })
    .png()
    .toBuffer();

const conImagen = async (campo = "imagen") => {
  const f = new FormData();
  f.set(campo, new File([await pngRojo()], "l.png", { type: "image/png" }));
  return f;
};

describe("acciones de ajustes de cartel", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.SANTISO_DATA_DIR;
    vi.restoreAllMocks();
  });

  it("parte de una pantalla vacía con el orden por defecto", async () => {
    const { cargarAjustesCartel } = await entorno();
    const pantalla = await cargarAjustesCartel();
    if (!pantalla.ok) throw new Error("falló la carga");
    expect(pantalla.datos).toMatchObject({
      escudoClub: null,
      logoXunta: null,
      logoRfgf: null,
      ordenLogos: "xunta_izquierda",
      patrocinadores: [],
    });
  });

  it("guarda el logo de la Xunta y lo devuelve como ruta de media", async () => {
    const { guardarLogoAjuste, cargarAjustesCartel } = await entorno();
    const guardado = await guardarLogoAjuste("cartel.logo_xunta", await conImagen());
    expect(guardado.ok).toBe(true);
    if (!guardado.ok) throw new Error("no guardó");
    expect(guardado.datos).toMatch(/^\/media\/cartel\/[0-9a-f-]{36}\.webp$/);

    const pantalla = await cargarAjustesCartel();
    if (!pantalla.ok) throw new Error("falló la carga");
    expect(pantalla.datos.logoXunta).toBe(guardado.datos);
  });

  it("rechaza una clave de ajuste que no existe", async () => {
    const { guardarLogoAjuste } = await entorno();
    expect(await guardarLogoAjuste("cartel.logo_inventado", await conImagen())).toMatchObject({
      ok: false,
    });
  });

  it("exige que llegue una imagen", async () => {
    const { guardarLogoAjuste } = await entorno();
    expect(await guardarLogoAjuste("cartel.logo_xunta", new FormData())).toMatchObject({
      ok: false,
    });
  });

  it("sobrescribe el logo anterior al guardar uno nuevo", async () => {
    const { guardarLogoAjuste, cargarAjustesCartel } = await entorno();
    const primero = await guardarLogoAjuste("cartel.logo_rfgf", await conImagen());
    const segundo = await guardarLogoAjuste("cartel.logo_rfgf", await conImagen());
    if (!primero.ok || !segundo.ok) throw new Error("no guardó");
    expect(segundo.datos).not.toBe(primero.datos);

    const pantalla = await cargarAjustesCartel();
    if (!pantalla.ok) throw new Error("falló la carga");
    expect(pantalla.datos.logoRfgf).toBe(segundo.datos);
  });

  it("guarda un orden de logos válido y rechaza uno inventado", async () => {
    const { guardarOrdenLogos, cargarAjustesCartel } = await entorno();
    expect(await guardarOrdenLogos("rfgf_izquierda")).toEqual({ ok: true, datos: null });
    const pantalla = await cargarAjustesCartel();
    if (!pantalla.ok) throw new Error("falló la carga");
    expect(pantalla.datos.ordenLogos).toBe("rfgf_izquierda");

    expect(await guardarOrdenLogos("al_revés")).toMatchObject({ ok: false });
  });

  it("lista los patrocinadores activados, en su orden", async () => {
    const { cargarAjustesCartel } = await entorno();
    const bd = await import("@santiso/db");
    const { db } = await (await import("@/lib/server/db")).obtenerDb();
    await db.insert(bd.schema.patrocinadores).values([
      { nombre: "Segundo", clave: "segundo", logo: "cartel/b.webp", enCarteles: true, orden: 1 },
      { nombre: "Primero", clave: "primero", logo: "cartel/a.webp", enCarteles: true, orden: 0 },
      { nombre: "Fuera", clave: "fuera", logo: null, enCarteles: false, orden: 0 },
    ]);

    const pantalla = await cargarAjustesCartel();
    if (!pantalla.ok) throw new Error("falló la carga");
    expect(pantalla.datos.patrocinadores.map((p) => p.nombre)).toEqual(["Primero", "Segundo"]);
  });

  it("guarda el escudo del club", async () => {
    const { guardarLogoAjuste, cargarAjustesCartel } = await entorno();
    const guardado = await guardarLogoAjuste("club.escudo", await conImagen());
    if (!guardado.ok) throw new Error("no guardó");
    const pantalla = await cargarAjustesCartel();
    if (!pantalla.ok) throw new Error("falló la carga");
    expect(pantalla.datos.escudoClub).toBe(guardado.datos);
  });
});
