import { describe, expect, it } from "vitest";
import { leerTabla } from "./cliente";

const config = { url: "https://abc.supabase.co", claveServicio: "clave-secreta" };

describe("leerTabla", () => {
  it("pagina con Range hasta recibir una página incompleta", async () => {
    const peticiones: { url: string; range: string | null; apikey: string | null }[] = [];
    const fetchFalso: typeof fetch = async (entrada, init) => {
      const cabeceras = new Headers(init?.headers);
      peticiones.push({
        url: String(entrada),
        range: cabeceras.get("Range"),
        apikey: cabeceras.get("apikey"),
      });
      const cantidad = peticiones.length === 1 ? 1000 : 2;
      return Response.json(Array.from({ length: cantidad }, (_, i) => ({ id: `${i}` })));
    };

    const filas = await leerTabla(config, "jugador_partido_stats", fetchFalso);

    expect(filas).toHaveLength(1002);
    expect(peticiones.map((p) => p.range)).toEqual(["0-999", "1000-1999"]);
    expect(peticiones[0]?.url).toBe(
      "https://abc.supabase.co/rest/v1/jugador_partido_stats?select=*&order=id",
    );
    expect(peticiones[0]?.apikey).toBe("clave-secreta");
  });

  it("ordena por clave natural las tablas sin id", async () => {
    let url = "";
    const fetchFalso: typeof fetch = async (entrada) => {
      url = String(entrada);
      return Response.json([]);
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
});
