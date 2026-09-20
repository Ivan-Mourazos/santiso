import { describe, expect, it } from "vitest";
import j1 from "./fixtures/jornada-1.json";
import j2 from "./fixtures/jornada-2.json";
import { parsearFicha } from "./ficha";

describe("fichas de veteranos por coordenadas", () => {
  it.each([
    [j1, 1, 3, 2, 9, 6, 5],
    [j2, 2, 5, 2, 6, 4, 7],
  ] as const)(
    "extrae ambas columnas y contrasta goles",
    (items, jornada, local, visitante, sl, sv, goles) => {
      const f = parsearFicha(items);
      expect(f.jornada).toBe(jornada);
      expect(f.marcador).toEqual([local, visitante]);
      expect(f.local.nombre).toBe("EQUIPO LOCAL");
      expect(f.visitante.nombre).toBe("EQUIPO VISITANTE");
      expect(f.local.titulares).toHaveLength(11);
      expect(f.visitante.titulares).toHaveLength(11);
      expect(f.local.suplentes).toHaveLength(sl);
      expect(f.visitante.suplentes).toHaveLength(sv);
      expect(f.goles).toHaveLength(goles);
      expect(f.tarjetas).toHaveLength(2);
      expect(f.tarjetas.every((t) => t.tipo === "desconocido")).toBe(true);
      expect(f.goles.every((g) => g.tipo === "desconocido")).toBe(true);
      expect(f.sustituciones).toBe("no_registradas");
      expect(f).not.toHaveProperty("minutosJugados");
    },
  );
  it("conserva goles repetidos y no deduce penaltis", () => {
    const f = parsearFicha(j2);
    expect(f.goles.filter((g) => g.autor === f.goles[2]?.autor)).toHaveLength(4);
    expect(f.goles.at(-2)).toMatchObject({
      minuto: "85",
      tipo: "desconocido",
      beneficiario: "local",
    });
    expect(f.fecha).toBe("2026-09-19T19:00");
  });
  it("no depende del orden interno del PDF", () => {
    expect(parsearFicha([...j2].reverse())).toEqual(parsearFicha(j2));
  });
  it("rechaza documentos sin texto o formato desconocido", () => {
    expect(() => parsearFicha([])).toThrow();
    expect(() => parsearFicha(j1.filter((i) => i.texto !== "GOLES"))).toThrow();
  });
  it("rechaza un gol perdido y un marcador inconsistente", () => {
    expect(() => parsearFicha(j2.filter((i) => !i.texto.includes("(85')")))).toThrow();
    expect(() =>
      parsearFicha(
        j2.map((i) => (i.texto === "5" && i.x > 0.4 && i.x < 0.66 ? { ...i, texto: "6" } : i)),
      ),
    ).toThrow();
  });
  it("rechaza cambios registrados aún no soportados", () => {
    const h = j2.find((i) => i.texto === "SUSTITUCIONES" && i.x < 0.4)!;
    expect(() =>
      parsearFicha([...j2, { texto: "ENTRA PERSONA", x: h.x, y: h.y + 0.005 }]),
    ).toThrow();
  });
});

it("acepta 0-0 y conserva minutos de descuento", () => {
  const inicio = j2.find((i) => i.texto === "GOLES")!.y;
  const fin = j2.find((i) => i.texto.startsWith("ESTADIO:"))!.y;
  const sinGoles = j2.filter((i) => !(i.x >= 0.4 && i.x < 0.66 && i.y > inicio && i.y < fin));
  const cero = sinGoles.map((i) =>
    i.x >= 0.4 && i.x < 0.66 && i.y < 0.2 && /^\d+$/.test(i.texto) ? { ...i, texto: "0" } : i,
  );
  expect(parsearFicha(cero).goles).toEqual([]);
  const descuento = j2.map((i) => ({ ...i, texto: i.texto.replace("(86')", "(90+2')") }));
  expect(parsearFicha(descuento).goles.at(-1)?.minuto).toBe("90+2");
});
it("rechaza dorsales duplicados y fechas imposibles", () => {
  expect(() =>
    parsearFicha(j2.map((i) => (i.x < 0.4 && i.texto === "2" ? { ...i, texto: "13" } : i))),
  ).toThrow("Dorsales duplicados");
  expect(() =>
    parsearFicha(
      j2.map((i) => (i.texto.startsWith("Fecha:") ? { ...i, texto: "Fecha: 31-02-2026" } : i)),
    ),
  ).toThrow("Fecha");
});

it.each([[j1], [j2]])("no conserva ubicaciones reales en fixtures", (items) => {
  const f = parsearFicha(items);
  expect(f.campo).toBe("Campo de prueba");
  expect(f.poblacion).toBe("Localidad de prueba");
});
