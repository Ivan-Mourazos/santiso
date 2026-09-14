import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { exportarSnapshot } from "./exportar";
import { leerSnapshot } from "./snapshot/archivos";
import { TABLAS, type TablaOrigen } from "./snapshot/tipos";
import { snapshotMinimo } from "./test/fabricas";

const config = { url: "https://abc.supabase.co", claveServicio: "clave-secreta" };
const BASE_MEDIA = "/storage/v1/object/public/fotos/";

// includes() exige el tipo de los elementos; ampliar a string es seguro porque solo se lee.
const esTabla = (valor: string): valor is TablaOrigen =>
  (TABLAS as readonly string[]).includes(valor);

describe("exportarSnapshot", () => {
  it("vuelca tablas, media referenciada y un manifiesto verificable", async () => {
    const { snapshot } = snapshotMinimo();
    snapshot.equipos[0]!.escudo_url = `https://abc.supabase.co${BASE_MEDIA}escudos/santiso.webp`;
    const ficheros: Record<string, Uint8Array> = {
      "escudos/santiso.webp": new Uint8Array([1, 2, 3]),
      "escudo_club.webp": new Uint8Array([9]),
    };
    const fetchFalso: typeof fetch = async (entrada) => {
      const { pathname } = new URL(String(entrada));
      const tabla = /^\/rest\/v1\/(\w+)$/.exec(pathname)?.[1];
      if (tabla && esTabla(tabla)) return Response.json(snapshot[tabla]);
      const contenido = ficheros[decodeURIComponent(pathname.replace(BASE_MEDIA, ""))];
      return contenido
        ? new Response(contenido.slice().buffer)
        : new Response(null, { status: 404 });
    };
    const dir = mkdtempSync(path.join(tmpdir(), "santiso-exportar-"));

    const manifiesto = await exportarSnapshot({
      config,
      dir,
      fetchImpl: fetchFalso,
      registrar: () => {},
    });

    expect(manifiesto.origen).toBe("abc.supabase.co");
    expect(manifiesto.filas["partidos_liga"]).toBe(1);
    expect(Object.keys(manifiesto.media).sort()).toEqual([
      "escudo_club.webp",
      "escudos/santiso.webp",
    ]);
    expect(readFileSync(path.join(dir, "media", "escudos", "santiso.webp"))).toEqual(
      Buffer.from([1, 2, 3]),
    );
    expect(leerSnapshot(dir).snapshot).toEqual(snapshot);
    expect(readFileSync(path.join(dir, "manifiesto.json"), "utf8")).not.toContain("clave-secreta");
  });
});
