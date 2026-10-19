import { readFileSync } from "node:fs";
import path from "node:path";
import { schema as s, type ConexionDb } from "@santiso/db";
import { crearDbPrueba } from "@santiso/db/testing";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DescargadorRfgf } from "./descargador";

const muestra = new TextDecoder("iso-8859-15").decode(
  readFileSync(path.resolve(__dirname, "../../rfgf/__muestras__/clubes-santiso.xls")),
);
const AHORA = new Date("2026-10-18T10:00:00Z");

let conexion: ConexionDb;
let clubes: typeof import("./clubes");

beforeEach(async () => {
  conexion = await crearDbPrueba();
  globalThis.santisoConexionDb = Promise.resolve(conexion);
  clubes = await import("./clubes");
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
  globalThis.santisoClubesIntentoEn = undefined;
  vi.unstubAllGlobals();
});

function descargador(): DescargadorRfgf & { llamadas: string[] } {
  const llamadas: string[] = [];
  return {
    llamadas,
    html: vi.fn(async (url: string) => {
      llamadas.push(url);
      return muestra;
    }),
    pdf: vi.fn(async () => {
      throw new Error("No se piden PDF");
    }),
  };
}

async function equipo(nombre: string, categoria: "Senior" | "Veteranos", extra = {}) {
  const [fila] = await conexion.db
    .insert(s.equipos)
    .values({ nombre, clave: nombre.toLowerCase(), categoria, ...extra })
    .returning();
  return fila!;
}

const leer = async (id: string) =>
  (await conexion.db.select().from(s.equipos).where(eq(s.equipos.id, id)))[0]!;

describe("clubes de la federación", () => {
  it("baja el listado en una petición, enlaza lo inequívoco y pone colores", async () => {
    const senior = await equipo("U.D. Santiso F.C.", "Senior", { esPropio: true });
    const veteranos = await equipo("U.D. Santiso F.C. Solaina", "Veteranos", { esPropio: true });
    const pintado = await equipo("Santiso", "Veteranos", { color: "#123456" });
    const rival = await equipo("S.D. Touro", "Senior");
    const red = descargador();

    const resumen = await clubes.traerClubes(red, AHORA);

    expect(red.llamadas).toHaveLength(1);
    expect(red.llamadas[0]).not.toContain("nclub");
    expect(resumen).toMatchObject({ clubes: 2, enlazados: 3, colores: 1, dudosos: [] });
    expect(await leer(senior.id)).toMatchObject({
      clubCodigo: "1800",
      color: "#f4c300",
      color2: "#111111",
      colorFederacion: true,
    });
    // El club de los veteranos no publica equipación: sin colores.
    expect(await leer(veteranos.id)).toMatchObject({ clubCodigo: "5006", color: null });
    // Un color puesto a mano no se pisa.
    expect(await leer(pintado.id)).toMatchObject({ clubCodigo: "1800", color: "#123456" });
    expect(await leer(rival.id)).toMatchObject({ clubCodigo: null });
    const [club] = await conexion.db
      .select()
      .from(s.rfgfClubes)
      .where(eq(s.rfgfClubes.codigo, "1800"));
    expect(club).toMatchObject({ localidad: "Santiso", leidoEn: AHORA.toISOString() });
  });

  it("lo elegido a mano manda, también dejar un equipo sin club", async () => {
    const senior = await equipo("U.D. Santiso F.C.", "Senior");
    await clubes.traerClubes(descargador(), AHORA);
    await clubes.elegirClubDeEquipo(senior.id, null);
    expect(await leer(senior.id)).toMatchObject({ clubCodigo: null, clubManual: true });
    await clubes.traerClubes(descargador(), AHORA);
    expect((await leer(senior.id)).clubCodigo).toBeNull();
    await clubes.elegirClubDeEquipo(senior.id, "5006");
    expect((await leer(senior.id)).clubCodigo).toBe("5006");
    await expect(clubes.elegirClubDeEquipo(senior.id, "999")).rejects.toThrow();
  });

  it("ofrece candidatos cuando hay donde elegir", async () => {
    await clubes.traerClubes(descargador(), AHORA);
    const solo = await equipo("Solaina", "Veteranos");
    const dudas = await clubes.equiposPorEnlazar();
    expect(dudas).toEqual([
      {
        equipoId: solo.id,
        nombre: "Solaina",
        categoria: "Veteranos",
        candidatos: [{ codigo: "5006", nombre: "Santiso Solaina", localidad: null }],
      },
    ]);
  });

  it("el programador lo baja una vez por semana y no repite un fallo en el día", async () => {
    expect(clubes.tocaTraerClubes(null, AHORA)).toBe(true);
    expect(clubes.tocaTraerClubes("2026-10-12T10:00:00Z", AHORA)).toBe(false);
    expect(clubes.tocaTraerClubes("2026-10-11T10:00:00Z", AHORA)).toBe(true);
    const red = descargador();
    expect(await clubes.traerClubesSiToca(red, AHORA)).toMatchObject({ clubes: 2 });
    expect(await clubes.traerClubesSiToca(red, new Date("2026-10-20T10:00:00Z"))).toBeNull();
    expect(red.llamadas).toHaveLength(1);

    const rota = descargador();
    vi.mocked(rota.html).mockRejectedValue(new Error("caída"));
    const despues = new Date("2026-10-30T10:00:00Z");
    await expect(clubes.traerClubesSiToca(rota, despues)).rejects.toThrow("caída");
    expect(await clubes.traerClubesSiToca(rota, new Date("2026-10-30T12:00:00Z"))).toBeNull();
  });

  it("no pisa otra operación con la federación en marcha", async () => {
    globalThis.santisoRedRfgfEnMarcha = true;
    const red = descargador();
    const resumen = await clubes.traerClubes(red, AHORA);
    expect(resumen.avisos).toHaveLength(1);
    expect(red.llamadas).toHaveLength(0);
  });
});
