import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";

const ENLACE =
  "https://www.futgal.es/pnfg/NPcd/NFG_VisCalendario_Vis?cod_primaria=1000120&codtemporada=22&codcompeticion=26990830&codgrupo=27576591";

const anterior = process.env.SANTISO_DATA_DIR;
afterEach(async () => {
  const conexion = await globalThis.santisoConexionDb;
  conexion?.cerrar();
  globalThis.santisoConexionDb = undefined;
  if (anterior === undefined) delete process.env.SANTISO_DATA_DIR;
  else process.env.SANTISO_DATA_DIR = anterior;
});

async function preparar() {
  process.env.SANTISO_DATA_DIR = mkdtempSync(path.join(tmpdir(), "santiso-rfgf-acciones-"));
  vi.resetModules();
  globalThis.santisoConexionDb = undefined;
  const bd = await import("@santiso/db");
  const { db, cerrar } = await bd.abrirDb(
    bd.urlArchivo(path.join(process.env.SANTISO_DATA_DIR, "santiso.db")),
  );
  await bd.migrarBd(db);
  const s = bd.schema;
  const [activa, pasada] = await db
    .insert(s.temporadas)
    .values([{ nombre: "2026/27", activa: true }, { nombre: "2025/26" }])
    .returning();
  const [liga] = await db
    .insert(s.competiciones)
    .values([
      { temporadaId: activa!.id, nombre: "Tercera", categoria: "Senior" },
      { temporadaId: pasada!.id, nombre: "Tercera vieja", categoria: "Senior" },
    ])
    .returning();
  const [local, visitante] = await db
    .insert(s.equipos)
    .values([
      { nombre: "C.D. Berres", clave: "c d berres", categoria: "Senior" },
      { nombre: "U.D. Santiso F.C.", clave: "u d santiso f c", categoria: "Senior", esPropio: true },
    ])
    .returning();
  const [jornada] = await db
    .insert(s.jornadas)
    .values({ competicionId: liga!.id, numero: 2 })
    .returning();
  const [partido] = await db
    .insert(s.partidos)
    .values({ jornadaId: jornada!.id, equipoLocalId: local!.id, equipoVisitanteId: visitante!.id })
    .returning();
  const [jugador] = await db.insert(s.jugadores).values({ nombre: "Iago" }).returning();
  cerrar();
  const acciones = await import("./rfgf");
  const leer = async () => (await (await import("@/lib/server/db")).obtenerDb()).db;
  return { s, acciones, leer, ligaId: liga!.id, partidoId: partido!.id, jugadorId: jugador!.id };
}

it("enlaza, valida y desenlaza una competición; solo lista la temporada activa", async () => {
  const { acciones, ligaId } = await preparar();

  const inicial = await acciones.cargarEstadoRfgf();
  expect(inicial).toMatchObject({
    ok: true,
    datos: [{ competicionId: ligaId, nombre: "Tercera", enlace: "", comprobadoEn: null }],
  });

  expect(await acciones.guardarEnlaceRfgf(ligaId, "https://ejemplo.com/calendario")).toMatchObject({
    ok: false,
  });
  expect(await acciones.guardarEnlaceRfgf(ligaId, `  ${ENLACE}  `)).toEqual({ ok: true, datos: null });
  expect(await acciones.cargarEstadoRfgf()).toMatchObject({
    ok: true,
    datos: [{ competicionId: ligaId, enlace: ENLACE }],
  });

  // Vacío = dejar de sincronizarla.
  expect(await acciones.guardarEnlaceRfgf(ligaId, " ")).toEqual({ ok: true, datos: null });
  expect(await acciones.cargarEstadoRfgf()).toMatchObject({ ok: true, datos: [{ enlace: "" }] });
});

it("un acta por revisar se enseña hasta que el partido tiene acta, y se puede reintentar", async () => {
  const { s, acciones, leer, ligaId, partidoId, jugadorId } = await preparar();
  const db = await leer();
  await db.insert(s.rfgfCompeticiones).values({ competicionId: ligaId, enlace: ENLACE });
  await db.insert(s.rfgfActas).values([
    {
      codActa: "1",
      competicionId: ligaId,
      partidoId,
      estado: "revisar",
      detalle: "no reconozco a FICHAJE NUEVO, PEPE",
    },
    { codActa: "2", competicionId: ligaId, partidoId: null, estado: "resultado", detalle: "1–0" },
  ]);

  expect(await acciones.cargarEstadoRfgf()).toMatchObject({
    ok: true,
    datos: [
      {
        revisar: [
          {
            codActa: "1",
            partido: "C.D. Berres – U.D. Santiso F.C.",
            motivo: "no reconozco a FICHAJE NUEVO, PEPE",
          },
        ],
      },
    ],
  });

  // Reintentar borra la anotación para que la siguiente pasada la vuelva a traer.
  expect(await acciones.reintentarActaRfgf("1")).toEqual({ ok: true, datos: null });
  expect((await db.select().from(s.rfgfActas)).map((a) => a.codActa)).toEqual(["2"]);
  // No toca lo que no está por revisar.
  await acciones.reintentarActaRfgf("2");
  expect(await db.select().from(s.rfgfActas)).toHaveLength(1);

  // Con el acta ya guardada a mano, deja de pedirse revisión.
  await db
    .insert(s.rfgfActas)
    .values({ codActa: "3", competicionId: ligaId, partidoId, estado: "revisar", detalle: "x" });
  await db.insert(s.partidoParticipaciones).values({ partidoId, jugadorId, titular: true, jugo: true });
  const final = await acciones.cargarEstadoRfgf();
  expect(final.ok && final.datos[0]?.revisar).toEqual([]);
});
