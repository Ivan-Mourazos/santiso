import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { copiarBd } from "./backup";
import { abrirDb } from "./client";
import { migrarBd } from "./migraciones";
import { marcaFichero, urlArchivo } from "./rutas";
import * as s from "./schema";

describe("marcaFichero", () => {
  it("genera una marca sin dos puntos", () => {
    expect(marcaFichero(new Date("2026-09-13T20:15:03.456Z"))).toBe("2026-09-13T20-15-03");
  });
});

describe("copiarBd", () => {
  it("crea una copia íntegra con la marca de tiempo en el nombre", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "santiso-backup-"));
    const origen = await abrirDb(urlArchivo(path.join(dir, "santiso.db")));
    await migrarBd(origen.db);
    await origen.db.insert(s.temporadas).values({ nombre: "2026/27", activa: true });

    const destino = await copiarBd(
      origen.cliente,
      path.join(dir, "backups"),
      new Date("2026-09-13T20:15:03Z"),
    );
    origen.cerrar();

    expect(path.basename(destino)).toBe("santiso-2026-09-13T20-15-03.db");
    expect(existsSync(destino)).toBe(true);
    const copia = await abrirDb(urlArchivo(destino));
    const integridad = (await copia.cliente.execute("PRAGMA integrity_check")).rows[0]?.[
      "integrity_check"
    ] as string | undefined;
    const temporadas = await copia.db.select().from(s.temporadas);
    copia.cerrar();
    expect(integridad).toBe("ok");
    expect(temporadas).toHaveLength(1);
  });
});
