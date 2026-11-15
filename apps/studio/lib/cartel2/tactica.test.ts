import { expect, it } from "vitest";
import {
  cambiarSistema,
  colocarAutomatico,
  depurar,
  huecosDe,
  lineaDe,
  ponerEnHueco,
  quitarDeHueco,
  SISTEMAS,
  type Linea,
} from "./tactica";

it("cada sistema tiene 11 huecos y el primero es portero", () => {
  for (const s of SISTEMAS) {
    expect(huecosDe(s)).toHaveLength(11);
    expect(huecosDe(s)[0]!.linea).toBe("POR");
  }
});

it("4-4-2 tiene 4 DEF, 4 MED y 2 DEL", () => {
  const n = (l: Linea) => huecosDe("4-4-2").filter((h) => h.linea === l).length;
  expect([n("DEF"), n("MED"), n("DEL")]).toEqual([4, 4, 2]);
});

it("los huecos están dentro de 0–100", () => {
  for (const s of SISTEMAS) {
    for (const h of huecosDe(s)) {
      expect(h.x).toBeGreaterThanOrEqual(0);
      expect(h.x).toBeLessThanOrEqual(100);
      expect(h.y).toBeGreaterThanOrEqual(0);
      expect(h.y).toBeLessThanOrEqual(100);
    }
  }
});

it("lineaDe agrupa las posiciones", () => {
  expect(lineaDe("POR")).toBe("POR");
  expect(lineaDe("LI")).toBe("DEF");
  expect(lineaDe("MCO")).toBe("MED");
  expect(lineaDe("EI")).toBe("DEL");
  expect(lineaDe(null)).toBeNull();
});

it("coloca por línea y rellena el resto", () => {
  const h = colocarAutomatico("4-4-2", [
    { id: "dc", posicion: "DC" },
    { id: "por", posicion: "POR" },
    { id: "x", posicion: null },
  ]);
  expect(h[0]).toBe("por");
  expect(huecosDe("4-4-2")[h.indexOf("dc")]!.linea).toBe("DEL");
  expect(h.filter(Boolean)).toHaveLength(3);
});

it("con 13 jugadores coloca 11 sin duplicar", () => {
  const js = Array.from({ length: 13 }, (_, i) => ({ id: `j${i}`, posicion: null }));
  const h = colocarAutomatico("4-3-3", js);
  expect(h).toHaveLength(11);
  expect(new Set(h.filter(Boolean)).size).toBe(11);
});

it("ponerEnHueco intercambia si el jugador ya estaba colocado", () => {
  expect(ponerEnHueco(["a", "b", ...Array(9).fill(null)], 1, "a").slice(0, 2)).toEqual(["b", "a"]);
});

it("ponerEnHueco mueve a un hueco vacío", () => {
  const h = ponerEnHueco(["a", ...Array(10).fill(null)], 3, "a");
  expect(h[0]).toBeNull();
  expect(h[3]).toBe("a");
});

it("quitarDeHueco vacía el hueco", () => {
  expect(quitarDeHueco(["a", "b", ...Array(9).fill(null)], 0).slice(0, 2)).toEqual([null, "b"]);
});

it("cambiarSistema conserva a los once", () => {
  const js = Array.from({ length: 11 }, (_, i) => ({
    id: `j${i}`,
    posicion: i === 0 ? ("POR" as const) : null,
  }));
  const antes = colocarAutomatico("4-4-2", js);
  const despues = cambiarSistema(antes, "3-5-2", js);
  expect(new Set(despues.filter(Boolean))).toEqual(new Set(antes.filter(Boolean)));
});

it("depurar quita no disponibles y duplicados", () => {
  expect(depurar(["a", "a", "z", ...Array(8).fill(null)], ["a"]).filter(Boolean)).toEqual(["a"]);
});
