import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { abrirDb, type ConexionDb } from "./client";
import { aplicarLimpieza, ensayarLimpieza } from "./limpieza";
import { migrarBd } from "./migraciones";
import { urlArchivo } from "./rutas";
import * as s from "./schema";

let dir: string;
let conexion: ConexionDb;

/** Todas las filas de todas las tablas, para comparar antes y después. */
async function foto() {
  const tablas = (
    await conexion.cliente.execute(
      "select name from sqlite_master where type = 'table' and name not like 'sqlite%' and name not like '%drizzle%' order by name",
    )
  ).rows.map((r) => String(r.name));
  const salida: Record<string, unknown[]> = {};
  for (const t of tablas) {
    salida[t] = (await conexion.cliente.execute(`select * from "${t}" order by 1`)).rows.map(
      (r) => ({ ...r }),
    );
  }
  return salida;
}

beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "santiso-limpieza-"));
  conexion = await abrirDb(urlArchivo(path.join(dir, "santiso.db")));
  const { db } = conexion;
  await migrarBd(db);
  await db.insert(s.temporadas).values([
    { id: "vieja", nombre: "2025/26" },
    { id: "nueva", nombre: "2026/27", activa: true },
  ]);
  await db.insert(s.equipos).values([
    {
      id: "santiso",
      nombre: "U.D. Santiso",
      clave: "santiso",
      categoria: "Veteranos",
      esPropio: true,
    },
    { id: "fem", nombre: "Santiso Femenino", clave: "fem", categoria: "Femenino", esPropio: true },
    // Solo del año pasado: se va, con su escudo.
    {
      id: "viejo",
      nombre: "Solo Pasado",
      clave: "viejo",
      categoria: "Veteranos",
      escudo: "escudos/viejo.webp",
    },
    // El mismo club, registrado dos veces: el viejo quedó inscrito en la liga nueva sin jugar.
    {
      id: "faro-viejo",
      nombre: "Faro",
      clave: "faro",
      categoria: "Veteranos",
      escudo: "escudos/faro.webp",
    },
    { id: "faro-nuevo", nombre: "FARO VETERANS", clave: "faro veterans", categoria: "Veteranos" },
    // Juega las dos temporadas: se queda.
    {
      id: "siempre",
      nombre: "De Siempre",
      clave: "siempre",
      categoria: "Veteranos",
      escudo: "escudos/siempre.webp",
    },
    // Creado este año y aún sin inscribir: no es del año pasado, se queda.
    { id: "recien", nombre: "Recién Creado", clave: "recien", categoria: "Veteranos" },
  ]);
  await db.insert(s.campos).values([
    { id: "campo-viejo", nombre: "Campo Viejo", clave: "campo viejo" },
    { id: "campo-comun", nombre: "Campo Común", clave: "campo comun" },
    // Casa de «De Siempre», que sigue y este año aún no tiene campo asignado: se conserva.
    { id: "campo-casa", nombre: "Campo de Casa", clave: "campo casa" },
    // Casa vieja del Santiso, que este año ya juega en «Campo Común»: sería un duplicado.
    { id: "campo-santiso-viejo", nombre: "Santiso Viejo", clave: "santiso viejo" },
  ]);
  await db.insert(s.competiciones).values([
    { id: "liga-vieja", temporadaId: "vieja", categoria: "Veteranos", nombre: "Liga vieja" },
    { id: "liga-nueva", temporadaId: "nueva", categoria: "Veteranos", nombre: "Liga nueva" },
  ]);
  await db.insert(s.competicionEquipos).values([
    { competicionId: "liga-vieja", equipoId: "santiso" },
    { competicionId: "liga-vieja", equipoId: "viejo" },
    { competicionId: "liga-vieja", equipoId: "faro-viejo" },
    { competicionId: "liga-vieja", equipoId: "siempre" },
    { competicionId: "liga-nueva", equipoId: "santiso" },
    { competicionId: "liga-nueva", equipoId: "faro-viejo" },
    { competicionId: "liga-nueva", equipoId: "faro-nuevo" },
    { competicionId: "liga-nueva", equipoId: "siempre" },
  ]);
  await db.insert(s.jornadas).values([
    { id: "jv", competicionId: "liga-vieja", numero: 1 },
    { id: "jn", competicionId: "liga-nueva", numero: 1 },
  ]);
  await db.insert(s.jornadaDescansos).values({ jornadaId: "jv", equipoId: "faro-viejo" });
  await db.insert(s.partidos).values([
    {
      id: "pv1",
      jornadaId: "jv",
      equipoLocalId: "viejo",
      equipoVisitanteId: "santiso",
      campoId: "campo-viejo",
      fecha: "2025-10-01T18:00",
      golesLocal: 0,
      golesVisitante: 2,
      estado: "finalizado",
    },
    {
      id: "pv2",
      jornadaId: "jv",
      equipoLocalId: "siempre",
      equipoVisitanteId: "faro-viejo",
      campoId: "campo-casa",
    },
    {
      id: "pv3",
      jornadaId: "jv",
      equipoLocalId: "santiso",
      equipoVisitanteId: "siempre",
      campoId: "campo-santiso-viejo",
    },
    {
      id: "pn1",
      jornadaId: "jn",
      equipoLocalId: "santiso",
      equipoVisitanteId: "faro-nuevo",
      campoId: "campo-comun",
      fecha: "2026-09-26T19:00",
    },
    { id: "pn2", jornadaId: "jn", equipoLocalId: "siempre", equipoVisitanteId: "santiso" },
  ]);
  await db.insert(s.jugadores).values([
    { id: "sigue", nombre: "Sigue Este Año" },
    { id: "se-fue", nombre: "Se Fue" },
  ]);
  await db.insert(s.jugadoresTemporada).values([
    {
      temporadaId: "vieja",
      jugadorId: "sigue",
      categoria: "Veteranos",
      foto: "jugadores/sigue-2025.webp",
    },
    {
      temporadaId: "vieja",
      jugadorId: "se-fue",
      categoria: "Veteranos",
      foto: "jugadores/se-fue.webp",
    },
    {
      temporadaId: "nueva",
      jugadorId: "sigue",
      categoria: "Veteranos",
      foto: "jugadores/sigue-2026.webp",
    },
  ]);
  await db.insert(s.partidoParticipaciones).values([
    { partidoId: "pv1", jugadorId: "sigue", titular: true, jugo: true },
    { partidoId: "pv1", jugadorId: "se-fue", titular: true, jugo: true },
  ]);
  await db.insert(s.partidoEventos).values({
    id: "gol",
    partidoId: "pv1",
    tipo: "gol",
    lado: "propio",
    jugadorId: "se-fue",
    minuto: 10,
  });
  await db.insert(s.staff).values([{ id: "mister", nombre: "Míster Viejo" }]);
  await db.insert(s.staffTemporada).values({
    temporadaId: "vieja",
    staffId: "mister",
    tipo: "tecnico",
    categoria: "Veteranos",
    cargo: "Entrenador",
  });

  for (const ruta of [
    "escudos/viejo.webp",
    "escudos/faro.webp",
    "escudos/siempre.webp",
    "jugadores/sigue-2025.webp",
    "jugadores/se-fue.webp",
    "jugadores/sigue-2026.webp",
    "cartel/fondo.webp",
  ]) {
    mkdirSync(path.dirname(path.join(dir, "media", ruta)), { recursive: true });
    writeFileSync(path.join(dir, "media", ruta), "x");
  }
});

afterEach(() => {
  conexion.cerrar();
});

describe("limpieza de temporada", () => {
  it("el ensayo informa y no cambia nada", async () => {
    const antes = await foto();
    const informe = await ensayarLimpieza(conexion.cliente, "2025/26");
    expect(await foto()).toEqual(antes);
    expect(informe.borrados).toMatchObject({
      partidos: 3,
      competiciones: 1,
      temporada: 1,
      eventos: 1,
    });
  });

  it("borra la temporada y lo que solo era suyo; la activa queda igual", async () => {
    const informe = await aplicarLimpieza(
      conexion.cliente,
      "2025/26",
      path.join(dir, "media"),
      path.join(dir, "archivo"),
    );
    expect(informe.fantasmas).toEqual([
      { equipo: "Faro", competicion: "Liga nueva", temporada: "2026/27" },
    ]);
    expect(informe.huerfanos).toEqual({
      equipos: ["Faro", "Solo Pasado"],
      campos: ["Campo Viejo", "Santiso Viejo"],
      jugadores: ["Se Fue"],
      staff: ["Míster Viejo"],
    });
    expect(informe.media).toEqual([
      "escudos/faro.webp",
      "escudos/viejo.webp",
      "jugadores/se-fue.webp",
      "jugadores/sigue-2025.webp",
    ]);

    const q = async (sql: string) => (await conexion.cliente.execute(sql)).rows.map((r) => r[0]);
    expect(await q("select nombre from temporadas")).toEqual(["2026/27"]);
    expect(await q("select id from partidos order by id")).toEqual(["pn1", "pn2"]);
    expect(await q("select equipo_id from competicion_equipos order by equipo_id")).toEqual([
      "faro-nuevo",
      "santiso",
      "siempre",
    ]);
    // Los del club no se borran aunque no jueguen (Femenino), y lo recién creado tampoco.
    expect(await q("select id from equipos order by id")).toEqual([
      "faro-nuevo",
      "fem",
      "recien",
      "santiso",
      "siempre",
    ]);
    expect(await q("select id from jugadores")).toEqual(["sigue"]);
    expect(await q("select foto from jugadores_temporada")).toEqual(["jugadores/sigue-2026.webp"]);
    expect(await q("select id from campos order by id")).toEqual(["campo-casa", "campo-comun"]);
    expect(await q("select count(*) from staff")).toEqual([0]);
    expect(await q("select fecha from partidos where id = 'pn1'")).toEqual(["2026-09-26T19:00"]);

    // La media que sobra se mueve, no se borra; la que se usa y la del cartel se quedan.
    expect(existsSync(path.join(dir, "archivo", "escudos/viejo.webp"))).toBe(true);
    expect(existsSync(path.join(dir, "media", "escudos/viejo.webp"))).toBe(false);
    expect(existsSync(path.join(dir, "media", "escudos/siempre.webp"))).toBe(true);
    expect(existsSync(path.join(dir, "media", "jugadores/sigue-2026.webp"))).toBe(true);
    expect(existsSync(path.join(dir, "media", "cartel/fondo.webp"))).toBe(true);
  });

  it("no retira la temporada activa ni una que no existe", async () => {
    const antes = await foto();
    await expect(ensayarLimpieza(conexion.cliente, "2026/27")).rejects.toThrow(/activa/);
    await expect(
      aplicarLimpieza(conexion.cliente, "2030/31", path.join(dir, "media"), path.join(dir, "a")),
    ).rejects.toThrow(/No existe/);
    expect(await foto()).toEqual(antes);
  });
});
