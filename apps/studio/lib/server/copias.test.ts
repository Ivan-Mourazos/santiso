import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { abrirDb, migrarBd, urlArchivo } from "@santiso/db";
import { afterEach, describe, expect, it, vi } from "vitest";

import { COPIAS_QUE_SE_GUARDAN, copiaDiaria } from "./copias";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function entorno() {
  const dir = mkdtempSync(path.join(tmpdir(), "santiso-copias-"));
  const conexion = await abrirDb(urlArchivo(path.join(dir, "santiso.db")));
  await migrarBd(conexion.db);
  return {
    conexion,
    destino: path.join(dir, "diarias"),
    dirMedia: path.join(dir, "media"),
    dirExterno: "",
  };
}

describe("copia diaria", () => {
  it("hace una sola copia al día", async () => {
    const { conexion, destino, ...opciones } = await entorno();
    const primera = await copiaDiaria(
      conexion.cliente,
      new Date("2026-10-12T08:00:00Z"),
      destino,
      opciones,
    );
    const segunda = await copiaDiaria(
      conexion.cliente,
      new Date("2026-10-12T19:00:00Z"),
      destino,
      opciones,
    );
    const manana = await copiaDiaria(
      conexion.cliente,
      new Date("2026-10-13T08:00:00Z"),
      destino,
      opciones,
    );
    conexion.cerrar();
    expect(path.basename(primera ?? "")).toBe("santiso-2026-10-12T08-00-00");
    expect(segunda).toBeNull();
    expect(manana).not.toBeNull();
    expect(readdirSync(destino)).toHaveLength(2);
  });

  it("conserva las últimas y no borra lo que no es una copia suya", async () => {
    const { conexion, destino, ...opciones } = await entorno();
    mkdirSync(destino, { recursive: true });
    const antigua = path.join(destino, "santiso-2026-09-01T08-00-00.db");
    writeFileSync(antigua, "formato antiguo");
    const manual = path.join(path.dirname(destino), "santiso-2026-08-01T08-00-00");
    mkdirSync(manual);
    writeFileSync(path.join(manual, "manifiesto.json"), "manual intacta");
    for (let dia = 1; dia <= COPIAS_QUE_SE_GUARDAN + 3; dia += 1) {
      await copiaDiaria(conexion.cliente, new Date(Date.UTC(2026, 8, dia, 8)), destino, opciones);
      if (dia === 1) writeFileSync(path.join(destino, "notas.txt"), "no tocar");
    }
    conexion.cerrar();
    const ficheros = readdirSync(destino).sort();
    expect(ficheros).toContain("notas.txt");
    const copias = ficheros.filter(
      (nombre) => nombre.startsWith("santiso-") && !nombre.endsWith(".db"),
    );
    expect(copias).toHaveLength(COPIAS_QUE_SE_GUARDAN);
    expect(copias[0]).toBe("santiso-2026-09-04T08-00-00");
    expect(readFileSync(antigua, "utf8")).toBe("formato antiguo");
    expect(readFileSync(path.join(manual, "manifiesto.json"), "utf8")).toBe("manual intacta");
  });

  it("replica fuera del PC, conserva 14 y deja intactos formato antiguo y manuales", async () => {
    const { conexion, destino, ...opciones } = await entorno();
    const externo = mkdtempSync(path.join(tmpdir(), "santiso-externas-"));
    mkdirSync(path.join(opciones.dirMedia, "escudos"), { recursive: true });
    writeFileSync(path.join(opciones.dirMedia, "escudos/club.webp"), "escudo externo");
    vi.stubEnv("STUDIO_COPIA_EXTERNA", externo);
    mkdirSync(path.join(externo, "diarias"));
    const antigua = path.join(externo, "diarias/santiso-2026-08-01T08-00-00.db");
    writeFileSync(antigua, "no tocar");
    const manual = path.join(externo, "santiso-2026-08-01T08-00-00");
    mkdirSync(manual);
    writeFileSync(path.join(manual, "manifiesto.json"), "manual");
    let ultima: string | null = null;
    try {
      for (let dia = 1; dia <= 17; dia++) {
        ultima = await copiaDiaria(conexion.cliente, new Date(Date.UTC(2026, 8, dia, 8)), destino, {
          dirMedia: opciones.dirMedia,
        });
      }
      const replicada = path.join(externo, "diarias", path.basename(ultima!));
      expect(readFileSync(path.join(replicada, "santiso.db"))).toEqual(
        readFileSync(path.join(ultima!, "santiso.db")),
      );
      expect(readFileSync(path.join(replicada, "manifiesto.json"))).toEqual(
        readFileSync(path.join(ultima!, "manifiesto.json")),
      );
      expect(existsSync(path.join(replicada, "media"))).toBe(true);
      expect(readFileSync(path.join(replicada, "media/escudos/club.webp"), "utf8")).toBe(
        "escudo externo",
      );
      expect(
        readdirSync(path.join(externo, "diarias"), { withFileTypes: true }).filter((entrada) =>
          entrada.isDirectory(),
        ),
      ).toHaveLength(14);
      expect(readFileSync(antigua, "utf8")).toBe("no tocar");
      expect(readFileSync(path.join(manual, "manifiesto.json"), "utf8")).toBe("manual");
    } finally {
      conexion.cerrar();
    }
  });

  it("registra fallo externo y conserva copia local válida", async () => {
    const { conexion, destino, ...opciones } = await entorno();
    const registrar = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const creada = await copiaDiaria(conexion.cliente, new Date(), destino, {
        ...opciones,
        dirExterno: path.join(destino, "no-existe"),
      });
      expect(existsSync(path.join(creada!, "santiso.db"))).toBe(true);
      expect(registrar).toHaveBeenCalledWith(
        expect.stringContaining("La copia externa falló"),
        expect.any(Error),
      );
      expect(readdirSync(destino)).toEqual([path.basename(creada!)]);
    } finally {
      conexion.cerrar();
    }
  });
});
