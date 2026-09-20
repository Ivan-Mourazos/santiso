import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function entorno() {
  const dir = mkdtempSync(path.join(tmpdir(), "santiso-jugadores-"));
  process.env.SANTISO_DATA_DIR = dir;
  vi.resetModules();
  globalThis.santisoConexionDb = undefined;
  const bd = await import("@santiso/db");
  const inicial = await bd.abrirDb(bd.urlArchivo(path.join(dir, "santiso.db")));
  await bd.migrarBd(inicial.db);
  inicial.cerrar();
  return await import("./jugadores");
}

const pngRojo = () =>
  sharp({
    create: { width: 30, height: 30, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
  })
    .png()
    .toBuffer();

const formulario = (campos: Record<string, string>, foto?: File) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  if (foto) f.set("foto", foto);
  return f;
};

const base = { id: "", nombre: "Ana", categoria: "Femenino" };

describe("acciones de jugadores", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.SANTISO_DATA_DIR;
    vi.restoreAllMocks();
  });

  it("crea un jugador con los campos mínimos", async () => {
    const { guardarJugador } = await entorno();
    expect(await guardarJugador(formulario(base))).toMatchObject({
      ok: true,
      datos: {
        nombre: "Ana",
        categoria: "Femenino",
        dorsal: null,
        posicion: null,
        apodo: null,
        foto_url: null,
        historial_deportivo: [],
      },
    });
  });

  it("convierte un dorsal vacío en null en vez de NaN", async () => {
    const { guardarJugador } = await entorno();
    expect(await guardarJugador(formulario({ ...base, dorsal: "" }))).toMatchObject({
      ok: true,
      datos: { dorsal: null },
    });
  });

  it("guarda un dorsal numérico", async () => {
    const { guardarJugador } = await entorno();
    expect(await guardarJugador(formulario({ ...base, dorsal: "9" }))).toMatchObject({
      ok: true,
      datos: { dorsal: 9 },
    });
  });

  it("rechaza un dorsal que no es un número", async () => {
    const { guardarJugador } = await entorno();
    expect(await guardarJugador(formulario({ ...base, dorsal: "nueve" }))).toMatchObject({
      ok: false,
    });
  });

  it("convierte una posición vacía en null", async () => {
    const { guardarJugador } = await entorno();
    expect(await guardarJugador(formulario({ ...base, posicion: "" }))).toMatchObject({
      ok: true,
      datos: { posicion: null },
    });
  });

  it("acepta una posición del catálogo y rechaza una inventada", async () => {
    const { guardarJugador } = await entorno();
    expect(await guardarJugador(formulario({ ...base, posicion: "DC" }))).toMatchObject({
      ok: true,
      datos: { posicion: "DC" },
    });
    expect(
      await guardarJugador(formulario({ ...base, nombre: "Otra", posicion: "LIBERO" })),
    ).toMatchObject({ ok: false });
  });

  it("parte el historial por líneas y descarta las vacías", async () => {
    const { guardarJugador } = await entorno();
    expect(
      await guardarJugador(formulario({ ...base, historial: "  Juvenil  \n\n  Senior \n" })),
    ).toMatchObject({ ok: true, datos: { historial_deportivo: ["Juvenil", "Senior"] } });
  });

  it("rechaza un nombre vacío", async () => {
    const { guardarJugador } = await entorno();
    expect(await guardarJugador(formulario({ ...base, nombre: "  " }))).toMatchObject({
      ok: false,
    });
  });

  it("guarda la foto como ruta de media y la conserva al editar sin foto nueva", async () => {
    const { guardarJugador } = await entorno();
    const foto = new File([await pngRojo()], "f.png", { type: "image/png" });
    const creado = await guardarJugador(formulario(base, foto));
    if (!creado.ok) throw new Error("no se creó");
    expect(creado.datos.foto_url).toMatch(/^\/media\/jugadores\/[0-9a-f-]{36}\.webp$/);

    expect(
      await guardarJugador(
        formulario({ id: creado.datos.id, nombre: "Ana María", categoria: "Femenino" }),
      ),
    ).toMatchObject({
      ok: true,
      datos: { nombre: "Ana María", foto_url: creado.datos.foto_url },
    });
  });

  it("una edición reescribe la fila entera: lo que no se reenvía se vacía", async () => {
    // Contrato deliberado, no un descuido: quien edite solo la foto tiene que reenviar el resto
    // de campos. `AdminPlayers.handleUpdateFoto` lo hace; si alguien lo olvida, esta prueba
    // documenta qué se pierde.
    const { guardarJugador } = await entorno();
    const completo = await guardarJugador(
      formulario({ ...base, dorsal: "7", posicion: "DC", apodo: "Anita", historial: "Juvenil" }),
    );
    if (!completo.ok) throw new Error("no se creó");

    expect(
      await guardarJugador(
        formulario({ id: completo.datos.id, nombre: "Ana", categoria: "Femenino" }),
      ),
    ).toMatchObject({
      ok: true,
      datos: { dorsal: null, posicion: null, apodo: null, historial_deportivo: [] },
    });
  });

  it("una edición que reenvía los campos los conserva", async () => {
    const { guardarJugador } = await entorno();
    const completo = await guardarJugador(
      formulario({ ...base, dorsal: "7", posicion: "DC", apodo: "Anita", historial: "Juvenil" }),
    );
    if (!completo.ok) throw new Error("no se creó");

    expect(
      await guardarJugador(
        formulario({
          id: completo.datos.id,
          nombre: "Ana",
          categoria: "Femenino",
          dorsal: "7",
          posicion: "DC",
          apodo: "Anita",
          historial: "Juvenil",
        }),
      ),
    ).toMatchObject({
      ok: true,
      datos: { dorsal: 7, posicion: "DC", apodo: "Anita", historial_deportivo: ["Juvenil"] },
    });
  });

  it("lista por dorsal y deja al final a quien no lo tiene", async () => {
    const { guardarJugador, cargarJugadores } = await entorno();
    await guardarJugador(formulario({ ...base, nombre: "Sin dorsal" }));
    await guardarJugador(formulario({ ...base, nombre: "Diez", dorsal: "10" }));
    await guardarJugador(formulario({ ...base, nombre: "Dos", dorsal: "2" }));

    expect((await cargarJugadores("Femenino")).map((j) => j.nombre)).toEqual([
      "Dos",
      "Diez",
      "Sin dorsal",
    ]);
  });

  it("solo lista los de la categoría pedida", async () => {
    const { guardarJugador, cargarJugadores } = await entorno();
    await guardarJugador(formulario(base));
    await guardarJugador(formulario({ ...base, nombre: "Senior", categoria: "Senior" }));
    expect(await cargarJugadores("Femenino")).toHaveLength(1);
  });

  it("borra un jugador", async () => {
    const { guardarJugador, borrarJugador, cargarJugadores } = await entorno();
    const creado = await guardarJugador(formulario(base));
    if (!creado.ok) throw new Error("no se creó");
    expect(await borrarJugador(creado.datos.id)).toEqual({ ok: true, datos: null });
    expect(await cargarJugadores("Femenino")).toHaveLength(0);
  });
});
