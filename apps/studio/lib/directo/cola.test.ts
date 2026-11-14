import { describe, expect, it } from "vitest";
import type { Resultado } from "@/lib/resultado";
import { aplicarLocal, claveCola, compactar, enviarCola, escribirCola, leerCola } from "./cola";
import { RELOJ_INICIAL } from "./reloj";
import type { EventoDirecto, OperacionDirecto } from "./tipos";

const ev = (id: string, minuto = 10): EventoDirecto => ({
  id,
  tipo: "gol",
  lado: "propio",
  propia: false,
  parte: 1,
  minuto,
  jugadorId: null,
  jugadorSaleId: null,
  dorsal: 9,
  dorsalSale: null,
  nota: "",
});

function almacen() {
  const datos = new Map<string, string>();
  return {
    datos,
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
    removeItem: (k: string) => void datos.delete(k),
  };
}

describe("cola de la libreta", () => {
  it("aplicarLocal: alta, edición y borrado, ordenado por parte y minuto", () => {
    const base = [ev("a", 30)];
    const ops: OperacionDirecto[] = [
      { op: "guardar", evento: ev("b", 5) },
      { op: "guardar", evento: ev("a", 31) },
      { op: "guardar", evento: ev("c", 40) },
      { op: "borrar", id: "c" },
    ];
    expect(aplicarLocal(base, ops)).toEqual([ev("b", 5), ev("a", 31)]);
  });

  it("compactar: dos guardados del mismo id dejan el último", () => {
    const ops: OperacionDirecto[] = [
      { op: "guardar", evento: ev("a", 1) },
      { op: "guardar", evento: ev("b") },
      { op: "guardar", evento: ev("a", 2) },
    ];
    expect(compactar(ops)).toEqual([
      { op: "guardar", evento: ev("b") },
      { op: "guardar", evento: ev("a", 2) },
    ]);
  });

  it("compactar: guardar y luego borrar deja solo el borrado; solo el último reloj", () => {
    const r2 = { ...RELOJ_INICIAL, estado: "primera" as const, inicioParte: 5 };
    const ops: OperacionDirecto[] = [
      { op: "reloj", reloj: RELOJ_INICIAL },
      { op: "guardar", evento: ev("a") },
      { op: "borrar", id: "a" },
      { op: "reloj", reloj: r2 },
    ];
    expect(compactar(ops)).toEqual([
      { op: "borrar", id: "a" },
      { op: "reloj", reloj: r2 },
    ]);
  });

  it("enviarCola: sin red no se pierde nada", async () => {
    const ops: OperacionDirecto[] = [{ op: "guardar", evento: ev("a") }];
    const lanza = async (): Promise<Resultado<null>> => {
      throw new Error("sin red");
    };
    expect(await enviarCola(ops, lanza)).toEqual({ enviadas: 0, error: "Sin conexión" });
    const falla = async (): Promise<Resultado<null>> => ({ ok: false, error: "No" });
    expect(await enviarCola(ops, falla)).toEqual({ enviadas: 0, error: "No" });
    const bien = async (): Promise<Resultado<null>> => ({ ok: true, datos: null });
    expect(await enviarCola(ops, bien)).toEqual({ enviadas: 1 });
    expect(await enviarCola([], bien)).toEqual({ enviadas: 0 });
  });

  it("leer y escribir en el almacén; basura → cola vacía", () => {
    const a = almacen();
    const ops: OperacionDirecto[] = [{ op: "borrar", id: "x" }];
    escribirCola(a, "p1", ops);
    expect(leerCola(a, "p1")).toEqual(ops);
    expect(claveCola("p1")).toBe("santiso:directo:p1");
    escribirCola(a, "p1", []);
    expect(a.datos.has(claveCola("p1"))).toBe(false);
    a.setItem(claveCola("p2"), "{no es json");
    expect(leerCola(a, "p2")).toEqual([]);
    a.setItem(claveCola("p3"), '{"op":"borrar"}');
    expect(leerCola(a, "p3")).toEqual([]);
  });
});
