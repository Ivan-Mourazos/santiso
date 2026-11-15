import { describe, expect, it } from "vitest";
import type { Player } from "@/lib/cartel/types";
import { archivosActuales, estadoCarrusel, onceDespues } from "./despues";
import type { Colocacion } from "./tactica";

const jugador = (id: string): Player => ({
  id,
  jugadorId: id,
  nome: id,
  dorsal: "1",
  eCapitan: false,
});
const titulares = Array.from({ length: 11 }, (_, i) => jugador(`t${i}`));
const suplente = jugador("suplente");

describe("once de después del partido", () => {
  it("al reabrir conserva un suplente que entró y reconstruye el banco", () => {
    const final: Colocacion = {
      sistema: "4-3-3",
      huecos: ["suplente", ...titulares.slice(1).map((j) => j.id)],
    };
    const r = onceDespues(titulares, [suplente], final, null);
    expect(r.colocacion).toEqual(final);
    expect(r.titulares.map((j) => j.id)).toContain("suplente");
    expect(r.suplentes.map((j) => j.id)).toEqual(["t0"]);
  });

  it("no rellena un hueco quitado; depura ausentes y duplicados", () => {
    const final: Colocacion = {
      sistema: "4-4-2",
      huecos: [null, "suplente", "ausente", "suplente", ...Array<null>(7).fill(null)],
    };
    const r = onceDespues(titulares, [suplente], final, null);
    expect(r.colocacion.huecos).toEqual([null, "suplente", ...Array<null>(9).fill(null)]);
    expect(r.suplentes).toEqual(titulares);
  });

  it("solo completa la propuesta inicial desde los titulares y la previa", () => {
    const previa: Colocacion = {
      sistema: "4-3-3",
      huecos: ["ausente", "t2", ...Array<null>(9).fill(null)],
    };
    const r = onceDespues(titulares, [suplente], null, previa);
    expect(r.colocacion.sistema).toBe("4-3-3");
    expect(r.colocacion.huecos[1]).toBe("t2");
    expect(new Set(r.colocacion.huecos)).toEqual(new Set(titulares.map((j) => j.id)));
    expect(r.suplentes).toEqual([suplente]);
  });

  it("Veteranos sin acta elige desde la plantilla y conserva elección al reabrir", () => {
    const plantilla = [...titulares, suplente];
    const inicial = onceDespues([], plantilla, null, null);
    expect(inicial.colocacion.huecos).toEqual(Array(11).fill(null));
    const final: Colocacion = {
      sistema: "4-4-2",
      huecos: ["suplente", ...Array<null>(10).fill(null)],
    };
    expect(onceDespues([], plantilla, final, null).titulares).toEqual([suplente]);
  });
});

it("carrusel detecta cambios de petición y vuelve a hecho tras generar", () => {
  expect(estadoCarrusel(["hecho", "hecho"], "nuevo", "antes")).toBe("desactualizado");
  expect(estadoCarrusel(["hecho", "hecho"], "nuevo", "nuevo")).toBe("hecho");
  expect(estadoCarrusel(["pendiente", "hecho"], "nuevo", "nuevo")).toBe("pendiente");
  expect(estadoCarrusel(["hecho", "desactualizado"], "nuevo", "nuevo")).toBe("desactualizado");
});

it("no comparte los PNG anteriores mientras se descargan las URLs nuevas", () => {
  const anteriores = { clave: "url1|url2", archivos: ["png1", "png2"] };
  expect(archivosActuales(anteriores, "url3|url4")).toBeNull();
  expect(archivosActuales(anteriores, anteriores.clave)).toEqual(anteriores.archivos);
  expect(archivosActuales(null, anteriores.clave)).toBeNull();
});
