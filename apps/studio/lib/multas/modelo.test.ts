import { describe, expect, it } from "vitest";
import {
  centimosDe,
  CONCEPTOS_DEL_CLUB,
  euros,
  importeDeMulta,
  opcionesDeTexto,
  resumirMultas,
  textoDeConcepto,
  unidadesDe,
  type Multa,
} from "./modelo";

const concepto = (nombre: string) => {
  const c = CONCEPTOS_DEL_CLUB.find((x) => x.nombre === nombre);
  if (!c) throw new Error(`sin concepto ${nombre}`);
  return c;
};

describe("normas del club", () => {
  it("recoge los trece conceptos del cartel, con sus importes", () => {
    expect(CONCEPTOS_DEL_CLUB).toHaveLength(13);
    expect(CONCEPTOS_DEL_CLUB.filter((c) => c.grupo === "adestramento")).toHaveLength(2);
    expect(concepto("Non ir no bus").importeCentimos).toBe(2000);
    expect(concepto("Tarxeta vermella (agresión)").importeCentimos).toBe(1000);
  });

  it("los entrenadores pagan el doble y la prenda va por unidades", () => {
    const amarela = concepto("Tarxeta amarela (protesta, etc.)");
    expect(importeDeMulta(amarela, 1, false)).toBe(300);
    expect(importeDeMulta(amarela, 1, true)).toBe(600);
    // Las unidades no cuentan si el concepto no es por unidad.
    expect(importeDeMulta(amarela, 4, false)).toBe(300);

    const prenda = concepto("Non traer material");
    expect(importeDeMulta(prenda, 3, false)).toBe(300);
    expect(importeDeMulta(prenda, 2, true)).toBe(400);
    expect(importeDeMulta(prenda, 0, false)).toBe(100);
    expect(textoDeConcepto(prenda, 3)).toBe("Non traer material ×3");
    expect(textoDeConcepto(prenda, 1)).toBe("Non traer material");
  });

  it("las prendas se marcan: cada una es una unidad y queda escrita en la multa", () => {
    const prenda = concepto("Non traer material");
    expect(prenda.opciones).toContain("Peto");
    const elegidas = ["Medias 1ª", "Peto"];
    expect(unidadesDe(prenda, 1, elegidas)).toBe(2);
    expect(unidadesDe(prenda, 4, [])).toBe(4);
    expect(textoDeConcepto(prenda, 2, elegidas)).toBe("Non traer material: Medias 1ª, Peto");
    // La camiseta va aparte, a 5 € cada una.
    const camiseta = concepto("Non traer a camiseta");
    expect(importeDeMulta(camiseta, unidadesDe(camiseta, 1, ["Camiseta 1ª", "Camiseta 2ª"]), false)).toBe(
      1000,
    );
    expect(unidadesDe(concepto("Vir en mal estado"), 5, ["x"])).toBe(1);
    expect(opcionesDeTexto(" Peto, Medias 1ª ,, Peto ")).toEqual(["Peto", "Medias 1ª"]);
  });
});

describe("dinero", () => {
  it("céntimos a texto y texto a céntimos, sin decimales flotantes", () => {
    expect(euros(50)).toBe("0,50 €");
    expect(euros(2000)).toBe("20,00 €");
    expect(centimosDe("1,5")).toBe(150);
    expect(centimosDe("0.50 €")).toBe(50);
    expect(centimosDe("3")).toBe(300);
    expect(centimosDe("0")).toBeNull();
    expect(centimosDe("-2")).toBeNull();
    expect(centimosDe("abc")).toBeNull();
    expect(centimosDe("1,234")).toBeNull();
  });
});

describe("resumen del bote", () => {
  const multa = (persona: string, importe: number, pagada: boolean): Multa => ({
    id: `${persona}-${importe}-${pagada}`,
    persona,
    personaClave: `jugador:${persona}`,
    concepto: "x",
    importeCentimos: importe,
    fecha: "2026-10-05",
    nota: null,
    pagadaEn: pagada ? "2026-10-06" : null,
  });

  it("suma lo cobrado y lo pendiente, y ordena por quien más debe", () => {
    const r = resumirMultas([
      multa("Ana", 300, true),
      multa("Ana", 150, false),
      multa("Brais", 500, false),
      multa("Carlos", 100, true),
    ]);
    expect(r.boteCentimos).toBe(400);
    expect(r.pendienteCentimos).toBe(650);
    expect(r.personas.map((p) => [p.persona, p.pendienteCentimos, p.pagadoCentimos])).toEqual([
      ["Brais", 500, 0],
      ["Ana", 150, 300],
      ["Carlos", 0, 100],
    ]);
  });

  it("sin multas, todo a cero", () => {
    expect(resumirMultas([])).toEqual({ boteCentimos: 0, pendienteCentimos: 0, personas: [] });
  });
});
