import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolverDirDatos } from "./rutas";

describe("resolverDirDatos", () => {
  it("usa SANTISO_DATA_DIR como ruta absoluta", () => {
    const absoluta = path.resolve(tmpdir(), "santiso-datos");
    expect(resolverDirDatos({ SANTISO_DATA_DIR: absoluta })).toBe(absoluta);
  });

  it("resuelve una ruta relativa contra el directorio actual", () => {
    expect(resolverDirDatos({ SANTISO_DATA_DIR: "datos-relativos" })).toBe(
      path.resolve(process.cwd(), "datos-relativos"),
    );
  });

  it("sin variable (o vacía) usa la carpeta data del repositorio", () => {
    const dir = resolverDirDatos({});
    expect(path.basename(dir)).toBe("data");
    expect(existsSync(path.join(dir, "..", "pnpm-workspace.yaml"))).toBe(true);
    expect(resolverDirDatos({ SANTISO_DATA_DIR: "   " })).toBe(dir);
  });
});
