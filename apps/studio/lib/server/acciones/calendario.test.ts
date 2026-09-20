import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** BD con temporada activa, una competición y tres equipos inscritos. */
async function entorno() {
  const dir = mkdtempSync(path.join(tmpdir(), "santiso-calendario-"));
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
  const equipos = await db
    .insert(bd.schema.equipos)
    .values([
      { nombre: "Alfa", clave: "alfa", categoria: "Senior" },
      { nombre: "Beta", clave: "beta", categoria: "Senior" },
      { nombre: "Gamma", clave: "gamma", categoria: "Senior" },
    ])
    .returning({ id: bd.schema.equipos.id, nombre: bd.schema.equipos.nombre });
  await db
    .insert(bd.schema.competicionEquipos)
    .values(equipos.map((e) => ({ competicionId: competicion.id, equipoId: e.id })));
  cerrar();

  const idDe = (nombre: string) => {
    const encontrado = equipos.find((e) => e.nombre === nombre);
    if (!encontrado) throw new Error(`sin equipo ${nombre}`);
    return encontrado.id;
  };
  return { acciones: await import("./calendario"), competicionId: competicion.id, idDe };
}

/** Crea la jornada 1 y devuelve su id. */
async function conJornada(acciones: typeof import("./calendario"), competicionId: string) {
  const jornada = await acciones.crearJornada({
    competicionId,
    numero: "1",
    fechaInicio: "",
    nombreFase: "",
  });
  if (!jornada.ok) throw new Error("sin jornada");
  return jornada.datos.id;
}

describe("acciones de calendario", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.SANTISO_DATA_DIR;
    vi.restoreAllMocks();
  });

  it("crea una jornada y la lista", async () => {
    const { acciones, competicionId } = await entorno();
    expect(
      await acciones.crearJornada({ competicionId, numero: "1", fechaInicio: "", nombreFase: "" }),
    ).toMatchObject({ ok: true, datos: { numero: 1, nombre_fase: null, fecha_inicio: null } });

    const pantalla = await acciones.cargarPantallaCalendario(competicionId, "");
    expect(pantalla.jornadas.map((j) => j.numero)).toEqual([1]);
    expect(pantalla.equipos).toHaveLength(3);
  });

  it("rechaza una jornada con número repetido", async () => {
    const { acciones, competicionId } = await entorno();
    await acciones.crearJornada({ competicionId, numero: "1", fechaInicio: "", nombreFase: "" });
    expect(
      await acciones.crearJornada({ competicionId, numero: "1", fechaInicio: "", nombreFase: "" }),
    ).toMatchObject({ ok: false, error: "Ya existe la jornada 1 en esta competición." });
  });

  it("rechaza un número de jornada que no es positivo", async () => {
    const { acciones, competicionId } = await entorno();
    expect(
      await acciones.crearJornada({ competicionId, numero: "0", fechaInicio: "", nombreFase: "" }),
    ).toMatchObject({ ok: false });
    expect(
      await acciones.crearJornada({ competicionId, numero: "no", fechaInicio: "", nombreFase: "" }),
    ).toMatchObject({ ok: false });
  });

  it("crea en lote solo las jornadas que faltan", async () => {
    const { acciones, competicionId } = await entorno();
    await acciones.crearJornada({ competicionId, numero: "2", fechaInicio: "", nombreFase: "" });

    expect(await acciones.crearJornadasEnLote(competicionId, 4)).toEqual({ ok: true, datos: 3 });

    const pantalla = await acciones.cargarPantallaCalendario(competicionId, "");
    expect(pantalla.jornadas.map((j) => j.numero)).toEqual([1, 2, 3, 4]);
  });

  it("crear en lote cuando ya están todas no crea ninguna", async () => {
    const { acciones, competicionId } = await entorno();
    await acciones.crearJornadasEnLote(competicionId, 2);
    expect(await acciones.crearJornadasEnLote(competicionId, 2)).toEqual({ ok: true, datos: 0 });
  });

  it("crea un partido y lo lista en su jornada", async () => {
    const { acciones, competicionId, idDe } = await entorno();
    const jornadaId = await conJornada(acciones, competicionId);

    expect(
      await acciones.crearPartido({
        jornadaId,
        equipoLocalId: idDe("Alfa"),
        equipoVisitanteId: idDe("Beta"),
        fecha: "2026-09-20T18:00",
        campoId: "",
      }),
    ).toMatchObject({
      ok: true,
      datos: { estado: "programado", goles_local: null, goles_visitante: null },
    });

    const pantalla = await acciones.cargarPantallaCalendario(competicionId, jornadaId);
    expect(pantalla.partidos).toHaveLength(1);
  });

  it("rechaza un partido con el mismo equipo a los dos lados", async () => {
    const { acciones, competicionId, idDe } = await entorno();
    const jornadaId = await conJornada(acciones, competicionId);

    expect(
      await acciones.crearPartido({
        jornadaId,
        equipoLocalId: idDe("Alfa"),
        equipoVisitanteId: idDe("Alfa"),
        fecha: "",
        campoId: "",
      }),
    ).toMatchObject({ ok: false });
  });

  it("rechaza repetir el mismo cruce en la misma jornada", async () => {
    const { acciones, competicionId, idDe } = await entorno();
    const jornadaId = await conJornada(acciones, competicionId);
    const cruce = {
      jornadaId,
      equipoLocalId: idDe("Alfa"),
      equipoVisitanteId: idDe("Beta"),
      fecha: "",
      campoId: "",
    };
    await acciones.crearPartido(cruce);
    expect(await acciones.crearPartido(cruce)).toMatchObject({ ok: false });
  });

  it("guarda un marcador completo y deja el partido finalizado", async () => {
    const { acciones, competicionId, idDe } = await entorno();
    const jornadaId = await conJornada(acciones, competicionId);
    const partido = await acciones.crearPartido({
      jornadaId,
      equipoLocalId: idDe("Alfa"),
      equipoVisitanteId: idDe("Beta"),
      fecha: "",
      campoId: "",
    });
    if (!partido.ok) throw new Error("sin partido");

    expect(await acciones.guardarMarcador(partido.datos.id, "2", "1")).toMatchObject({
      ok: true,
      datos: { goles_local: 2, goles_visitante: 1, estado: "finalizado" },
    });
  });

  it("borrar el marcador devuelve el partido a programado", async () => {
    const { acciones, competicionId, idDe } = await entorno();
    const jornadaId = await conJornada(acciones, competicionId);
    const partido = await acciones.crearPartido({
      jornadaId,
      equipoLocalId: idDe("Alfa"),
      equipoVisitanteId: idDe("Beta"),
      fecha: "",
      campoId: "",
    });
    if (!partido.ok) throw new Error("sin partido");
    await acciones.guardarMarcador(partido.datos.id, "2", "1");

    expect(await acciones.guardarMarcador(partido.datos.id, "", "")).toMatchObject({
      ok: true,
      datos: { goles_local: null, goles_visitante: null, estado: "programado" },
    });
  });

  it("rechaza un marcador a medias o con goles no válidos", async () => {
    const { acciones, competicionId, idDe } = await entorno();
    const jornadaId = await conJornada(acciones, competicionId);
    const partido = await acciones.crearPartido({
      jornadaId,
      equipoLocalId: idDe("Alfa"),
      equipoVisitanteId: idDe("Beta"),
      fecha: "",
      campoId: "",
    });
    if (!partido.ok) throw new Error("sin partido");

    expect(await acciones.guardarMarcador(partido.datos.id, "2", "")).toMatchObject({
      ok: false,
      error: "El marcador debe tener los dos goles o ninguno.",
    });
    expect(await acciones.guardarMarcador(partido.datos.id, "-1", "0")).toMatchObject({
      ok: false,
    });
  });

  it("se niega a marcar finalizado un partido sin marcador", async () => {
    const { acciones, competicionId, idDe } = await entorno();
    const jornadaId = await conJornada(acciones, competicionId);
    const partido = await acciones.crearPartido({
      jornadaId,
      equipoLocalId: idDe("Alfa"),
      equipoVisitanteId: idDe("Beta"),
      fecha: "",
      campoId: "",
    });
    if (!partido.ok) throw new Error("sin partido");

    expect(await acciones.cambiarEstadoPartido(partido.datos.id, "finalizado")).toMatchObject({
      ok: false,
      error: "Un partido finalizado necesita marcador.",
    });
    expect(await acciones.cambiarEstadoPartido(partido.datos.id, "aplazado")).toEqual({
      ok: true,
      datos: null,
    });
    expect(await acciones.cambiarEstadoPartido(partido.datos.id, "inventado")).toMatchObject({
      ok: false,
    });
  });

  it("añade y quita descansos por par (jornada, equipo)", async () => {
    const { acciones, competicionId, idDe } = await entorno();
    const jornadaId = await conJornada(acciones, competicionId);

    expect(await acciones.anadirDescanso(jornadaId, idDe("Gamma"))).toEqual({
      ok: true,
      datos: null,
    });
    // Repetirlo no falla: la clave primaria compuesta lo absorbe.
    expect(await acciones.anadirDescanso(jornadaId, idDe("Gamma"))).toEqual({
      ok: true,
      datos: null,
    });

    let pantalla = await acciones.cargarPantallaCalendario(competicionId, jornadaId);
    expect(pantalla.descansos).toHaveLength(1);

    expect(await acciones.quitarDescanso(jornadaId, idDe("Gamma"))).toEqual({
      ok: true,
      datos: null,
    });
    pantalla = await acciones.cargarPantallaCalendario(competicionId, jornadaId);
    expect(pantalla.descansos).toHaveLength(0);
  });

  it("se niega a dar descanso a un equipo que ya juega esa jornada", async () => {
    const { acciones, competicionId, idDe } = await entorno();
    const jornadaId = await conJornada(acciones, competicionId);
    await acciones.crearPartido({
      jornadaId,
      equipoLocalId: idDe("Alfa"),
      equipoVisitanteId: idDe("Beta"),
      fecha: "",
      campoId: "",
    });

    expect(await acciones.anadirDescanso(jornadaId, idDe("Alfa"))).toMatchObject({
      ok: false,
      error: "Ese equipo ya tiene partido en esta jornada.",
    });
    expect(await acciones.anadirDescanso(jornadaId, idDe("Beta"))).toMatchObject({
      ok: false,
      error: "Ese equipo ya tiene partido en esta jornada.",
    });
  });

  it("borrar una jornada se lleva sus partidos y descansos", async () => {
    const { acciones, competicionId, idDe } = await entorno();
    const jornadaId = await conJornada(acciones, competicionId);
    await acciones.crearPartido({
      jornadaId,
      equipoLocalId: idDe("Alfa"),
      equipoVisitanteId: idDe("Beta"),
      fecha: "",
      campoId: "",
    });
    await acciones.anadirDescanso(jornadaId, idDe("Gamma"));

    expect(await acciones.borrarJornada(jornadaId)).toEqual({ ok: true, datos: null });

    const pantalla = await acciones.cargarPantallaCalendario(competicionId, "");
    expect(pantalla.jornadas).toHaveLength(0);
    expect(pantalla.partidos).toHaveLength(0);
  });

  it("borra un partido suelto", async () => {
    const { acciones, competicionId, idDe } = await entorno();
    const jornadaId = await conJornada(acciones, competicionId);
    const partido = await acciones.crearPartido({
      jornadaId,
      equipoLocalId: idDe("Alfa"),
      equipoVisitanteId: idDe("Beta"),
      fecha: "",
      campoId: "",
    });
    if (!partido.ok) throw new Error("sin partido");

    expect(await acciones.borrarPartido(partido.datos.id)).toEqual({ ok: true, datos: null });
    const pantalla = await acciones.cargarPantallaCalendario(competicionId, jornadaId);
    expect(pantalla.partidos).toHaveLength(0);
  });

  it("cambia fecha y campo de un partido", async () => {
    const { acciones, competicionId, idDe } = await entorno();
    const jornadaId = await conJornada(acciones, competicionId);
    const partido = await acciones.crearPartido({
      jornadaId,
      equipoLocalId: idDe("Alfa"),
      equipoVisitanteId: idDe("Beta"),
      fecha: "",
      campoId: "",
    });
    if (!partido.ok) throw new Error("sin partido");

    const { asegurarCampo } = await import("./campos");
    const campo = await asegurarCampo("A Carballeira", "Santiso");
    if (!campo.ok) throw new Error("sin campo");

    expect(await acciones.cambiarFechaPartido(partido.datos.id, "2026-10-01T17:00")).toEqual({
      ok: true,
      datos: null,
    });
    expect(await acciones.cambiarCampoPartido(partido.datos.id, campo.datos.id)).toEqual({
      ok: true,
      datos: null,
    });

    const pantalla = await acciones.cargarPantallaCalendario(competicionId, jornadaId);
    expect(pantalla.partidos[0]).toMatchObject({
      fecha: "2026-10-01T17:00",
      campo_id: campo.datos.id,
    });
    expect(pantalla.campos.map((c) => c.nombre)).toEqual(["A Carballeira"]);
  });
});
