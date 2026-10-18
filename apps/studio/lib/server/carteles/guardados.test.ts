import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PeticionCartel } from "@/lib/cartel2/modelo";

const render = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/cartel2/render", () => ({ renderizarCartel: render }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "sesion-prueba" }) }),
}));
const sinSesion = vi.hoisted(() => vi.fn(async (): Promise<Response | null> => null));
vi.mock("@/lib/server/acceso/sesion", () => ({ respuestaSinSesion: sinSesion }));

let raiz: string;
let partidoId: string;
let jugadorId: string;
let campoId: string;
let conexion: Awaited<ReturnType<(typeof import("@santiso/db"))["abrirDb"]>>;
let s: (typeof import("@santiso/db"))["schema"];
let api: typeof import("./guardados");

const equipo = { nombre: "Santiso", escudo: null, propio: true, color: "#ffff00", relieve: false };
const cabecera = {
  institucionales: [],
  patrocinadores: [],
  categoria: "Senior",
  competicion: "Liga",
  jornada: "1",
};
const peticion: PeticionCartel = {
  plantilla: "partido",
  composicion: "diagonal",
  datos: {
    ...cabecera,
    local: equipo,
    visitante: { ...equipo, nombre: "Rival", propio: false },
    fecha: "2026-10-18",
    hora: "17:00",
    campo: "Campo",
  },
};
const resultado: PeticionCartel = {
  plantilla: "resultado",
  datos: {
    ...cabecera,
    local: equipo,
    visitante: equipo,
    fecha: "2026-10-18",
    campo: "Campo",
    golesLocal: 1,
    golesVisitante: 0,
    goles: [],
    foto: { url: "data:image/png;base64,aW1hZ2Vu", x: 0.5, y: 0.5, estilo: "color" },
  },
};
const guardar = (peticiones: unknown[] = [peticion]) =>
  api.guardarCartelesPaso({
    partidoId,
    paso: "partido",
    peticiones,
    origen: "http://127.0.0.1:3000",
    sesion: "sesion-prueba",
  });

beforeEach(async () => {
  raiz = await mkdtemp(path.join(tmpdir(), "santiso-carteles-"));
  vi.stubEnv("SANTISO_DATA_DIR", raiz);
  vi.stubEnv("STUDIO_ACCESO", "0");
  vi.stubEnv("PORT", "3000");
  vi.resetModules();
  render.mockReset().mockResolvedValue(Buffer.from("png-prueba"));
  sinSesion.mockReset().mockResolvedValue(null);
  const bd = await import("@santiso/db");
  s = bd.schema;
  conexion = await bd.abrirDb(":memory:");
  await bd.migrarBd(conexion.db);
  globalThis.santisoConexionDb = Promise.resolve(conexion);
  const { db } = conexion;
  const [t] = await db.insert(s.temporadas).values({ nombre: "2026/27", activa: true }).returning();
  const [c] = await db
    .insert(s.competiciones)
    .values({ temporadaId: t!.id, categoria: "Senior", nombre: "Liga" })
    .returning();
  const [j] = await db.insert(s.jornadas).values({ competicionId: c!.id, numero: 1 }).returning();
  const [club, rival] = await db
    .insert(s.equipos)
    .values([
      { nombre: "Santiso", clave: "santiso", categoria: "Senior", esPropio: true },
      { nombre: "Rival", clave: "rival", categoria: "Senior" },
    ])
    .returning();
  const [campo] = await db.insert(s.campos).values({ nombre: "Campo", clave: "campo" }).returning();
  campoId = campo!.id;
  const [p] = await db
    .insert(s.partidos)
    .values({
      jornadaId: j!.id,
      equipoLocalId: club!.id,
      equipoVisitanteId: rival!.id,
      fecha: "2026-10-18T17:00",
      campoId,
    })
    .returning();
  partidoId = p!.id;
  const [jugador] = await db.insert(s.jugadores).values({ nombre: "Brais" }).returning();
  jugadorId = jugador!.id;
  await db
    .insert(s.jugadoresTemporada)
    .values({ jugadorId, temporadaId: t!.id, categoria: "Senior", dorsal: 7 });
  api = await import("./guardados");
});

afterEach(() => {
  conexion?.cerrar();
  globalThis.santisoConexionDb = undefined;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("huellas de datos visibles", () => {
  it("mantiene formatos del paso acordes con las medidas del motor", async () => {
    const { medidasDe, MEDIDAS, MEDIDAS_HISTORIA } = await import("@/lib/cartel2/modelo");
    expect(api.formatosDe("partido")).toEqual(["publicacion", "historia"]);
    expect(api.formatosDe("once")).toEqual(["historia"]);
    expect(medidasDe("alineacion")).toEqual(MEDIDAS_HISTORIA);
    for (const paso of ["convocatoria", "resultado", "cronoloxia", "noso11"] as const) {
      expect(api.formatosDe(paso)).toEqual(["publicacion"]);
      expect(medidasDe(paso === "noso11" ? "once" : paso)).toEqual(MEDIDAS);
    }
  });
  it("fecha y campo cambian partido; marcador y árbitro no", async () => {
    const inicial = await api.huellaPaso(partidoId, "partido");
    await conexion.db
      .update(s.partidos)
      .set({ arbitro: "Árbitro", golesLocal: 1, golesVisitante: 0 });
    expect(await api.huellaPaso(partidoId, "partido")).toBe(inicial);
    await conexion.db.update(s.partidos).set({ fecha: "2026-10-19T17:00" });
    const fecha = await api.huellaPaso(partidoId, "partido");
    expect(fecha).not.toBe(inicial);
    await conexion.db
      .update(s.campos)
      .set({ nombre: "Outro campo" })
      .where(eq(s.campos.id, campoId));
    expect(await api.huellaPaso(partidoId, "partido")).not.toBe(fecha);
  });

  it("convocatoria incluye selección, quedada, equipación y nota sin afectar partido", async () => {
    const partido = await api.huellaPaso(partidoId, "partido");
    const inicial = await api.huellaPaso(partidoId, "convocatoria");
    await conexion.db.insert(s.partidoConvocatorias).values({ partidoId, horaQuedada: "16:00" });
    let anterior = await api.huellaPaso(partidoId, "convocatoria");
    expect(anterior).not.toBe(inicial);
    await conexion.db.insert(s.partidoConvocados).values({ partidoId, jugadorId });
    expect(await api.huellaPaso(partidoId, "convocatoria")).not.toBe(anterior);
    for (const cambio of [
      { lugarQuedada: "Bar" },
      { equipacion: "Amarela" },
      { nota: "Puntualidade" },
    ]) {
      anterior = await api.huellaPaso(partidoId, "convocatoria");
      await conexion.db.update(s.partidoConvocatorias).set(cambio);
      expect(await api.huellaPaso(partidoId, "convocatoria")).not.toBe(anterior);
    }
    expect(await api.huellaPaso(partidoId, "partido")).toBe(partido);
  });

  it("once usa previa y noso11 usa acta, sin confundir ambas", async () => {
    const once = await api.huellaPaso(partidoId, "once");
    const noso11 = await api.huellaPaso(partidoId, "noso11");
    await conexion.db
      .insert(s.partidoAlineaciones)
      .values({ partidoId, jugadorId, titular: true, capitan: true });
    expect(await api.huellaPaso(partidoId, "once")).not.toBe(once);
    expect(await api.huellaPaso(partidoId, "noso11")).toBe(noso11);
    await conexion.db
      .insert(s.partidoParticipaciones)
      .values({ partidoId, jugadorId, titular: true, jugo: true });
    expect(await api.huellaPaso(partidoId, "noso11")).not.toBe(noso11);
  });

  it("resultado detecta goles; cronología también tarjetas; minutos solo afectan cronología", async () => {
    const resultado = await api.huellaPaso(partidoId, "resultado");
    const cronoloxia = await api.huellaPaso(partidoId, "cronoloxia");
    await conexion.db
      .insert(s.partidoEventos)
      .values({ partidoId, jugadorId, tipo: "tarjeta_amarilla", lado: "propio", minuto: 10 });
    expect(await api.huellaPaso(partidoId, "resultado")).toBe(resultado);
    expect(await api.huellaPaso(partidoId, "cronoloxia")).not.toBe(cronoloxia);
    await conexion.db
      .insert(s.partidoEventos)
      .values({ partidoId, jugadorId, tipo: "gol", lado: "propio", minuto: 12 });
    const gol = await api.huellaPaso(partidoId, "resultado");
    expect(gol).not.toBe(resultado);
    await conexion.db
      .update(s.partidoEventos)
      .set({ minuto: 15 })
      .where(eq(s.partidoEventos.tipo, "gol"));
    expect(await api.huellaPaso(partidoId, "resultado")).toBe(gol);
  });
});

describe("PNG persistidos", () => {
  it("guarda, reabre y sustituye borrando PNG anterior", async () => {
    await guardar();
    const [anterior] = await conexion.db.select().from(s.cartelesPartido);
    expect(await readFile(path.join(raiz, "media", anterior!.clave), "utf8")).toBe("png-prueba");
    expect(await api.peticionGuardada(partidoId, "partido")).toEqual([peticion]);
    await guardar();
    const filas = await conexion.db.select().from(s.cartelesPartido);
    expect(filas).toHaveLength(1);
    expect(filas[0]!.clave).not.toBe(anterior!.clave);
    await expect(readFile(path.join(raiz, "media", anterior!.clave))).rejects.toThrow();
    expect(await readFile(path.join(raiz, "media", filas[0]!.clave), "utf8")).toBe("png-prueba");
  });

  it("un fallo en segundo render conserva filas y ficheros de ambos formatos", async () => {
    const historia = { ...peticion, formato: "historia" };
    await guardar([peticion, historia]);
    const anteriores = await conexion.db.select().from(s.cartelesPartido);
    render
      .mockResolvedValueOnce(Buffer.from("nuevo"))
      .mockRejectedValueOnce(new Error("render roto"));
    await expect(guardar([peticion, historia])).rejects.toThrow("render roto");
    expect(await conexion.db.select().from(s.cartelesPartido)).toEqual(anteriores);
    for (const fila of anteriores)
      expect(await readFile(path.join(raiz, "media", fila.clave), "utf8")).toBe("png-prueba");
  });

  it("extrae fotos data y conserva solo URL local en petición guardada", async () => {
    await api.guardarCartelesPaso({
      partidoId,
      paso: "resultado",
      peticiones: [resultado],
      origen: "http://127.0.0.1:3000",
    });
    const [guardada] = await api.peticionGuardada(partidoId, "resultado");
    expect(JSON.stringify(guardada)).not.toContain("data:image");
    const url = (guardada as typeof resultado).datos.foto!.url;
    expect(url).toMatch(new RegExp(`^/media/carteles/${partidoId}/fotos/[a-f0-9]{64}\\.png$`));
    expect(await readFile(path.join(raiz, url.slice(1)), "utf8")).toBe("imagen");
  });

  it("devuelve la foto subida del cartel guardado para reabrirlo, y no la del jugador", async () => {
    expect(await api.fotoGuardada(partidoId, "resultado")).toBeNull();
    await api.guardarCartelesPaso({
      partidoId,
      paso: "resultado",
      peticiones: [resultado],
      origen: "http://127.0.0.1:3000",
    });
    const foto = await api.fotoGuardada(partidoId, "resultado");
    expect(foto).toMatchObject({ x: 0.5, y: 0.5, estilo: "color" });
    expect(foto!.url).toMatch(new RegExp(`^/media/carteles/${partidoId}/fotos/`));
    const delJugador = {
      ...resultado,
      datos: { ...resultado.datos, foto: { ...resultado.datos.foto!, url: "/media/jugadores/a.webp" } },
    } as PeticionCartel;
    await api.guardarCartelesPaso({
      partidoId,
      paso: "resultado",
      peticiones: [delJugador],
      origen: "http://127.0.0.1:3000",
    });
    expect(await api.fotoGuardada(partidoId, "resultado")).toBeNull();
  });

  it("marca desactualizado tras cambiar fecha y carga varios partidos sin N+1", async () => {
    await guardar();
    const [original] = await conexion.db
      .select()
      .from(s.partidos)
      .where(eq(s.partidos.id, partidoId));
    const otros: string[] = [];
    for (const numero of [2, 3]) {
      const [jornada] = await conexion.db
        .insert(s.jornadas)
        .values({
          competicionId: (await conexion.db.select().from(s.jornadas))[0]!.competicionId,
          numero,
        })
        .returning();
      const [nuevo] = await conexion.db
        .insert(s.partidos)
        .values({
          jornadaId: jornada!.id,
          equipoLocalId: original!.equipoLocalId,
          equipoVisitanteId: original!.equipoVisitanteId,
          fecha: original!.fecha,
        })
        .returning();
      otros.push(nuevo!.id);
      await api.guardarCartelesPaso({
        partidoId: nuevo!.id,
        paso: "partido",
        peticiones: [peticion],
        origen: "http://127.0.0.1:3000",
      });
    }
    const estado = await api.cartelesDePartidos([partidoId]);
    expect(estado[partidoId]?.partido?.[0]).toMatchObject({
      formato: "publicacion",
      desactualizado: false,
    });
    await conexion.db.update(s.partidos).set({ fecha: "2026-10-20T18:00" });
    const ejecutar = vi.spyOn(conexion.cliente, "execute");
    const varios = await api.cartelesDePartidos([partidoId, ...otros]);
    expect(varios[partidoId]?.partido?.[0]?.desactualizado).toBe(true);
    expect(Object.keys(varios)).toHaveLength(3);
    expect(ejecutar.mock.calls.length).toBeLessThanOrEqual(10);
    expect(await api.cartelesDePartidos([])).toEqual({});
    expect(await api.peticionGuardada("ausente", "partido")).toEqual([]);
  });

  it("rechaza rutas inseguras, formatos duplicados y plantillas incompatibles antes de escribir", async () => {
    await expect(guardar([peticion, peticion])).rejects.toThrow();
    await expect(guardar([resultado])).rejects.toThrow();
    await expect(
      api.guardarCartelesPaso({
        partidoId,
        paso: "resultado",
        peticiones: [{ ...resultado, formato: "historia" }],
        origen: "http://127.0.0.1:3000",
      }),
    ).rejects.toThrow();
    await expect(
      api.guardarCartelesPaso({
        partidoId: "../../fuera",
        paso: "partido",
        peticiones: [peticion],
        origen: "http://127.0.0.1:3000",
      }),
    ).rejects.toThrow();
    expect(await conexion.db.select().from(s.cartelesPartido)).toEqual([]);
    expect(await readdir(raiz)).toEqual([]);
  });

  it("carga desde acción de servidor con Resultado", async () => {
    await guardar();
    const { cargarCartelesPartido } = await import("@/lib/server/acciones/carteles-guardados");
    expect(await cargarCartelesPartido([partidoId])).toMatchObject({
      ok: true,
      datos: { [partidoId]: { partido: [{ formato: "publicacion", desactualizado: false }] } },
    });
  });
});

describe("ruta de guardado", () => {
  const pedir = (cuerpo: unknown) =>
    new Request("http://localhost/api/carteles/guardar", {
      method: "POST",
      body: JSON.stringify(cuerpo),
    });

  it("rechaza plantilla que no corresponde al paso", async () => {
    const { POST } = await import("@/app/api/carteles/guardar/route");
    const respuesta = await POST(pedir({ partidoId, paso: "once", peticiones: [peticion] }));
    expect(respuesta.status).toBe(400);
    expect(await conexion.db.select().from(s.cartelesPartido)).toEqual([]);
  });

  it("devuelve estado del paso y pasa cookie y origen local al render", async () => {
    const { POST } = await import("@/app/api/carteles/guardar/route");
    const respuesta = await POST(pedir({ partidoId, paso: "partido", peticiones: [peticion] }));
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toMatchObject([
      { formato: "publicacion", desactualizado: false },
    ]);
    expect(render).toHaveBeenCalledWith("http://127.0.0.1:3000", peticion, "sesion-prueba");
  });

  it("distingue falta de sesión, entrada inválida, partido ausente y capacidad", async () => {
    const { POST } = await import("@/app/api/carteles/guardar/route");
    sinSesion.mockResolvedValueOnce(Response.json({ error: "Sin sesión" }, { status: 401 }));
    expect((await POST(pedir({}))).status).toBe(401);
    for (const cuerpo of [
      null,
      {},
      { partidoId, paso: "otro", peticiones: [peticion] },
      { partidoId, paso: "partido", peticiones: [] },
    ])
      expect((await POST(pedir(cuerpo))).status).toBe(400);
    expect(
      (await POST(pedir({ partidoId: "ausente", paso: "partido", peticiones: [peticion] }))).status,
    ).toBe(404);
    const { ErrorCapacidadCartel } = await import("@/lib/cartel2/lectura");
    render.mockRejectedValueOnce(new ErrorCapacidadCartel());
    expect((await POST(pedir({ partidoId, paso: "partido", peticiones: [peticion] }))).status).toBe(
      422,
    );
  });
});
