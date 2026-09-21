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
  // Dos temporadas: la anterior para traer jugadores y la activa, que es la que se edita.
  const temporadas = await inicial.db
    .insert(bd.schema.temporadas)
    .values([
      { nombre: "2025/26", activa: false },
      { nombre: "2026/27", activa: true },
    ])
    .returning({ id: bd.schema.temporadas.id, nombre: bd.schema.temporadas.nombre });
  inicial.cerrar();
  const idDe = (nombre: string) => {
    const t = temporadas.find((x) => x.nombre === nombre);
    if (!t) throw new Error(`sin temporada ${nombre}`);
    return t.id;
  };
  return {
    ...(await import("./jugadores")),
    anterior: idDe("2025/26"),
    activa: idDe("2026/27"),
    bd,
    dir,
  };
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

  it("sin decir temporada, trabaja en la activa", async () => {
    const { guardarJugador, activa } = await entorno();
    const creado = await guardarJugador(formulario(base));
    expect(creado).toMatchObject({ ok: true, datos: { temporada_id: activa } });
  });

  it("la misma persona tiene dorsal y foto distintos cada temporada", async () => {
    const { guardarJugador, cargarJugadores, anterior, activa } = await entorno();
    const antes = await guardarJugador(formulario({ ...base, temporadaId: anterior, dorsal: "9" }));
    if (!antes.ok) throw new Error("no se creó");
    await guardarJugador(
      formulario({ ...base, id: antes.datos.id, temporadaId: activa, dorsal: "10" }),
    );

    expect((await cargarJugadores("Femenino", anterior))[0]).toMatchObject({ dorsal: 9 });
    expect((await cargarJugadores("Femenino", activa))[0]).toMatchObject({
      id: antes.datos.id,
      dorsal: 10,
    });
  });

  it("quitar de una temporada no toca las demás ni borra a quien tiene historia", async () => {
    const { guardarJugador, quitarJugadorDeTemporada, cargarJugadores, anterior, activa } =
      await entorno();
    const antes = await guardarJugador(formulario({ ...base, temporadaId: anterior }));
    if (!antes.ok) throw new Error("no se creó");
    const ahora = await guardarJugador(
      formulario({ ...base, id: antes.datos.id, temporadaId: activa }),
    );
    if (!ahora.ok) throw new Error("no se inscribió");

    expect(await quitarJugadorDeTemporada(ahora.datos.inscripcion_id)).toEqual({
      ok: true,
      datos: null,
    });
    expect(await cargarJugadores("Femenino", activa)).toHaveLength(0);
    expect(await cargarJugadores("Femenino", anterior)).toHaveLength(1);
  });

  it("quitar al único alta de alguien sin partidos lo borra: era un error", async () => {
    const { guardarJugador, quitarJugadorDeTemporada, buscarJugadoresParecidos } = await entorno();
    const creado = await guardarJugador(formulario({ ...base, nombre: "Errata Total" }));
    if (!creado.ok) throw new Error("no se creó");
    await quitarJugadorDeTemporada(creado.datos.inscripcion_id);
    expect(await buscarJugadoresParecidos("Errata Total")).toEqual([]);
  });

  it("propone a los del año pasado que aún no están, y los trae con su dorsal y su foto", async () => {
    const {
      guardarJugador,
      cargarCandidatosJugadores,
      incorporarJugadores,
      cargarJugadores,
      anterior,
      activa,
    } = await entorno();
    const foto = new File([await pngRojo()], "f.png", { type: "image/png" });
    const sigue = await guardarJugador(
      formulario({ ...base, nombre: "Sigue", temporadaId: anterior, dorsal: "9", posicion: "DC" }, foto),
    );
    const cambiaDorsal = await guardarJugador(
      formulario({ ...base, nombre: "Cambia", temporadaId: anterior, dorsal: "4" }),
    );
    await guardarJugador(formulario({ ...base, nombre: "Se fue", temporadaId: anterior }));
    if (!sigue.ok || !cambiaDorsal.ok) throw new Error("no se crearon");

    const candidatos = await cargarCandidatosJugadores("Femenino", activa);
    expect(candidatos.origen?.nombre).toBe("2025/26");
    expect(candidatos.jugadores.map((j) => j.nombre).sort()).toEqual(["Cambia", "Se fue", "Sigue"]);

    expect(
      await incorporarJugadores({
        temporadaId: activa,
        categoria: "Femenino",
        jugadores: [
          { jugadorId: sigue.datos.id, desdeInscripcionId: sigue.datos.inscripcion_id },
          {
            jugadorId: cambiaDorsal.datos.id,
            desdeInscripcionId: cambiaDorsal.datos.inscripcion_id,
            dorsal: 14,
          },
        ],
      }),
    ).toEqual({ ok: true, datos: 2 });

    const ahora = await cargarJugadores("Femenino", activa);
    expect(ahora.find((j) => j.nombre === "Sigue")).toMatchObject({
      dorsal: 9,
      posicion: "DC",
      foto_url: sigue.datos.foto_url,
    });
    expect(ahora.find((j) => j.nombre === "Cambia")).toMatchObject({ dorsal: 14 });
    // Ya incorporados, dejan de proponerse.
    expect((await cargarCandidatosJugadores("Femenino", activa)).jugadores.map((j) => j.nombre)).toEqual([
      "Se fue",
    ]);
  });

  it("avisa de nombres parecidos para no duplicar a la misma persona", async () => {
    const { guardarJugador, buscarJugadoresParecidos, anterior } = await entorno();
    await guardarJugador(formulario({ ...base, nombre: "Xan Fiel Pérez", temporadaId: anterior }));
    expect(await buscarJugadoresParecidos("xan fiel perez")).toEqual([
      expect.objectContaining({ nombre: "Xan Fiel Pérez", ultimaTemporada: "2025/26" }),
    ]);
    expect(await buscarJugadoresParecidos("Brais Rei")).toEqual([]);
  });
});
