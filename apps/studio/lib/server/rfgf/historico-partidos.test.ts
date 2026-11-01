import { readFileSync } from "node:fs";
import path from "node:path";
import { schema as s, type ConexionDb } from "@santiso/db";
import { crearDbPrueba } from "@santiso/db/testing";
import { eq, sql } from "drizzle-orm";
import { alineacionesDeFicha, eventosDeFicha } from "@/lib/liga/eventos";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Calendario, Ficha } from "@santiso/actas";
import type { DescargadorRfgf } from "./descargador";

const simulacion = vi.hoisted(() => ({ calendario: null as Calendario | null, web: "" }));
vi.mock("@santiso/actas", async (original) => ({
  ...(await original<typeof import("@santiso/actas")>()),
  parsearCalendarioPdf: async () => {
    if (!simulacion.calendario) throw new Error("Formato de calendario no soportado");
    return simulacion.calendario;
  },
  parsearJornadaPdf: async (bytes: Uint8Array) =>
    (await import("@santiso/actas")).parsearJornada(new TextDecoder().decode(bytes)),
}));

const AHORA = new Date("2026-10-17T12:00:00Z"); // Prioridad del archivo.
const fixture = (nombre: string) =>
  new Uint8Array(
    readFileSync(
      path.resolve(__dirname, `../../../../../packages/actas/src/fixtures/${nombre}.pdf`),
    ),
  );
let conexion: ConexionDb;
let fichas: Ficha[];
let archivo: typeof import("./historico-partidos");
let historico: typeof import("./historico");

beforeEach(async () => {
  conexion = await crearDbPrueba();
  globalThis.santisoConexionDb = Promise.resolve(conexion);
  const { parsearFichaPdf } = await import("@santiso/actas");
  fichas = await Promise.all(["senior-1", "senior-18"].map((n) => parsearFichaPdf(fixture(n))));
  archivo = await import("./historico-partidos");
  historico = await import("./historico");
  const equipo = (nombre: string) => ({ nombre, codigoFederativo: "0001" });
  simulacion.web = "";
  simulacion.calendario = {
    competicion: fichas[0]!.competicion,
    temporada: "2025-2026",
    equipos: [],
    jornadas: fichas.map((f) => ({
      numero: f.jornada,
      fechaNominal: f.fecha.slice(0, 10),
      partidos: [{ local: equipo(f.local.nombre), visitante: equipo(f.visitante.nombre) }],
    })),
  };
  await conexion.db.insert(s.rfgfGruposHistoricos).values({
    codGrupo: "300",
    categoria: "Senior",
    temporada: "2025-2026",
    competicion: "Tercera",
    grupo: "4",
    codCompeticion: "30",
    codEquipo: "12",
    estado: "sin_acta",
  });
  await conexion.db.insert(s.equipos).values({
    nombre: fichas[0]!.local.nombre,
    clave: "equipo local",
    categoria: "Senior",
    esPropio: true,
  });
  // Cualquier acceso real accidental hace fallar la prueba, incluida una lectura de fixture mal resuelta.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Red prohibida en pruebas");
    }),
  );
});
afterEach(() => {
  conexion?.cerrar();
  globalThis.santisoConexionDb = undefined;
  globalThis.santisoRedRfgfEnMarcha = false;
  simulacion.calendario = null;
  vi.unstubAllGlobals();
});

function descargador(): DescargadorRfgf & { llamadas: string[] } {
  const llamadas: string[] = [];
  return {
    llamadas,
    html: vi.fn(async (url: string) => {
      llamadas.push(url);
      if (url.includes("NFG_VisCalendario")) return simulacion.web;
      const n = Number(new URL(url).searchParams.get("CodJornada"));
      const f = fichas.find((f) => f.jornada === n)!;
      return `<a href="NFG_VisEquipos?Codigo_Equipo=12">${f.local.nombre}</a>
        <a href="NFG_CmpPartido?CodActa=${n}">999-999</a>
        <a href="NFG_VisEquipos?Codigo_Equipo=13">${f.visitante.nombre}</a>`;
    }),
    pdf: vi.fn(async (url: string) => {
      llamadas.push(url);
      const cod = new URL(url).searchParams.get("CodActa");
      return cod ? fixture(`senior-${cod}`) : new Uint8Array([0]);
    }),
  };
}
const tic = (d: DescargadorRfgf, n = 0, maximo = 2) =>
  historico.avanzarHistorico(d, new Date(AHORA.getTime() + n * 600_000), maximo);

it("pedir solo encola; sin petición no descarga partidos; solicitud repetida conserva progreso", async () => {
  const d = descargador();
  expect((await historico.estadoHistorico())[0]?.archivoPartidos.estado).toBe("no_pedido");
  await tic(d);
  expect(d.llamadas).toEqual([]);
  await archivo.pedirPartidosHistoricos("300", AHORA);
  expect(d.llamadas).toEqual([]);
  expect((await historico.estadoHistorico())[0]?.archivoPartidos.estado).toBe("en_cola");
  await tic(d);
  const antes = await archivo.partidosHistoricos("300");
  await archivo.pedirPartidosHistoricos("300", new Date(AHORA.getTime() + 10));
  expect(await archivo.partidosHistoricos("300")).toEqual(antes);
  await expect(archivo.pedirPartidosHistoricos("inexistente")).rejects.toThrow("grupo");
});

it("guarda resultado y eventos reales de ambos lados, ordenados y sin calendario activo", async () => {
  const d = descargador();
  await archivo.pedirPartidosHistoricos("300", AHORA);
  const estados: string[] = [];
  for (let i = 0; i < 6; i++) {
    const antes = d.llamadas.length;
    expect(await tic(d, i)).toBeLessThanOrEqual(2);
    expect(d.llamadas.length - antes).toBeLessThanOrEqual(2);
    estados.push((await historico.estadoHistorico())[0]!.archivoPartidos.texto);
  }
  const lectura = await archivo.partidosHistoricos("300");
  expect(lectura.resumen).toMatchObject({
    total: 2,
    listos: 2,
    pendientes: 0,
    estado: "terminado",
  });
  expect(estados).toContain("1 de 2 traídos");
  expect(estados.at(-1)).toBe("Todos traídos");
  expect(lectura.partidos.map((p) => p.jornada)).toEqual([1, 18]);
  for (const [i, p] of lectura.partidos.entries()) {
    const f = fichas[i]!;
    expect([p.golesLocal, p.golesVisitante]).toEqual(f.marcador);
    expect(p.fecha).toBe(f.fecha);
    expect(p.enlaceActa).toContain(`CodActa=${f.jornada}`);
    expect(p.eventos.filter((e) => e.tipo === "gol" || e.tipo === "gol_propia")).toHaveLength(
      f.goles.length,
    );
    expect(p.eventos.filter((e) => !e.tipo.startsWith("gol"))).toHaveLength(
      f.tarjetas.filter((t) => t.tipo !== "desconocido").length,
    );
    expect(new Set(p.eventos.map((e) => e.lado))).toEqual(new Set(["local", "visitante"]));
    expect(p.eventos.every((e) => e.persona && e.personaClave)).toBe(true);
    expect(
      p.eventos.map(({ lado, persona, personaClave, tipo, minuto, tecnico }) => ({
        lado,
        persona,
        personaClave,
        tipo,
        minuto,
        tecnico,
      })),
    ).toEqual(eventosDeFicha(f));
    const alineados = await conexion.db
      .select()
      .from(s.rfgfHistoricoAlineaciones)
      .where(eq(s.rfgfHistoricoAlineaciones.partidoId, p.id))
      .orderBy(sql`rowid`);
    expect(
      alineados.map(({ lado, persona, personaClave, dorsal, titular }) => ({
        lado,
        persona,
        personaClave,
        dorsal,
        titular,
      })),
    ).toEqual(alineacionesDeFicha(f));
    expect(alineados.length).toBeGreaterThanOrEqual(22);
  }
  for (const tabla of [s.partidos, s.jornadas, s.competiciones, s.ligaEventos, s.jugadores]) {
    expect(await conexion.db.select().from(tabla)).toEqual([]);
  }
});

it("acta fallida rota, deja avanzar otra y se reintenta en otro tic", async () => {
  const d = descargador(),
    pdf = d.pdf;
  let fallar = true;
  d.pdf = async (url) => {
    if (new URL(url).searchParams.get("CodActa") === "1" && fallar) {
      d.llamadas.push(url);
      fallar = false;
      throw new Error("Fallo de descarga simulado");
    }
    return pdf(url);
  };
  await archivo.pedirPartidosHistoricos("300", AHORA);
  await tic(d, 0); // Calendario y HTML 1.
  await tic(d, 1); // Acta 1 falla; HTML 18.
  expect((await archivo.partidosHistoricos("300")).partidos[0]).toMatchObject({
    estado: "error",
    intentos: 2,
  });
  await tic(d, 2, 1); // Primero acta no intentada 18.
  expect((await archivo.partidosHistoricos("300")).partidos[1]?.estado).toBe("listo");
  await tic(d, 3);
  expect((await archivo.partidosHistoricos("300")).resumen.estado).toBe("terminado");
  expect(d.llamadas.filter((url) => new URL(url).searchParams.get("CodActa") === "1")).toHaveLength(
    2,
  );
});

it("cifras y archivo comparten dos páginas incluso con errores y candado ocupado", async () => {
  const { db } = conexion;
  const [t] = await db.insert(s.temporadas).values({ nombre: "2026/27" }).returning();
  const [c] = await db
    .insert(s.competiciones)
    .values({ temporadaId: t!.id, categoria: "Senior", nombre: "Liga" })
    .returning();
  const [j] = await db.insert(s.jugadores).values({ nombre: "Jugador" }).returning();
  await db.update(s.rfgfGruposHistoricos).set({ codActa: "1", estado: "listo" });
  await db.insert(s.rfgfHistorico).values({ codGrupo: "300", jugadorId: j!.id, codigo: "45" });
  const d = descargador(),
    html = d.html;
  d.html = async (url) => {
    if (url.includes("Estadisticas")) {
      d.llamadas.push(url);
      throw new Error("Cifras no disponibles");
    }
    return html(url);
  };
  await archivo.pedirPartidosHistoricos("300", AHORA);
  for (let i = 0; i < 5; i++) {
    const antes = d.llamadas.length;
    expect(await tic(d, i)).toBeLessThanOrEqual(2);
    expect(d.llamadas.length - antes).toBeLessThanOrEqual(2);
  }
  expect(d.llamadas.some((url) => url.includes("Estadisticas"))).toBe(true);
  expect((await archivo.partidosHistoricos("300")).resumen.listos).toBeGreaterThan(0);
  expect(await db.select().from(s.competiciones)).toHaveLength(1);
  expect((await db.select().from(s.competiciones))[0]?.id).toBe(c!.id);
  globalThis.santisoRedRfgfEnMarcha = true;
  const antes = d.llamadas.length;
  expect(await tic(d, 6)).toBe(0);
  expect(d.llamadas).toHaveLength(antes);
});

it("calendario incompatible deja aviso y permite avanzar otro grupo", async () => {
  await conexion.db.insert(s.rfgfGruposHistoricos).values({
    codGrupo: "301",
    categoria: "Senior",
    temporada: "2024-2025",
    competicion: "Copa",
    grupo: "1",
    codCompeticion: "31",
    codEquipo: "12",
    estado: "sin_acta",
  });
  await archivo.pedirPartidosHistoricos("300", AHORA);
  await archivo.pedirPartidosHistoricos("301", AHORA);
  simulacion.calendario = null;
  simulacion.web = "<html>nada legible</html>";
  const d = descargador();
  await tic(d);
  const grupos = await historico.estadoHistorico();
  expect(grupos.every((g) => g.archivoPartidos.estado === "no_compatible")).toBe(true);
  expect(grupos.every((g) => g.archivoPartidos.aviso.includes("no soportado"))).toBe(true);
  // Cada grupo: su PDF y, como no era una liga, su página web.
  expect(d.llamadas).toHaveLength(4);
  expect(await conexion.db.select().from(s.rfgfHistoricoPartidos)).toEqual([]);
});

it("si el PDF no es una liga, saca de la web las rondas y los partidos del Santiso", async () => {
  await archivo.pedirPartidosHistoricos("300", AHORA);
  simulacion.calendario = null;
  const fila = (local: string, visitante: string) =>
    `<tr><td width="47%" align=right>${local}</td><td width="6%"></td><td width="47%" align=left>${visitante}</td></tr>`;
  simulacion.web = `<h4>COPA DO SAR<br><br>Temporada 2025-2026</h4>
    <table><tr><th colspan=4>Octavos , 06-12-2025</th></tr>${fila("U.D. SANTISO F.C.", "RIVAL")}${fila("OTRO", "OUTRO")}</table>
    <table><tr><th colspan=4>Cuartos , 11-02-2026</th></tr>${fila("RIVAL DOS", "U.D. SANTISO F.C.")}</table>
    <table><tr><th colspan=4>Final , 09-06-2026</th></tr>${fila("Equipo Casa (No asignado)", "Equipo Fuera (No asignado)")}</table>`;
  await tic(descargador());
  const partidos = await conexion.db.select().from(s.rfgfHistoricoPartidos);
  expect(partidos.map((p) => [p.jornada, p.santisoLocal]).sort()).toEqual([
    [1, true],
    [2, false],
  ]);
  expect((await historico.estadoHistorico())[0]?.archivoPartidos.estado).toBe("en_curso");
});

it("un fallo de red al traer el calendario no lo marca como no compatible", async () => {
  await archivo.pedirPartidosHistoricos("300", AHORA);
  simulacion.calendario = null;
  const d = descargador();
  d.pdf = vi.fn(async () => {
    throw new Error("La federación respondió 503.");
  });
  d.html = vi.fn(async () => {
    throw new Error("La federación respondió 503.");
  });
  await tic(d);
  expect((await historico.estadoHistorico())[0]?.archivoPartidos.estado).toBe("en_cola");
});

it("sin acta usa PDF de jornada y nunca toma el marcador del HTML", async () => {
  simulacion.calendario!.jornadas = simulacion.calendario!.jornadas.slice(0, 1);
  const d = descargador(),
    pdf = d.pdf;
  d.html = async (url) => {
    d.llamadas.push(url);
    return '<a href="NFG_VisEquipos?Codigo_Equipo=12">EQUIPO LOCAL</a> 99 - 99';
  };
  d.pdf = async (url) => {
    if (url.includes("CmpJornada")) {
      d.llamadas.push(url);
      return new TextEncoder().encode(
        "TERCERA FUTGAL Temporada 2025-2026\nJornada 1\nResultados\nEQUIPO LOCAL 2 - 1 14-09-2025 12:00 EQUIPO VISITANTE\nCampo: Municipal",
      );
    }
    return pdf(url);
  };
  await archivo.pedirPartidosHistoricos("300", AHORA);
  for (let i = 0; i < 3; i++) await tic(d, i);
  const { partidos, resumen } = await archivo.partidosHistoricos("300");
  expect(partidos[0]).toMatchObject({
    estado: "sin_acta",
    codActa: null,
    golesLocal: 2,
    golesVisitante: 1,
    eventos: [],
  });
  expect(resumen).toMatchObject({ estado: "terminado", listos: 0, sinActa: 1, pendientes: 0 });
  expect(d.llamadas).toHaveLength(3);
});

it("acta incompatible avisa; fallo posterior del PDF de jornada no repite esa acta", async () => {
  simulacion.calendario!.jornadas = simulacion.calendario!.jornadas.slice(0, 1);
  const d = descargador(),
    pdf = d.pdf;
  let fallaJornada = true;
  d.pdf = async (url) => {
    if (url.includes("CmpPartido")) {
      d.llamadas.push(url);
      return fixture("sin-texto");
    }
    if (url.includes("CmpJornada")) {
      d.llamadas.push(url);
      if (fallaJornada) {
        fallaJornada = false;
        throw new Error("Jornada temporalmente caída");
      }
      return new TextEncoder().encode(
        "TERCERA FUTGAL\nJornada 1\nEQUIPO LOCAL 0 - 0 14-09-2025 EQUIPO VISITANTE\nCampo: Municipal",
      );
    }
    return pdf(url);
  };
  await archivo.pedirPartidosHistoricos("300", AHORA);
  for (let i = 0; i < 6; i++) await tic(d, i);
  const lectura = await archivo.partidosHistoricos("300");
  expect(lectura.resumen.estado).toBe("terminado");
  expect(lectura.partidos[0]).toMatchObject({
    estado: "sin_acta",
    golesLocal: 0,
    golesVisitante: 0,
    eventos: [],
  });
  expect(lectura.partidos[0]?.aviso).toContain("Acta no soportada");
  expect(d.llamadas.filter((url) => url.includes("CmpPartido"))).toHaveLength(1);
});

it("descubre 26 partidos de fixture de calendario y separa fecha nominal de efectiva", async () => {
  const { parsearCalendario } = await import("@santiso/actas");
  const calendario = parsearCalendario(
    JSON.parse(
      readFileSync(
        path.resolve(
          __dirname,
          "../../../../../packages/actas/src/fixtures/calendario-senior.json",
        ),
        "utf8",
      ),
    ),
  );
  simulacion.calendario = calendario;
  await conexion.db.update(s.rfgfGruposHistoricos).set({ temporada: calendario.temporada });
  await conexion.db.update(s.equipos).set({ nombre: calendario.equipos[0]!.nombre });
  const d = descargador();
  await archivo.pedirPartidosHistoricos("300", AHORA);
  await tic(d, 0, 1);
  const lectura = await archivo.partidosHistoricos("300");
  expect(lectura.resumen).toMatchObject({
    total: 26,
    listos: 0,
    pendientes: 26,
    estado: "en_curso",
  });
  expect(lectura.partidos.every((p) => p.fecha === null && /^202[67]-/u.test(p.fechaNominal))).toBe(
    true,
  );
  expect(lectura.partidos.filter((p) => p.santisoLocal)).toHaveLength(13);
  expect(d.llamadas).toHaveLength(1);
});

it("fallo de calendario rota entre grupos y se reintenta después, sin tocar grupo no pedido", async () => {
  await conexion.db.insert(s.rfgfGruposHistoricos).values(
    ["301", "302"].map((codGrupo) => ({
      codGrupo,
      categoria: "Senior",
      temporada: "2025-2026",
      competicion: "Liga",
      grupo: "1",
      codCompeticion: "30",
      codEquipo: "12",
      estado: "sin_acta" as const,
    })),
  );
  await archivo.pedirPartidosHistoricos("300", AHORA);
  await archivo.pedirPartidosHistoricos("301", AHORA);
  const d = descargador(),
    pdf = d.pdf;
  let fallar = true;
  d.pdf = async (url) => {
    if (
      url.includes("Calendario") &&
      new URL(url).searchParams.get("codgrupo") === "300" &&
      fallar
    ) {
      d.llamadas.push(url);
      fallar = false;
      throw new Error("Fallo de calendario simulado");
    }
    return pdf(url);
  };
  await tic(d, 0);
  // El grupo que falla prueba también la web; el otro lee su PDF.
  expect(d.llamadas).toHaveLength(3);
  expect((await archivo.partidosHistoricos("301")).resumen.total).toBe(2);
  await tic(d, 1);
  expect((await archivo.partidosHistoricos("300")).resumen.total).toBe(2);
  expect((await archivo.partidosHistoricos("302")).resumen.estado).toBe("no_pedido");
  expect(
    d.llamadas.some((url) => url.includes("codgrupo=302") || url.includes("CodGrupo=302")),
  ).toBe(false);
  const [grupo] = await conexion.db
    .select()
    .from(s.rfgfGruposHistoricos)
    .where(eq(s.rfgfGruposHistoricos.codGrupo, "300"));
  expect(grupo?.partidosIntentos).toBe(2);
});
