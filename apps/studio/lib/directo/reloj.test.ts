import { describe, expect, it } from "vitest";
import {
  avanzarReloj,
  etiquetaMinuto,
  minutoActual,
  RELOJ_INICIAL,
  segundosParte,
} from "./reloj";

const MIN = 60_000;
const T0 = Date.UTC(2026, 10, 15, 16, 0);
const empezado = avanzarReloj(RELOJ_INICIAL, "empezar", T0);

describe("reloj de la libreta", () => {
  it("antes de empezar no hay minuto", () => {
    expect(minutoActual(RELOJ_INICIAL, T0)).toBeNull();
    expect(RELOJ_INICIAL).toMatchObject({ duracionParte: 45, estado: "previo" });
  });

  it("minuto 1 al empezar y 23 a los 22:30", () => {
    expect(minutoActual(empezado, T0)).toEqual({ parte: 1, minuto: 1 });
    expect(minutoActual(empezado, T0 + 22.5 * MIN)).toEqual({ parte: 1, minuto: 23 });
    expect(segundosParte(empezado, T0 + 22.5 * MIN)).toBe(22 * 60 + 30);
  });

  it("una pausa de 5 minutos no cuenta", () => {
    const pausado = avanzarReloj(empezado, "pausa", T0 + 10 * MIN);
    expect(minutoActual(pausado, T0 + 14 * MIN)).toEqual({ parte: 1, minuto: 11 });
    const sigue = avanzarReloj(pausado, "seguir", T0 + 15 * MIN);
    expect(minutoActual(sigue, T0 + 20.5 * MIN)).toEqual({ parte: 1, minuto: 16 });
  });

  it("10 minutos en segundo plano: el minuto es el real", () => {
    expect(minutoActual(empezado, T0 + 40.2 * MIN)).toEqual({ parte: 1, minuto: 41 });
  });

  it("descanso y segunda parte empiezan en el 46", () => {
    const descanso = avanzarReloj(empezado, "descanso", T0 + 47 * MIN);
    expect(minutoActual(descanso, T0 + 50 * MIN)).toEqual({ parte: 1, minuto: 45 });
    const segunda = avanzarReloj(descanso, "segunda", T0 + 60 * MIN);
    expect(minutoActual(segunda, T0 + 60.5 * MIN)).toEqual({ parte: 2, minuto: 46 });
    expect(segundosParte(segunda, T0 + 63 * MIN)).toBe(48 * 60);
    const final = avanzarReloj(segunda, "final", T0 + 110 * MIN);
    expect(final.estado).toBe("final");
    expect(minutoActual(final, T0 + 111 * MIN)).toBeNull();
  });

  it("acción fuera de orden no cambia nada", () => {
    expect(avanzarReloj(RELOJ_INICIAL, "segunda", T0)).toBe(RELOJ_INICIAL);
    expect(avanzarReloj(empezado, "seguir", T0)).toBe(empezado);
  });

  it("etiqueta con descuento", () => {
    expect(etiquetaMinuto(1, 47, 45)).toBe("45+2");
    expect(etiquetaMinuto(2, 93, 45)).toBe("90+3");
    expect(etiquetaMinuto(1, 23, 45)).toBe("23'");
    expect(etiquetaMinuto(2, null, 45)).toBe("");
  });
});
