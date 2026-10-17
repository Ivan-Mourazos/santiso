import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copiarBd, ultimaCopia, ultimaCopiaValida, verificarCopia } from "./backup";
import { crearDbPrueba } from "./testing";
import * as s from "./schema";

const carpetas: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of carpetas.splice(0)) rmSync(dir, { recursive: true, force: true });
});

async function entorno() {
  const dir = mkdtempSync(path.join(tmpdir(), "santiso-completa-"));
  carpetas.push(dir);
  const conexion = await crearDbPrueba();
  const media = path.join(dir, "media");
  mkdirSync(path.join(media, "escudos"), { recursive: true });
  writeFileSync(path.join(media, "escudos/club.webp"), "imagen");
  await conexion.db.insert(s.ajustes).values({ id: "club.escudo", valor: "escudos/club.webp" });
  return { dir, media, conexion, destino: path.join(dir, "backups") };
}

describe("copia completa y restauración", () => {
  it("conserva media, cuenta ficheros y bytes y registra la migración realmente aplicada", async () => {
    const { conexion, destino, media } = await entorno();
    try {
      const fecha = new Date("2026-10-17T10:00:00Z");
      const copia = await copiarBd(conexion.cliente, destino, fecha, media);
      const manifiesto = JSON.parse(readFileSync(path.join(copia, "manifiesto.json"), "utf8"));
      expect(manifiesto).toMatchObject({
        formato: 1,
        fecha: fecha.toISOString(),
        media: { ficheros: 1, bytes: 6 },
        mediaFaltante: [],
      });
      const ultima = (
        await conexion.cliente.execute(
          "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1",
        )
      ).rows[0]!;
      expect(manifiesto.migracion).toEqual({
        hash: ultima.hash,
        aplicadaEn: Number(ultima.created_at),
      });
      expect(manifiesto.migracion.hash).toMatch(/^[0-9a-f]+$/);
      expect(readFileSync(path.join(copia, "media/escudos/club.webp"), "utf8")).toBe("imagen");
      expect((await verificarCopia(copia)).ok).toBe(true);
      expect(await ultimaCopiaValida(destino)).toEqual({
        ruta: copia,
        fecha: fecha.toISOString(),
        ok: true,
      });
      // Detecta regresiones de bloqueo de la instantánea en Windows.
      rmSync(copia, { recursive: true });
    } finally {
      conexion.cerrar();
    }
  });

  it("limpia una copia fallida y no sobrescribe otra ni borra un temporal ajeno", async () => {
    const { conexion, destino, dir, media } = await entorno();
    try {
      const fallo = path.join(dir, "no-es-directorio");
      writeFileSync(fallo, "fallo");
      await expect(copiarBd(conexion.cliente, destino, new Date(), fallo)).rejects.toThrow();
      expect(readdirSync(destino)).toEqual([]);
      const fecha = new Date("2026-10-17T10:00:00Z");
      const creada = await copiarBd(conexion.cliente, destino, fecha, media);
      await expect(copiarBd(conexion.cliente, destino, fecha, media)).rejects.toThrow();
      expect((await verificarCopia(creada)).ok).toBe(true);
      const temporal = path.join(destino, ".santiso-2026-10-18T10-00-00.tmp");
      mkdirSync(temporal);
      writeFileSync(path.join(temporal, "pendiente"), "no tocar");
      await expect(
        copiarBd(conexion.cliente, destino, new Date("2026-10-18T10:00:00Z"), media),
      ).rejects.toThrow();
      expect(existsSync(path.join(temporal, "pendiente"))).toBe(true);
    } finally {
      conexion.cerrar();
    }
  });

  it("detecta media borrada y claves inseguras sin modificar media original", async () => {
    const { conexion, destino, media } = await entorno();
    try {
      await conexion.db
        .insert(s.ajustes)
        .values({ id: "cartel.logo_xunta", valor: "../fuera.webp" });
      const copia = await copiarBd(conexion.cliente, destino, new Date(), media);
      const manifiesto = JSON.parse(readFileSync(path.join(copia, "manifiesto.json"), "utf8"));
      expect(manifiesto.mediaFaltante).toEqual(["../fuera.webp"]);
      rmSync(path.join(copia, "media/escudos/club.webp"));
      const resultado = await verificarCopia(copia);
      expect(resultado.ok).toBe(false);
      expect(resultado.mediaFaltante).toEqual(["../fuera.webp", "escudos/club.webp"]);
      expect(existsSync(path.join(media, "escudos/club.webp"))).toBe(true);
      expect(await ultimaCopiaValida(destino)).toBeNull();
    } finally {
      conexion.cerrar();
    }
  });

  it("rechaza BD corrupta y busca la última válida entre manuales y diarias", async () => {
    const { conexion, destino, media } = await entorno();
    try {
      const manual = await copiarBd(
        conexion.cliente,
        destino,
        new Date("2026-10-16T10:00:00Z"),
        media,
      );
      const diaria = await copiarBd(
        conexion.cliente,
        path.join(destino, "diarias"),
        new Date("2026-10-17T10:00:00Z"),
        media,
      );
      writeFileSync(path.join(diaria, "santiso.db"), "BD corrupta");
      expect((await verificarCopia(diaria)).ok).toBe(false);
      expect(ultimaCopia(destino)).toBe(diaria);
      expect((await ultimaCopiaValida(destino))?.ruta).toBe(manual);
      expect(readFileSync(path.join(diaria, "santiso.db"), "utf8")).toBe("BD corrupta");
    } finally {
      conexion.cerrar();
    }
  });

  it("comprueba claves foráneas sobre la BD restaurada", async () => {
    const { conexion, destino, media } = await entorno();
    try {
      const copia = await copiarBd(conexion.cliente, destino, new Date(), media);
      // La conexión en memoria permite DETACH y borrar después el fichero en Windows.
      await conexion.cliente.execute({
        sql: "ATTACH DATABASE ? AS rota",
        args: [path.join(copia, "santiso.db")],
      });
      await conexion.cliente.execute("PRAGMA foreign_keys = OFF");
      await conexion.cliente.execute(
        "INSERT INTO rota.jugadores_temporada (id, temporada_id, jugador_id, categoria) VALUES ('rota', 'no-existe', 'no-existe', 'Senior')",
      );
      await conexion.cliente.execute("DETACH DATABASE rota");
      const resultado = await verificarCopia(copia);
      expect(resultado.ok).toBe(false);
      expect(resultado.errores.join(" ")).toContain("clave foránea");
    } finally {
      conexion.cerrar();
    }
  });

  it("CLI usa última copia por defecto y devuelve error para media ausente o BD corrupta", async () => {
    const { conexion, destino, media, dir } = await entorno();
    const ejecutar = (ruta?: string) =>
      spawnSync(
        process.execPath,
        [process.env.npm_execpath!, "db:verificar-copia", ...(ruta ? [ruta] : [])],
        {
          cwd: fileURLToPath(new URL("../../../", import.meta.url)),
          env: { ...process.env, SANTISO_DATA_DIR: dir },
          encoding: "utf8",
          timeout: 15_000,
        },
      );
    try {
      const copia = await copiarBd(conexion.cliente, destino, new Date(), media);
      const correcta = ejecutar();
      expect(correcta.status, correcta.stdout + correcta.stderr).toBe(0);
      expect(correcta.stdout).toContain("Restauración temporal: CORRECTA");
      rmSync(path.join(copia, "media/escudos/club.webp"));
      const ausente = ejecutar(copia);
      expect(ausente.status, ausente.stdout + ausente.stderr).not.toBe(0);
      expect(ausente.stderr).toContain("escudos/club.webp");
      writeFileSync(path.join(copia, "santiso.db"), "BD corrupta");
      expect(ejecutar(copia).status).not.toBe(0);
    } finally {
      conexion.cerrar();
    }
  }, 45_000);
});
