import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, expect, it, vi } from "vitest";
import type { DescargadorRfgf } from "./descargador";

/**
 * Sincronización con la federación sobre una base de juguete. La web nunca se toca: el
 * descargador es de mentira y el PDF es la ficha anónima que ya usa el lector en sus pruebas.
 */

const FICHA = new Uint8Array(
  readFileSync(path.resolve(__dirname, "../../../../../packages/actas/src/fixtures/senior-1.pdf")),
);
const ENLACE =
  "https://www.futgal.es/pnfg/NPcd/NFG_VisCalendario_Vis?cod_primaria=1000120&codtemporada=22&codcompeticion=26990830&codgrupo=27576591";

// El PDF de jornada de mentira es su texto tal cual: aquí se prueba qué se hace con lo leído,
// no la lectura del PDF, que tiene sus pruebas en `@santiso/actas`.
vi.mock("@santiso/actas", async (original) => {
  const real = await original<typeof import("@santiso/actas")>();
  return {
    ...real,
    parsearJornadaPdf: async (bytes: Uint8Array) =>
      real.parsearJornada(new TextDecoder().decode(bytes)),
    // La clasificación oficial de mentira: vacía (nada que comparar) salvo que la prueba ponga una.
    parsearClasificacionPdf: async () => ({
      competicion: "TERCERA",
      jornada: 1,
      filas: globalThis.clasificacionDeMentira ?? [],
    }),
  };
});

declare global {
  var clasificacionDeMentira: import("@santiso/actas").FilaOficial[] | undefined;
}

/** El texto del PDF de una jornada. Sin partidos, no dice nada de ninguno. */
function pdfJornada(numero: number, partidos: string[] = []) {
  return [
    "TERCERA Temporada 2025-2026",
    `Jornada ${numero}`,
    "Resultados",
    ...partidos,
    "REAL FEDERACIÓN",
  ].join("\n");
}

const anterior = process.env.SANTISO_DATA_DIR;
afterEach(async () => {
  const conexion = await globalThis.santisoConexionDb;
  conexion?.cerrar();
  globalThis.santisoConexionDb = undefined;
  if (anterior === undefined) delete process.env.SANTISO_DATA_DIR;
  else process.env.SANTISO_DATA_DIR = anterior;
  vi.restoreAllMocks();
  globalThis.clasificacionDeMentira = undefined;
});

/** La página de una jornada con un único partido y su acta cerrada. */
function paginaJornada(local: string, visitante: string, codActa: string | null) {
  const acta = codActa
    ? `<a href="/pnfg/NPcd/NFG_CmpPartido?cod_primaria=1000120&CodActa=${codActa}&cod_acta=${codActa}" title="Acta del partido"></a>`
    : "";
  return `<html><body>${"<!-- relleno -->".repeat(200)}
    <a href="NFG_VisEquipos?cod_primaria=1000119&Codigo_Equipo=1">${local}</a>${acta}
    <a href="NFG_VisEquipos?cod_primaria=1000119&Codigo_Equipo=2">${visitante}</a></body></html>`;
}

/** La página web del partido: el visitante (el Santiso en la ficha de prueba) lleva dos jugadores. */
const filaJugador = (codigo: string, nombre: string) =>
  `<tr onclick="location.href='NFG_EstadisticasJugador?cod_primaria=5000274&jugador=${codigo}&codacta=900&nueva_ventana=';"> <td>1</td> <td> ${nombre}</td> </tr>`;
const PAGINA_PARTIDO = `<html><body><strong>Titulares</strong><table>${filaJugador("11", "RIVAL UN, XAN")}</table>
<strong>Titulares</strong><table>${filaJugador("21", "APELLIDO 20, PERSONA")}${filaJugador("22", "DESCONOCIDO TOTAL, NADIE")}</table></body></html>`;
const PAGINA_JUGADOR = `<html><body><a>Generar PDF</a><h4>APELLIDO 20, PERSONA</h4><span>Equipo:</span><b>EQUIPO VISITANTE</b>
<b>LIGA | GRUPO 1</b><strong>Temporada 2025-2026</strong>
<td>Convocados</td><td>3</td><td>Titular</td><td>2</td><td>Suplente</td><td>1</td><td>Jugados</td><td>3</td>
<td>Total</td><td>1</td><td>Tarjeta amarilla</td><td>1</td><td>Doble tarjeta amarilla</td><td>0</td><td>Tarjeta roja</td><td>0</td>
<h5>Goles</h5><td>Total</td><td>4</td></body></html>`;

function descargadorDe(html: string, jornada: string[] = []) {
  // `pdf` son las actas; los PDF de jornada se cuentan aparte.
  const pedidas = {
    html: [] as string[],
    /** Páginas de partido y de jugador, para las cifras oficiales: se cuentan aparte. */
    jugadores: [] as string[],
    pdf: [] as string[],
    jornadas: [] as number[],
    clasificaciones: 0,
  };
  const descargador: DescargadorRfgf = {
    async html(url) {
      if (url.includes("NFG_EstadisticasJugador")) {
        pedidas.jugadores.push(url);
        return PAGINA_JUGADOR;
      }
      if (url.includes("NFG_CmpPartido")) {
        pedidas.jugadores.push(url);
        return PAGINA_PARTIDO;
      }
      pedidas.html.push(url);
      return html;
    },
    async pdf(url) {
      if (url.includes("NFG_VisClasificacion")) {
        pedidas.clasificaciones += 1;
        return new Uint8Array();
      }
      const numero = /NFG_CmpJornada\?.*CodJornada=(\d+)/.exec(url)?.[1];
      if (numero) {
        pedidas.jornadas.push(Number(numero));
        return new TextEncoder().encode(pdfJornada(Number(numero), jornada));
      }
      pedidas.pdf.push(url);
      return FICHA;
    },
  };
  return { descargador, pedidas };
}

/** En la ficha de prueba el Santiso es el visitante y lleva a «APELLIDO 20…35, PERSONA». */
async function preparar({ santiso = true, sinJugador = false } = {}) {
  process.env.SANTISO_DATA_DIR = mkdtempSync(path.join(tmpdir(), "santiso-rfgf-"));
  vi.resetModules();
  globalThis.santisoConexionDb = undefined;
  const bd = await import("@santiso/db");
  const { db, cerrar } = await bd.abrirDb(
    bd.urlArchivo(path.join(process.env.SANTISO_DATA_DIR, "santiso.db")),
  );
  await bd.migrarBd(db);
  const s = bd.schema;
  const [t] = await db.insert(s.temporadas).values({ nombre: "2025/26", activa: true }).returning();
  const [c] = await db
    .insert(s.competiciones)
    .values({ temporadaId: t!.id, nombre: "Tercera", categoria: "Senior" })
    .returning();
  const [local, visitante] = await db
    .insert(s.equipos)
    .values([
      { nombre: "Equipo Local", clave: "equipo local", categoria: "Senior" },
      { nombre: "Equipo Visitante", clave: "equipo visitante", categoria: "Senior", esPropio: santiso },
    ])
    .returning();
  const [jornada] = await db
    .insert(s.jornadas)
    .values({ competicionId: c!.id, numero: 1 })
    .returning();
  const [p] = await db
    .insert(s.partidos)
    .values({
      jornadaId: jornada!.id,
      equipoLocalId: local!.id,
      equipoVisitanteId: visitante!.id,
      fecha: "2025-09-14T12:00",
    })
    .returning();
  const numeros = Array.from({ length: 16 }, (_, i) => 20 + i).filter((n) => !(sinJugador && n === 27));
  const personas = await db
    .insert(s.jugadores)
    .values(numeros.map((n) => ({ nombre: `Persona Apellido ${n}` })))
    .returning();
  await db.insert(s.jugadoresTemporada).values(
    personas.map((j, i) => ({
      temporadaId: t!.id,
      categoria: "Senior" as const,
      jugadorId: j.id,
      dorsal: i + 1,
    })),
  );
  await db.insert(s.rfgfCompeticiones).values({ competicionId: c!.id, enlace: ENLACE });
  cerrar();
  const { sincronizarCompeticion } = await import("./sincronizar");
  const leer = async () => (await (await import("@/lib/server/db")).obtenerDb()).db;
  return { s, competicionId: c!.id, partidoId: p!.id, sincronizarCompeticion, leer };
}

const AHORA = new Date(2025, 8, 15, 10);

it("guarda sola el acta del Santiso cuando reconoce a todos, y no la vuelve a pedir", async () => {
  const { s, competicionId, partidoId, sincronizarCompeticion, leer } = await preparar();
  const { descargador, pedidas } = descargadorDe(
    paginaJornada("EQUIPO LOCAL", "EQUIPO VISITANTE", "900"),
  );

  const resumen = await sincronizarCompeticion(competicionId, descargador, AHORA);
  expect(resumen).toMatchObject({ actas: 1, revisar: [], errores: [] });
  expect(pedidas.html).toHaveLength(1);
  expect(pedidas.html[0]).toContain("NFG_CmpJornada");
  expect(pedidas.html[0]).toContain("CodJornada=1");
  expect(pedidas.pdf).toEqual([
    "https://www.futgal.es/pnfg/NPcd/NFG_CmpPartido?cod_primaria=1000120&CodActa=900&cod_acta=900&NPcd_Pdf=1",
  ]);

  const db = await leer();
  const [partido] = await db.select().from(s.partidos).where(eq(s.partidos.id, partidoId));
  expect(partido).toMatchObject({ golesLocal: 8, golesVisitante: 2, estado: "finalizado" });
  const convocados = await db
    .select()
    .from(s.partidoParticipaciones)
    .where(eq(s.partidoParticipaciones.partidoId, partidoId));
  expect(convocados).toHaveLength(16);
  expect(convocados.filter((p) => p.titular)).toHaveLength(11);
  const eventos = await db
    .select()
    .from(s.partidoEventos)
    .where(eq(s.partidoEventos.partidoId, partidoId));
  expect(eventos.length).toBeGreaterThan(0);
  expect(await db.select().from(s.rfgfActas)).toMatchObject([
    { codActa: "900", partidoId, estado: "guardada" },
  ]);
  const [enlace] = await db.select().from(s.rfgfCompeticiones);
  expect(enlace?.comprobadoEn).toBe(AHORA.toISOString());
  expect(enlace?.resumen).toBe("1 acta guardada");

  // Segunda pasada: ya no falta nada, no se toca la web.
  const otra = await sincronizarCompeticion(competicionId, descargador, AHORA);
  expect(otra).toMatchObject({ actas: 0, resultados: 0 });
  expect(pedidas.html).toHaveLength(1);
  expect(pedidas.pdf).toHaveLength(1);
});

it("si no reconoce a un jugador guarda el marcador, no el acta, y deja el PDF para revisar", async () => {
  const { s, competicionId, partidoId, sincronizarCompeticion, leer } = await preparar({
    sinJugador: true,
  });
  const { descargador, pedidas } = descargadorDe(
    paginaJornada("EQUIPO LOCAL", "EQUIPO VISITANTE", "901"),
  );

  const resumen = await sincronizarCompeticion(competicionId, descargador, AHORA);
  expect(resumen).toMatchObject({ actas: 0, resultados: 1, errores: [] });
  expect(resumen?.revisar).toHaveLength(1);
  expect(resumen?.revisar[0]).toContain("APELLIDO 27, PERSONA");

  const db = await leer();
  const [partido] = await db.select().from(s.partidos).where(eq(s.partidos.id, partidoId));
  expect(partido).toMatchObject({ golesLocal: 8, golesVisitante: 2 });
  expect(await db.select().from(s.partidoParticipaciones)).toHaveLength(0);
  expect(await db.select().from(s.partidoEventos)).toHaveLength(0);
  expect(await db.select().from(s.rfgfActas)).toMatchObject([{ codActa: "901", estado: "revisar" }]);
  expect(existsSync(path.join(process.env.SANTISO_DATA_DIR!, "rfgf", "901.pdf"))).toBe(true);

  // Un acta por revisar no se descarga otra vez en cada pasada.
  await sincronizarCompeticion(competicionId, descargador, AHORA);
  expect(pedidas.pdf).toHaveLength(1);
});

it("de un partido ajeno solo guarda el resultado", async () => {
  const { s, competicionId, partidoId, sincronizarCompeticion, leer } = await preparar({
    santiso: false,
  });
  const { descargador } = descargadorDe(paginaJornada("EQUIPO LOCAL", "EQUIPO VISITANTE", "902"));

  const resumen = await sincronizarCompeticion(competicionId, descargador, AHORA);
  expect(resumen).toMatchObject({ actas: 0, resultados: 1, revisar: [], errores: [] });
  const db = await leer();
  const [partido] = await db.select().from(s.partidos).where(eq(s.partidos.id, partidoId));
  expect(partido).toMatchObject({ golesLocal: 8, golesVisitante: 2, estado: "finalizado" });
  expect(await db.select().from(s.partidoParticipaciones)).toHaveLength(0);
  expect(await db.select().from(s.rfgfActas)).toMatchObject([{ codActa: "902", estado: "resultado" }]);
});

it("sin acta cerrada o antes de la hora del partido no descarga nada", async () => {
  const { competicionId, sincronizarCompeticion } = await preparar();
  const sinActa = descargadorDe(paginaJornada("EQUIPO LOCAL", "EQUIPO VISITANTE", null));
  expect(await sincronizarCompeticion(competicionId, sinActa.descargador, AHORA)).toMatchObject({
    actas: 0,
    resultados: 0,
  });
  expect(sinActa.pedidas.pdf).toEqual([]);

  const antes = descargadorDe(paginaJornada("EQUIPO LOCAL", "EQUIPO VISITANTE", "903"));
  await sincronizarCompeticion(competicionId, antes.descargador, new Date(2025, 8, 14, 9));
  expect(antes.pedidas.html).toEqual([]);
});

it("un fallo de la federación queda anotado y se reintenta en la siguiente pasada", async () => {
  const { s, competicionId, sincronizarCompeticion, leer } = await preparar();
  const { descargador, pedidas } = descargadorDe(
    paginaJornada("EQUIPO LOCAL", "EQUIPO VISITANTE", "904"),
  );
  let fallar = true;
  const conFallo: DescargadorRfgf = {
    html: descargador.html,
    async pdf(url) {
      if (fallar) throw new Error("La federación respondió 503.");
      return descargador.pdf(url);
    },
  };

  const primera = await sincronizarCompeticion(competicionId, conFallo, AHORA);
  // Fallan las dos descargas: el PDF de la jornada y el del acta.
  expect(primera?.errores).toEqual([
    "Jornada 1 (PDF): La federación respondió 503.",
    "EQUIPO LOCAL – EQUIPO VISITANTE: La federación respondió 503.",
  ]);
  const db = await leer();
  expect(await db.select().from(s.rfgfActas)).toMatchObject([{ codActa: "904", estado: "error" }]);

  fallar = false;
  const segunda = await sincronizarCompeticion(competicionId, conFallo, AHORA);
  expect(segunda).toMatchObject({ actas: 1, errores: [] });
  expect(pedidas.pdf).toHaveLength(1);
  expect(await db.select().from(s.rfgfActas)).toMatchObject([{ codActa: "904", estado: "guardada" }]);
});

it("del PDF de jornada salen los marcadores; el acta se pide una vez para goles y tarjetas", async () => {
  const { s, competicionId, partidoId, sincronizarCompeticion, leer } = await preparar({
    santiso: false,
  });
  const pdf = [
    "EQUIPO LOCAL",
    "4 - 1",
    "14-09-2025",
    "12:00",
    "EQUIPO VISITANTE",
    "Campo: O Campo - Hierba Natural Árbitro: APELLIDO, NOMBRE",
  ];
  const pagina = paginaJornada("EQUIPO LOCAL", "EQUIPO VISITANTE", "901");
  const { descargador, pedidas } = descargadorDe(pagina, pdf);
  const resumen = await sincronizarCompeticion(competicionId, descargador, AHORA);
  expect(resumen).toMatchObject({ resultados: 1, actas: 0, errores: [], horarios: [] });
  const db = await leer();
  const [partido] = await db.select().from(s.partidos).where(eq(s.partidos.id, partidoId));
  // El marcador es el del PDF de jornada: el acta ya no lo pisa.
  expect(partido).toMatchObject({ golesLocal: 4, golesVisitante: 1, estado: "finalizado" });
  expect(pedidas.jornadas).toEqual([1]);
  expect(pedidas.pdf).toHaveLength(1);

  // Sus goles y tarjetas quedan en las tablas de la liga, cada uno con su equipo.
  const eventos = await db.select().from(s.ligaEventos);
  expect(eventos.length).toBeGreaterThan(0);
  expect(new Set(eventos.map((e) => e.partidoId))).toEqual(new Set([partidoId]));
  const equipos = new Set((await db.select().from(s.equipos)).map((e) => e.id));
  expect(eventos.every((e) => equipos.has(e.equipoId) && e.personaClave)).toBe(true);
  // Y quién jugó, de los dos equipos: para saber dónde se ha visto a cada jugador.
  const alineados = await db.select().from(s.ligaAlineaciones);
  expect(new Set(alineados.map((a) => a.equipoId)).size).toBe(2);
  expect(alineados.some((a) => a.titular) && alineados.some((a) => !a.titular)).toBe(true);
  expect(await db.select().from(s.rfgfActas)).toMatchObject([
    { codActa: "901", estado: "resultado", eventos: true },
  ]);

  // Ya está todo: la siguiente pasada no vuelve a pedir el acta ni duplica nada.
  const otra = descargadorDe(pagina, pdf);
  await sincronizarCompeticion(
    competicionId,
    otra.descargador,
    new Date(AHORA.getTime() + 4 * 3_600_000),
  );
  expect(otra.pedidas.pdf).toEqual([]);
  expect(await db.select().from(s.ligaEventos)).toHaveLength(eventos.length);
});

/** Un partido por jugar el 21/09 a las 17:00, además del ya jugado de `preparar`. */
async function conPartidoPorJugar() {
  const base = await preparar({ santiso: false });
  const db = await base.leer();
  const s = base.s;
  const [jornada] = await db
    .insert(s.jornadas)
    .values({ competicionId: base.competicionId, numero: 2 })
    .returning();
  const equipos = await db.select().from(s.equipos);
  const [porJugar] = await db
    .insert(s.partidos)
    .values({
      jornadaId: jornada!.id,
      equipoLocalId: equipos[1]!.id,
      equipoVisitanteId: equipos[0]!.id,
      fecha: "2025-09-21T17:00",
    })
    .returning();
  // El ya jugado, con marcador: así solo queda por mirar la jornada 2.
  await db
    .update(s.partidos)
    .set({ golesLocal: 1, golesVisitante: 0, estado: "finalizado", arbitro: "Persona Árbitra" })
    .where(eq(s.partidos.id, base.partidoId));
  const leerPartido = async () =>
    (await db.select().from(s.partidos).where(eq(s.partidos.id, porJugar!.id)))[0]!;
  return { ...base, db, porJugarId: porJugar!.id, leerPartido };
}

const cruce = (fecha: string, hora: string | null, campo: string) => [
  hora ? `EQUIPO VISITANTE ${fecha}` : `EQUIPO VISITANTE ${fecha} EQUIPO LOCAL`,
  ...(hora ? [hora, "EQUIPO LOCAL"] : []),
  `Campo: ${campo}`,
];

it("pone al día día, hora y campo de un partido por jugar y lo cuenta en el resumen", async () => {
  const { s, db, competicionId, sincronizarCompeticion, leerPartido } = await conPartidoPorJugar();
  const { descargador, pedidas } = descargadorDe(
    "",
    cruce("20-09-2025", "16:30", "Municipal de Proba - Hierba Artificial"),
  );
  const resumen = await sincronizarCompeticion(competicionId, descargador, AHORA);
  expect(pedidas.jornadas).toEqual([2]);
  expect(resumen?.errores).toEqual([]);
  expect(resumen?.horarios).toEqual([
    "J2 Equipo Visitante – Equipo Local: 20/09 16:30 · Municipal de Proba",
  ]);
  const partido = await leerPartido();
  expect(partido.fecha).toBe("2025-09-20T16:30");
  // El campo no estaba en el catálogo: se da de alta y se asigna.
  const campos = await db.select().from(s.campos);
  expect(campos).toHaveLength(1);
  expect(partido.campoId).toBe(campos[0]!.id);
  const [fila] = await db.select().from(s.rfgfCompeticiones);
  expect(fila?.resumen).toContain("20/09 16:30");
  expect(fila?.horariosEn).toBe(AHORA.toISOString());
});

it("la federación manda siempre: lo cambiado a mano vuelve a lo que ella publica", async () => {
  const { s, db, competicionId, sincronizarCompeticion, porJugarId, leerPartido } =
    await conPartidoPorJugar();
  const federacion = cruce("21-09-2025", "17:00", "Municipal de Proba - Hierba Artificial");
  await sincronizarCompeticion(competicionId, descargadorDe("", federacion).descargador, AHORA);
  // Ponerle campo a un partido que no lo tenía es rellenar: no es un cambio del que avisar.
  expect(await db.select().from(s.rfgfPartidos)).toMatchObject([{ cambio: "", cambioEn: null }]);
  // A mano, a las 19:00.
  await db.update(s.partidos).set({ fecha: "2025-09-21T19:00" }).where(eq(s.partidos.id, porJugarId));

  const masTarde = new Date(AHORA.getTime() + 4 * 3_600_000);
  const otraVez = await sincronizarCompeticion(
    competicionId,
    descargadorDe("", federacion).descargador,
    masTarde,
  );
  expect(otraVez?.horarios).toEqual(["J2 Equipo Visitante – Equipo Local: 21/09 17:00"]);
  expect((await leerPartido()).fecha).toBe("2025-09-21T17:00");
  // Esta vez sí pisó una hora que ya había: queda apuntado para avisar en Jornada.
  const [visto] = await db.select().from(s.rfgfPartidos);
  expect(visto).toMatchObject({ cambio: "21/09 17:00" });
  expect(visto?.cambioEn).toMatch(/^\d{4}-/);

  // Y si no hay nada distinto, no se anuncia ningún cambio.
  const sinNovedad = await sincronizarCompeticion(
    competicionId,
    descargadorDe("", federacion).descargador,
    new Date(masTarde.getTime() + 4 * 3_600_000),
  );
  expect(sinNovedad?.horarios).toEqual([]);
});

it("sin hora publicada ni campo asignado no borra los que ya había", async () => {
  const { competicionId, sincronizarCompeticion, leerPartido } = await conPartidoPorJugar();
  const resumen = await sincronizarCompeticion(
    competicionId,
    descargadorDe("", cruce("21-09-2025", null, "Campo Pendiente de asignar")).descargador,
    AHORA,
  );
  expect(resumen).toMatchObject({ horarios: [], errores: [] });
  expect(await leerPartido()).toMatchObject({ fecha: "2025-09-21T17:00", campoId: null });
});

it("los horarios no se vuelven a pedir hasta pasadas unas horas", async () => {
  const { competicionId, sincronizarCompeticion } = await conPartidoPorJugar();
  const primera = descargadorDe("", cruce("21-09-2025", "17:00", "Campo Pendiente de asignar"));
  await sincronizarCompeticion(competicionId, primera.descargador, AHORA);
  expect(primera.pedidas.jornadas).toEqual([2]);

  const enseguida = descargadorDe("");
  await sincronizarCompeticion(
    competicionId,
    enseguida.descargador,
    new Date(AHORA.getTime() + 30 * 60_000),
  );
  expect(enseguida.pedidas.jornadas).toEqual([]);

  const luego = descargadorDe("");
  await sincronizarCompeticion(
    competicionId,
    luego.descargador,
    new Date(AHORA.getTime() + 3 * 3_600_000),
  );
  expect(luego.pedidas.jornadas).toEqual([2]);
});

it("un PDF de jornada que no se sabe leer queda como error y no toca nada", async () => {
  const { competicionId, sincronizarCompeticion, leerPartido } = await conPartidoPorJugar();
  const roto: DescargadorRfgf = {
    html: async () => "",
    pdf: async () => new TextEncoder().encode("Esto no es una jornada"),
  };
  const resumen = await sincronizarCompeticion(competicionId, roto, AHORA);
  expect(resumen?.errores).toEqual([
    "Jornada 2 (PDF): El PDF no es de una jornada de la federación.",
  ]);
  expect((await leerPartido()).fecha).toBe("2025-09-21T17:00");
});

it("los cambios de los partidos del Santiso se cuentan los primeros", async () => {
  const { s, db, competicionId, sincronizarCompeticion } = await conPartidoPorJugar();
  // Otro partido de la misma jornada, entre dos equipos ajenos, que va antes en el PDF.
  const [a, b] = await db
    .insert(s.equipos)
    .values([
      { nombre: "Ajeno Uno", clave: "ajeno uno", categoria: "Senior" },
      { nombre: "Ajeno Dous", clave: "ajeno dous", categoria: "Senior" },
    ])
    .returning();
  const [jornada] = await db.select().from(s.jornadas).where(eq(s.jornadas.numero, 2));
  await db
    .insert(s.partidos)
    .values({ jornadaId: jornada!.id, equipoLocalId: a!.id, equipoVisitanteId: b!.id });
  await db.update(s.equipos).set({ esPropio: true }).where(eq(s.equipos.nombre, "Equipo Local"));
  const resumen = await sincronizarCompeticion(
    competicionId,
    descargadorDe("", [
      "AJENO UNO 21-09-2025 AJENO DOUS",
      "Campo: Campo Pendiente de asignar",
      ...cruce("20-09-2025", "16:30", "Campo Pendiente de asignar"),
    ]).descargador,
    AHORA,
  );
  expect(resumen?.horarios).toEqual([
    "J2 Equipo Visitante – Equipo Local: 20/09 16:30",
    "J2 Ajeno Uno – Ajeno Dous: 21/09",
  ]);
});

it("si la federación corrige el árbitro, se cambia el guardado", async () => {
  const { s, db, competicionId, partidoId, sincronizarCompeticion } = await conPartidoPorJugar();
  await db
    .update(s.partidos)
    .set({ arbitro: "Arbitro Equivocado", golesLocal: null, golesVisitante: null, estado: "programado" })
    .where(eq(s.partidos.id, partidoId));
  const { descargador } = descargadorDe("", [
    "EQUIPO LOCAL",
    "1 - 0",
    "14-09-2025",
    "12:00",
    "EQUIPO VISITANTE",
    "Campo: O Campo - Hierba Natural Árbitro: APELIDO APELIDO,",
    "NOME",
  ]);
  const resumen = await sincronizarCompeticion(competicionId, descargador, AHORA);
  expect(resumen?.errores).toEqual([]);
  const [partido] = await db.select().from(s.partidos).where(eq(s.partidos.id, partidoId));
  expect(partido).toMatchObject({ arbitro: "Nome Apelido Apelido", golesLocal: 1 });
});

it("guarda el árbitro de un partido ya jugado, aunque ya tuviera marcador", async () => {
  const { s, db, competicionId, partidoId, sincronizarCompeticion } = await conPartidoPorJugar();
  await db.update(s.partidos).set({ arbitro: null }).where(eq(s.partidos.id, partidoId));
  const { descargador, pedidas } = descargadorDe("", [
    "EQUIPO LOCAL",
    "1 - 0",
    "14-09-2025",
    "12:00",
    "EQUIPO VISITANTE",
    "Campo: O Campo - Hierba Natural Árbitro: APELIDO APELIDO, NOME",
  ]);
  const resumen = await sincronizarCompeticion(competicionId, descargador, AHORA);
  expect(resumen?.errores).toEqual([]);
  expect(pedidas.jornadas.sort()).toEqual([1, 2]);
  const [partido] = await db.select().from(s.partidos).where(eq(s.partidos.id, partidoId));
  expect(partido).toMatchObject({ arbitro: "Nome Apelido Apelido", golesLocal: 1 });
  // Ya lo tiene: la jornada 1 no se vuelve a pedir.
  const despues = descargadorDe("");
  await sincronizarCompeticion(
    competicionId,
    despues.descargador,
    new Date(AHORA.getTime() + 4 * 3_600_000),
  );
  expect(despues.pedidas.jornadas).toEqual([2]);
});

it("compara la clasificación con la oficial y deja dicho en qué no cuadra", async () => {
  const { s, db, competicionId, sincronizarCompeticion } = await conPartidoPorJugar();
  const oficial = (equipo: string, puntos: number, golesFavor: number, golesContra: number) => ({
    posicion: 1,
    equipo,
    puntos,
    jugados: 1,
    ganados: 0,
    empatados: 0,
    perdidos: 0,
    golesFavor,
    golesContra,
    sancion: 0,
  });
  // La clasificación del Studio sale de los equipos inscritos en la competición.
  const equipos = await db.select().from(s.equipos);
  await db
    .insert(s.competicionEquipos)
    .values(equipos.map((e) => ({ competicionId, equipoId: e.id })));
  // En la base, Equipo Local ganó 1–0. La oficial coincide en uno y discrepa en el otro.
  globalThis.clasificacionDeMentira = [
    oficial("EQUIPO LOCAL", 3, 1, 0),
    oficial("EQUIPO VISITANTE", 1, 0, 1),
  ];
  const { descargador, pedidas } = descargadorDe("");
  const resumen = await sincronizarCompeticion(competicionId, descargador, AHORA);
  expect(resumen?.errores).toEqual([]);
  expect(pedidas.clasificaciones).toBe(1);
  const [fila] = await db.select().from(s.rfgfCompeticiones);
  expect(fila?.clasificacion).toMatchObject({
    jornada: 1,
    diferencias: ["Equipo Visitante: 1 puntos en la oficial y 0 aquí."],
    sanciones: [],
  });
  expect(fila?.resumen).toContain("la clasificación no cuadra con la oficial en 1 equipo");

  // Cuando cuadra, se guarda sin diferencias.
  globalThis.clasificacionDeMentira = [
    oficial("EQUIPO LOCAL", 3, 1, 0),
    oficial("EQUIPO VISITANTE", 0, 0, 1),
  ];
  await sincronizarCompeticion(
    competicionId,
    descargadorDe("").descargador,
    new Date(AHORA.getTime() + 4 * 3_600_000),
  );
  const [despues] = await db.select().from(s.rfgfCompeticiones);
  expect(despues?.clasificacion?.diferencias).toEqual([]);
});


it("apunta a los jugadores del club con su código y trae sus cifras oficiales", async () => {
  const { s, competicionId, sincronizarCompeticion, leer } = await preparar();
  const { descargador, pedidas } = descargadorDe(
    paginaJornada("EQUIPO LOCAL", "EQUIPO VISITANTE", "900"),
  );

  // Pedida a mano: guarda el acta y, con ella, mira quién jugó y lee sus páginas.
  const resumen = await sincronizarCompeticion(competicionId, descargador, AHORA, false, true);
  expect(resumen?.errores).toEqual([]);
  const db = await leer();
  const jugadores = await db.select().from(s.rfgfJugadores);
  // Solo los del lado del club; el rival no se apunta.
  expect(jugadores.map((j) => j.codigo).sort()).toEqual(["21", "22"]);
  const reconocido = jugadores.find((j) => j.codigo === "21")!;
  expect(reconocido.jugadorId).not.toBeNull();
  expect(reconocido.cifras).toMatchObject({ convocados: 3, titular: 2, goles: 4, amarillas: 1 });
  // Un nombre que no está en la plantilla se guarda sin enlazar: no se inventa a quién es.
  expect(jugadores.find((j) => j.codigo === "22")!.jugadorId).toBeNull();
  expect(pedidas.jugadores.filter((url) => url.includes("NFG_CmpPartido"))).toHaveLength(1);

  // Otra pasada con el mismo último partido no vuelve a pedir su página.
  await sincronizarCompeticion(competicionId, descargador, AHORA, false, true);
  expect(pedidas.jugadores.filter((url) => url.includes("NFG_CmpPartido"))).toHaveLength(1);
});

it("repasa una temporada pasada poco a poco y apunta el año en el historial del jugador", async () => {
  const { s, competicionId, sincronizarCompeticion, leer } = await preparar();
  const jornada = paginaJornada("EQUIPO LOCAL", "EQUIPO VISITANTE", "900");
  const { descargador } = descargadorDe(jornada);
  // Primero la pasada normal: deja identificado al jugador 21 del club.
  await sincronizarCompeticion(competicionId, descargador, AHORA, false, true);

  const competiciones = `<h4>&nbsp;2025-2026</h4><table><tr><td><a href='NFG_VisCompeticiones_Vis?&codcompeticion=30'>LIGA</a></td>
    <td><a href='NFG_VisGrupos_Vis?cod_primaria=1&codgrupo=300'>GRUPO ACTUAL</a></td></tr></table>
    <h4>&nbsp;2024-2025</h4><table><tr><td><a href='NFG_VisCompeticiones_Vis?&codcompeticion=20'>LIGA VIEJA</a></td>
    <td><a href='NFG_VisGrupos_Vis?cod_primaria=1&codgrupo=200'>GRUPO VIEJO</a></td></tr></table>
    <h4>&nbsp;2015-2016</h4><table><tr><td><a href='NFG_VisCompeticiones_Vis?&codcompeticion=10'>MUY VIEJA</a></td>
    <td><a href='NFG_VisGrupos_Vis?cod_primaria=1&codgrupo=100'>GRUPO ANTIGUO</a></td></tr></table>`;
  const pedidas: string[] = [];
  const historico: DescargadorRfgf = {
    async html(url) {
      pedidas.push(url);
      if (url.includes("NFG_VisCompeticiones_Equipo")) return competiciones;
      if (url.includes("NFG_EstadisticasJugador")) return PAGINA_JUGADOR;
      return jornada;
    },
    async pdf() {
      throw new Error("El repaso histórico no pide PDF.");
    },
  };
  const { avanzarHistorico } = await import("./historico");
  // Dos páginas por paso: descubrir (2), preparar el grupo (1) y leer a cada jugador (1 c/u).
  expect(await avanzarHistorico(historico, AHORA, 2)).toBe(2);
  const db = await leer();
  const grupos = await db.select().from(s.rfgfGruposHistoricos);
  // Todas las temporadas pasadas, también la de hace diez años; la actual no.
  expect(grupos.map((g) => [g.codGrupo, g.temporada, g.estado, g.codEquipo])).toEqual([
    ["200", "2024-2025", "pendiente", "2"],
    ["100", "2015-2016", "pendiente", "2"],
  ]);
  expect(await db.select().from(s.rfgfEquiposClub)).toMatchObject([
    { categoria: "Senior", codEquipo: "2" },
  ]);

  while ((await avanzarHistorico(historico, AHORA, 2)) > 0);
  const listos = await db.select().from(s.rfgfGruposHistoricos);
  expect(listos.map((g) => [g.estado, g.codActa])).toEqual([
    ["listo", "900"],
    ["listo", "900"],
  ]);
  const filas = await db.select().from(s.rfgfHistorico);
  expect(filas).toHaveLength(2);
  expect(filas[0]!.cifras).toMatchObject({ convocados: 3, goles: 4 });
  const [persona] = await db
    .select()
    .from(s.jugadores)
    .where((await import("drizzle-orm")).eq(s.jugadores.id, filas[0]!.jugadorId));
  expect(persona!.historial).toEqual(["24/25: Equipo Visitante", "15/16: Equipo Visitante"]);

  // Terminado: no vuelve a pedir nada.
  const antes = pedidas.length;
  expect(await avanzarHistorico(historico, AHORA, 2)).toBe(0);
  expect(pedidas).toHaveLength(antes);
});

it("un partido recién importado toma día y campo junto con su marcador, y así se busca su acta", async () => {
  const { s, db, competicionId, porJugarId, sincronizarCompeticion, leerPartido } =
    await conPartidoPorJugar();
  await db.update(s.partidos).set({ fecha: null }).where(eq(s.partidos.id, porJugarId));
  const { descargador } = descargadorDe("", [
    "EQUIPO VISITANTE",
    "2 - 1",
    "20-09-2025",
    "17:00",
    "EQUIPO LOCAL",
    "Campo: Campo Nuevo - Hierba Artificial",
  ]);
  await sincronizarCompeticion(competicionId, descargador, new Date(2025, 8, 22, 10), false, true);
  const partido = await leerPartido();
  expect(partido).toMatchObject({ golesLocal: 2, golesVisitante: 1, fecha: "2025-09-20T17:00" });
  expect(partido.campoId).not.toBeNull();
});

it("en una copa añade los cruces que se van sorteando, con su equipo nuevo", async () => {
  const { s, db, competicionId, sincronizarCompeticion } = await conPartidoPorJugar();
  await db
    .update(s.competiciones)
    .set({ formato: "eliminatoria" })
    .where(eq(s.competiciones.id, competicionId));
  const celda = (lado: string, nombre: string) =>
    `<td width="47%" align=${lado}> ${nombre} </td>`;
  const calendario = `<h4>COPA<br><br>Temporada 2025-2026</h4><table><tr><th colspan=4>Final , 30-05-2026</th></tr>
    <tr>${celda("right", "EQUIPO LOCAL")}<td width="6%"></td>${celda("left", "EQUIPO SORTEADO")}</tr></table>`;
  const { descargador } = descargadorDe(calendario);
  const primera = await sincronizarCompeticion(competicionId, descargador, AHORA, false, true);
  expect(primera?.crucesNuevos).toBe(1);
  const nuevo = (await db.select().from(s.equipos)).find((e) => e.nombre === "Equipo Sorteado");
  expect(nuevo).toBeDefined();
  const segunda = await sincronizarCompeticion(competicionId, descargador, AHORA, false, true);
  expect(segunda?.crucesNuevos).toBe(0);
});
