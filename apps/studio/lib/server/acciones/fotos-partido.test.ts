import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** BD con un partido; devuelve su id, la carpeta de datos y las acciones. */
async function entorno() {
  const dir = mkdtempSync(path.join(tmpdir(), "santiso-fotos-partido-"));
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
  const [competicion] = await db
    .insert(bd.schema.competiciones)
    .values({ temporadaId: temporada!.id, categoria: "Senior", nombre: "Liga" })
    .returning({ id: bd.schema.competiciones.id });
  const equipos = await db
    .insert(bd.schema.equipos)
    .values([
      { nombre: "Santiso", clave: "santiso", categoria: "Senior", esPropio: true },
      { nombre: "Rival", clave: "rival", categoria: "Senior" },
    ])
    .returning({ id: bd.schema.equipos.id });
  const [jornada] = await db
    .insert(bd.schema.jornadas)
    .values({ competicionId: competicion!.id, numero: 1 })
    .returning({ id: bd.schema.jornadas.id });
  const [partido] = await db
    .insert(bd.schema.partidos)
    .values({
      jornadaId: jornada!.id,
      equipoLocalId: equipos[0]!.id,
      equipoVisitanteId: equipos[1]!.id,
    })
    .returning({ id: bd.schema.partidos.id });
  cerrar();
  return { acciones: await import("./fotos-partido"), partidoId: partido!.id, dir };
}

const foto = async (ancho: number, alto: number) =>
  new File(
    [
      await sharp({
        create: { width: ancho, height: alto, channels: 3, background: { r: 40, g: 90, b: 60 } },
      })
        .jpeg()
        .toBuffer(),
    ],
    "foto.jpg",
    { type: "image/jpeg" },
  );

const formulario = (...ficheros: File[]) => {
  const f = new FormData();
  for (const fichero of ficheros) f.append("fotos", fichero);
  return f;
};

describe("galería de fotos del partido", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.SANTISO_DATA_DIR;
    vi.restoreAllMocks();
  });

  it("sube varias fotos, salta las que no son imagen y las lista en orden", async () => {
    const { acciones, partidoId, dir } = await entorno();
    const texto = new File(["hola"], "nota.txt", { type: "text/plain" });
    const subida = await acciones.subirFotosPartido(
      partidoId,
      formulario(await foto(1600, 900), texto, await foto(900, 1600)),
    );
    if (!subida.ok) throw new Error(subida.error);
    expect(subida.datos.descartadas).toBe(1);
    expect(subida.datos.fotos.map((f) => [f.ancho, f.alto])).toEqual([
      [1600, 900],
      [900, 1600],
    ]);
    const [primera] = subida.datos.fotos;
    expect(primera?.url).toMatch(/^\/media\/partidos\/[0-9a-f-]{36}\.webp$/);
    expect(existsSync(path.join(dir, "media", primera!.url.replace("/media/", "")))).toBe(true);

    const lista = await acciones.listarFotosPartido(partidoId);
    expect(lista.ok && lista.datos.map((f) => f.id)).toEqual(subida.datos.fotos.map((f) => f.id));
  });

  it("rechaza subir a un partido que no existe o sin fotos", async () => {
    const { acciones } = await entorno();
    expect(await acciones.subirFotosPartido("nada", formulario(await foto(10, 10)))).toMatchObject({
      ok: false,
      error: "El partido ya no existe.",
    });
    expect(await acciones.subirFotosPartido("nada", formulario())).toMatchObject({ ok: false });
  });

  it("corrige el foco dentro de 0–1 y quita la foto", async () => {
    const { acciones, partidoId } = await entorno();
    const subida = await acciones.subirFotosPartido(partidoId, formulario(await foto(800, 600)));
    if (!subida.ok) throw new Error(subida.error);
    const id = subida.datos.fotos[0]!.id;

    expect(await acciones.cambiarFocoFoto(id, 1.5, 0.2)).toMatchObject({ ok: false });
    expect(await acciones.cambiarFocoFoto(id, 0.25, 0.75)).toEqual({ ok: true, datos: null });
    const lista = await acciones.listarFotosPartido(partidoId);
    expect(lista.ok && lista.datos[0]).toMatchObject({ foco_x: 0.25, foco_y: 0.75 });

    expect(await acciones.quitarFotoPartido(id)).toEqual({ ok: true, datos: null });
    expect(await acciones.listarFotosPartido(partidoId)).toEqual({ ok: true, datos: [] });
  });
});
