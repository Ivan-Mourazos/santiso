import { describe, expect, it } from "vitest";
import { posibleDuplicado, repetidos } from "./duplicados";
import type { EventoDirecto } from "./tipos";

const ev = (id: string, extra: Partial<EventoDirecto> = {}): EventoDirecto => ({
  id,
  tipo: "gol",
  lado: "propio",
  propia: false,
  parte: 1,
  minuto: 23,
  jugadorId: "brais",
  jugadorSaleId: null,
  dorsal: 9,
  dorsalSale: null,
  nota: "",
  ...extra,
});

describe("posibles repetidos", () => {
  it("mismo tipo, equipo, jugador y minuto cercano → repetido", () => {
    expect(posibleDuplicado(ev("b", { minuto: 25 }), [ev("a")])?.id).toBe("a");
    expect(posibleDuplicado(ev("b", { minuto: 26 }), [ev("a")])).toBeNull();
  });

  it("no se compara consigo mismo (al editar)", () => {
    expect(posibleDuplicado(ev("a", { minuto: 24 }), [ev("a")])).toBeNull();
  });

  it("otro tipo, otro equipo, otra parte u otro jugador → no", () => {
    expect(posibleDuplicado(ev("b", { tipo: "tarjeta_amarilla" }), [ev("a")])).toBeNull();
    expect(posibleDuplicado(ev("b", { lado: "rival", jugadorId: null }), [ev("a")])).toBeNull();
    expect(posibleDuplicado(ev("b", { parte: 2 }), [ev("a")])).toBeNull();
    expect(posibleDuplicado(ev("b", { jugadorId: "iago", dorsal: 6 }), [ev("a")])).toBeNull();
  });

  it("rival por dorsal; sin dorsal o sin minuto cuenta como posible", () => {
    const rival = ev("a", { lado: "rival", jugadorId: null, dorsal: 7 });
    expect(posibleDuplicado(ev("b", { lado: "rival", jugadorId: null, dorsal: 7 }), [rival])?.id).toBe("a");
    expect(posibleDuplicado(ev("b", { lado: "rival", jugadorId: null, dorsal: 8 }), [rival])).toBeNull();
    expect(posibleDuplicado(ev("b", { lado: "rival", jugadorId: null, dorsal: null }), [rival])?.id).toBe("a");
    expect(posibleDuplicado(ev("b", { minuto: null }), [ev("a")])?.id).toBe("a");
  });

  it("cambios: mismo que entra y mismo que sale", () => {
    const c = ev("a", { tipo: "cambio", jugadorId: "x", jugadorSaleId: "y", dorsal: 14, dorsalSale: 7 });
    expect(posibleDuplicado({ ...c, id: "b" }, [c])?.id).toBe("a");
    expect(posibleDuplicado({ ...c, id: "b", jugadorSaleId: "z", dorsalSale: 8 }, [c])).toBeNull();
  });

  it("repetidos: ids de todos los que tienen pareja", () => {
    const lista = [ev("a"), ev("b", { minuto: 24 }), ev("c", { tipo: "cambio" })];
    expect([...repetidos(lista)].sort()).toEqual(["a", "b"]);
  });
});
