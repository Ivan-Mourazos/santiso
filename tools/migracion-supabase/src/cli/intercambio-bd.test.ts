import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  IntercambioFallidoError,
  esErrorFicheroEnUso,
  intercambiarFicheros,
  moverBdActualABackup,
} from "./intercambio-bd";

const dirTemporal = () => mkdtempSync(path.join(tmpdir(), "santiso-intercambio-"));

function escenario() {
  const dir = dirTemporal();
  const rutaBd = path.join(dir, "santiso.db");
  const dirMedia = path.join(dir, "media");
  const bdTemporal = `${rutaBd}.importando`;
  const mediaTemporal = `${dirMedia}.importando`;
  const dirBackups = path.join(dir, "backups");
  mkdirSync(dirBackups, { recursive: true });
  const bdBackup = path.join(dirBackups, "santiso-marca.db");
  const mediaBackup = path.join(dirBackups, "media-marca");
  return { dir, rutaBd, dirMedia, bdTemporal, mediaTemporal, bdBackup, mediaBackup };
}

describe("esErrorFicheroEnUso", () => {
  it("reconoce EBUSY y EPERM como fichero en uso", () => {
    expect(esErrorFicheroEnUso(Object.assign(new Error(), { code: "EBUSY" }))).toBe(true);
    expect(esErrorFicheroEnUso(Object.assign(new Error(), { code: "EPERM" }))).toBe(true);
  });

  it("no confunde otros códigos", () => {
    expect(esErrorFicheroEnUso(Object.assign(new Error(), { code: "ENOENT" }))).toBe(false);
    expect(esErrorFicheroEnUso("EBUSY")).toBe(false);
  });
});

describe("moverBdActualABackup", () => {
  it("si no hay BD anterior no hace nada y no respalda sufijos", () => {
    const { rutaBd, bdBackup } = escenario();
    expect(moverBdActualABackup(rutaBd, bdBackup)).toEqual([]);
    expect(existsSync(bdBackup)).toBe(false);
  });

  it("mueve la BD y sus -wal/-shm a backups", () => {
    const { rutaBd, bdBackup } = escenario();
    writeFileSync(rutaBd, "bd-anterior");
    writeFileSync(`${rutaBd}-wal`, "wal");
    writeFileSync(`${rutaBd}-shm`, "shm");
    const sufijos = moverBdActualABackup(rutaBd, bdBackup);
    expect(sufijos.sort()).toEqual(["-shm", "-wal"]);
    expect(existsSync(rutaBd)).toBe(false);
    expect(readFileSync(bdBackup, "utf8")).toBe("bd-anterior");
    expect(existsSync(`${bdBackup}-wal`)).toBe(true);
    expect(existsSync(`${bdBackup}-shm`)).toBe(true);
  });

  it("si falla al mover -wal/-shm, devuelve la BD a su sitio", () => {
    const { rutaBd, bdBackup } = escenario();
    writeFileSync(rutaBd, "bd-anterior");
    writeFileSync(`${rutaBd}-wal`, "wal");
    // Un directorio no vacío en el destino hace fallar el rename del -wal en cualquier sistema.
    mkdirSync(`${bdBackup}-wal`, { recursive: true });
    writeFileSync(path.join(`${bdBackup}-wal`, "ocupado"), "x");

    expect(() => moverBdActualABackup(rutaBd, bdBackup)).toThrow();

    expect(readFileSync(rutaBd, "utf8")).toBe("bd-anterior");
    expect(readFileSync(`${rutaBd}-wal`, "utf8")).toBe("wal");
    expect(existsSync(bdBackup)).toBe(false);
  });
});

describe("intercambiarFicheros", () => {
  it("sustituye la BD y la media por las nuevas cuando todo va bien", () => {
    const { rutaBd, dirMedia, bdTemporal, mediaTemporal, bdBackup, mediaBackup } = escenario();
    writeFileSync(bdTemporal, "bd-nueva");
    mkdirSync(mediaTemporal, { recursive: true });
    writeFileSync(path.join(mediaTemporal, "escudo.webp"), "media-nueva");

    intercambiarFicheros({
      rutaBd,
      dirMedia,
      bdTemporal,
      mediaTemporal,
      bdBackup,
      mediaBackup,
      sufijosBdRespaldados: [],
    });

    expect(readFileSync(rutaBd, "utf8")).toBe("bd-nueva");
    expect(readFileSync(path.join(dirMedia, "escudo.webp"), "utf8")).toBe("media-nueva");
    expect(existsSync(bdTemporal)).toBe(false);
    expect(existsSync(mediaTemporal)).toBe(false);
  });

  it("si falla el intercambio, restaura la BD anterior y deja la build nueva en *.importando", () => {
    const { rutaBd, dirMedia, bdTemporal, mediaTemporal, bdBackup, mediaBackup } = escenario();
    // BD anterior ya "respaldada" por moverBdActualABackup (simulado a mano).
    writeFileSync(bdBackup, "bd-anterior");
    // Media anterior sigue en su sitio: el intercambio la moverá a mediaBackup.
    mkdirSync(dirMedia, { recursive: true });
    writeFileSync(path.join(dirMedia, "vieja.webp"), "media-anterior");
    // La BD nueva no existe (bdTemporal ausente) para forzar el fallo en el rename intermedio.
    mkdirSync(mediaTemporal, { recursive: true });
    writeFileSync(path.join(mediaTemporal, "nueva.webp"), "media-nueva");

    expect(() =>
      intercambiarFicheros({
        rutaBd,
        dirMedia,
        bdTemporal,
        mediaTemporal,
        bdBackup,
        mediaBackup,
        sufijosBdRespaldados: [],
      }),
    ).toThrow(IntercambioFallidoError);

    // Se restauró la BD y la media anteriores; la build nueva sigue intacta en *.importando.
    expect(readFileSync(rutaBd, "utf8")).toBe("bd-anterior");
    expect(readFileSync(path.join(dirMedia, "vieja.webp"), "utf8")).toBe("media-anterior");
    expect(existsSync(bdTemporal)).toBe(false);
    expect(readFileSync(path.join(mediaTemporal, "nueva.webp"), "utf8")).toBe("media-nueva");
  });

  it("si falla tras mover la BD nueva, deshace también ese paso", () => {
    const { dir, rutaBd, bdTemporal, mediaTemporal, bdBackup, mediaBackup } = escenario();
    writeFileSync(bdBackup, "bd-anterior");
    writeFileSync(bdTemporal, "bd-nueva");
    mkdirSync(mediaTemporal, { recursive: true });
    // dirMedia vive bajo un padre inexistente: no hay media anterior que mover (se salta ese
    // paso), pero el rename final de mediaTemporal -> dirMedia falla (ENOENT) y debe deshacer
    // también el paso anterior, que sí tuvo éxito (bdTemporal -> rutaBd).
    const dirMedia = path.join(dir, "padre-inexistente", "media");

    expect(() =>
      intercambiarFicheros({
        rutaBd,
        dirMedia,
        bdTemporal,
        mediaTemporal,
        bdBackup,
        mediaBackup,
        sufijosBdRespaldados: [],
      }),
    ).toThrow(IntercambioFallidoError);

    // La BD nueva se deshizo de vuelta a bdTemporal y se restauró la anterior en rutaBd.
    expect(readFileSync(rutaBd, "utf8")).toBe("bd-anterior");
    expect(readFileSync(bdTemporal, "utf8")).toBe("bd-nueva");
    expect(existsSync(mediaTemporal)).toBe(true);
  });

  it("si deshacer también falla, lo explica y no pierde la copia de la BD anterior", () => {
    const { rutaBd, dirMedia, bdTemporal, mediaTemporal, bdBackup, mediaBackup } = escenario();
    writeFileSync(bdBackup, "bd-anterior");
    // rutaBd ocupada por un directorio no vacío: falla el paso bdTemporal -> rutaBd (bdTemporal no
    // existe) y también la restauración bdBackup -> rutaBd.
    mkdirSync(rutaBd, { recursive: true });
    writeFileSync(path.join(rutaBd, "ocupado"), "x");

    expect(() =>
      intercambiarFicheros({
        rutaBd,
        dirMedia,
        bdTemporal,
        mediaTemporal,
        bdBackup,
        mediaBackup,
        sufijosBdRespaldados: [],
      }),
    ).toThrow(/no se pudo restaurar todo automáticamente/);

    expect(readFileSync(bdBackup, "utf8")).toBe("bd-anterior");
  });
});
