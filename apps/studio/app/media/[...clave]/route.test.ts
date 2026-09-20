import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

let GET: typeof import("./route").GET;

const pedir = (clave: string[]) =>
  GET(new Request("http://127.0.0.1:3000/media"), { params: Promise.resolve({ clave }) });

describe("GET /media/[...clave]", () => {
  beforeAll(async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "santiso-ruta-media-"));
    mkdirSync(path.join(dir, "media", "escudos"), { recursive: true });
    writeFileSync(path.join(dir, "media", "escudos", "a.webp"), "contenido");
    writeFileSync(path.join(dir, "media", "nota.txt"), "no es imagen");
    writeFileSync(path.join(dir, "fuera.webp"), "fuera de media");
    process.env.SANTISO_DATA_DIR = dir;
    vi.resetModules();
    ({ GET } = await import("./route"));
    delete process.env.SANTISO_DATA_DIR;
  });

  it("sirve el fichero con su tipo y caché inmutable", async () => {
    const respuesta = await pedir(["escudos", "a.webp"]);
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get("content-type")).toBe("image/webp");
    expect(respuesta.headers.get("cache-control")).toBe("no-cache");
    await expect(respuesta.text()).resolves.toBe("contenido");
  });

  it.each([[["escudos", "no-existe.webp"]], [["nota.txt"]], [["..", "fuera.webp"]], [["escudos"]]])(
    "responde 404 para %j",
    async (clave) => {
      expect((await pedir(clave)).status).toBe(404);
    },
  );
});
