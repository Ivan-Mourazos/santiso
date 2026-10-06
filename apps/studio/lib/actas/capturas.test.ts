import { describe, expect, it } from "vitest";

import {
  MAX_BYTES_CAPTURAS,
  MAX_CAPTURAS,
  elegirArchivosDeActa,
  sinRepetidos,
} from "./capturas";
import type { ActaEvent, ActaPlayerRef, ParsedActa } from "./types";

const imagen = (name: string, size = 1000) => ({ name, type: "image/png", size });
const pdf = (name: string) => ({ name, type: "application/pdf", size: 1000 });

describe("elegirArchivosDeActa", () => {
  it("acepta varias capturas de la misma acta en el orden elegido", () => {
    const seleccion = elegirArchivosDeActa([imagen("1.png"), imagen("2.png"), imagen("3.png")]);
    expect(seleccion.archivos.map((a) => a.name)).toEqual(["1.png", "2.png", "3.png"]);
    expect(seleccion.aviso).toBeNull();
  });

  it("con una ficha PDF se queda solo con ella y lo avisa", () => {
    const seleccion = elegirArchivosDeActa([imagen("1.png"), pdf("ficha.pdf")]);
    expect(seleccion.archivos.map((a) => a.name)).toEqual(["ficha.pdf"]);
    expect(seleccion.aviso).toContain("PDF");
    expect(elegirArchivosDeActa([pdf("ficha.pdf")]).aviso).toBeNull();
  });

  it("descarta lo que no es imagen ni PDF", () => {
    const seleccion = elegirArchivosDeActa([
      imagen("1.png"),
      { name: "notas.txt", type: "text/plain", size: 10 },
    ]);
    expect(seleccion.archivos.map((a) => a.name)).toEqual(["1.png"]);
    expect(seleccion.aviso).toContain("imágenes");
  });

  it("limita el número de capturas", () => {
    const muchas = Array.from({ length: MAX_CAPTURAS + 3 }, (_, i) => imagen(`${i}.png`));
    const seleccion = elegirArchivosDeActa(muchas);
    expect(seleccion.archivos).toHaveLength(MAX_CAPTURAS);
    expect(seleccion.aviso).toContain(String(MAX_CAPTURAS));
  });

  it("no pasa del peso que admite el modelo", () => {
    const mitad = Math.floor(MAX_BYTES_CAPTURAS / 2);
    const seleccion = elegirArchivosDeActa([
      imagen("1.png", mitad),
      imagen("2.png", mitad),
      imagen("3.png", mitad),
    ]);
    expect(seleccion.archivos.map((a) => a.name)).toEqual(["1.png", "2.png"]);
    expect(seleccion.aviso).toContain("2 de 3");
  });

  it("sin nada elegido no hay archivos ni aviso", () => {
    expect(elegirArchivosDeActa([])).toEqual({ archivos: [], aviso: null });
  });
});

describe("sinRepetidos", () => {
  const jugador = (id: string, jugadorId?: string): ActaPlayerRef => ({
    id,
    dorsal: "7",
    rawName: `Jugador ${jugadorId ?? id}`,
    jugadorId,
  });
  const evento = (id: string, extra: Partial<ActaEvent>): ActaEvent => ({
    id,
    tipo: "gol",
    minuto: "10",
    isRival: false,
    confidence: "alta",
    ...extra,
  });
  const acta = (parte: Partial<ParsedActa>): ParsedActa => ({
    marcadorLocal: "1",
    marcadorVisitante: "0",
    campoNombre: "",
    campoPoblacion: "",
    titulares: [],
    suplentes: [],
    eventos: [],
    warnings: [],
    rawText: "x",
    ...parte,
  });

  it("quita jugadores repetidos entre capturas y entre titulares y suplentes", () => {
    const limpia = sinRepetidos(
      acta({
        titulares: [jugador("a", "j1"), jugador("b", "j2"), jugador("c", "j1")],
        suplentes: [jugador("d", "j2"), jugador("e", "j3")],
      }),
    );
    expect(limpia.titulares.map((j) => j.id)).toEqual(["a", "b"]);
    expect(limpia.suplentes.map((j) => j.id)).toEqual(["e"]);
  });

  it("quita el evento que sale en dos capturas y conserva los distintos", () => {
    const j1 = jugador("a", "j1");
    const limpia = sinRepetidos(
      acta({
        eventos: [
          evento("1", { jugador: j1 }),
          evento("2", { jugador: { ...j1, id: "otra-ref" } }),
          evento("3", { jugador: j1, minuto: "55" }),
          evento("4", { tipo: "tarjeta_amarilla", jugador: j1 }),
          evento("5", { isRival: true, nombreRival: "García" }),
          evento("6", { isRival: true, nombreRival: " garcía " }),
        ],
      }),
    );
    expect(limpia.eventos.map((e) => e.id)).toEqual(["1", "3", "4", "5"]);
  });

  it("no toca un acta sin repetidos", () => {
    const original = acta({
      titulares: [jugador("a", "j1"), jugador("b")],
      eventos: [evento("1", { nombreRival: "Pérez", isRival: true })],
    });
    expect(sinRepetidos(original)).toEqual(original);
  });
});
