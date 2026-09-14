import { describe, expect, it } from "vitest";
import { leerTabla } from "./cliente";

const config = { url: "https://abc.supabase.co", claveServicio: "clave-secreta" };

describe("leerTabla", () => {
  it("pagina con Range hasta recibir una página incompleta", async () => {
    const peticiones: {
      url: string;
      range: string | null;
      apikey: string | null;
      prefer: string | null;
    }[] = [];
    const fetchFalso: typeof fetch = async (entrada, init) => {
      const cabeceras = new Headers(init?.headers);
      peticiones.push({
        url: String(entrada),
        range: cabeceras.get("Range"),
        apikey: cabeceras.get("apikey"),
        prefer: cabeceras.get("Prefer"),
      });
      const cantidad = peticiones.length === 1 ? 1000 : 2;
      return Response.json(
        Array.from({ length: cantidad }, (_, i) => ({ id: `${i}` })),
        {
          headers: { "content-range": `0-${cantidad - 1}/1002` },
        },
      );
    };

    const filas = await leerTabla(config, "jugador_partido_stats", fetchFalso);

    expect(filas).toHaveLength(1002);
    expect(peticiones.map((p) => p.range)).toEqual(["0-999", "1000-1999"]);
    expect(peticiones[0]?.url).toBe(
      "https://abc.supabase.co/rest/v1/jugador_partido_stats?select=*&order=id",
    );
    expect(peticiones[0]?.apikey).toBe("clave-secreta");
    expect(peticiones[0]?.prefer).toBe("count=exact");
  });

  it("ordena por clave natural las tablas sin id", async () => {
    let url = "";
    const fetchFalso: typeof fetch = async (entrada) => {
      url = String(entrada);
      return Response.json([], { headers: { "content-range": "*/0" } });
    };
    await leerTabla(config, "competicion_etiquetas", fetchFalso);
    expect(url).toContain("order=competicion_id,etiqueta");
  });

  it("informa del código HTTP sin revelar la clave", async () => {
    const fetchFalso: typeof fetch = async () => new Response("no", { status: 401 });
    const error = await leerTabla(config, "equipos", fetchFalso).catch((e: unknown) => e);
    expect(String(error)).toMatch(/HTTP 401/);
    expect(String(error)).not.toMatch(/clave-secreta/);
  });

  it("lanza si PostgREST recorta en silencio y el total no cuadra con lo leído", async () => {
    let peticion = 0;
    const fetchFalso: typeof fetch = async () => {
      peticion++;
      // Solo hay una página completa (1000 filas) y la siguiente petición ya no debería llegar
      // a completar las 1500 anunciadas: simulamos que el proxy devuelve una página incompleta
      // (2 filas) pero el total declarado sigue siendo 1500.
      const cantidad = peticion === 1 ? 1000 : 2;
      return Response.json(
        Array.from({ length: cantidad }, (_, i) => ({ id: `${i}` })),
        {
          headers: { "content-range": `0-${cantidad - 1}/1500` },
        },
      );
    };

    const error = await leerTabla(config, "equipos", fetchFalso).catch((e: unknown) => e);
    expect(String(error)).toMatch(/se leyeron 1002 filas de 1500/);
  });
});
