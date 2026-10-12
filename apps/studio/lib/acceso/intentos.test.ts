import { describe, expect, it } from "vitest";

import { ESPERA_MS, MAX_FALLOS, crearFreno } from "./intentos";

describe("freno de intentos", () => {
  it("deja probar hasta el máximo y luego hace esperar", () => {
    const freno = crearFreno();
    for (let i = 0; i < MAX_FALLOS - 1; i += 1) freno.fallo("mou", 1000 + i);
    expect(freno.espera("mou", 2000)).toBe(0);
    freno.fallo("mou", 2000);
    expect(freno.espera("mou", 2000)).toBe(ESPERA_MS);
    expect(freno.espera("mou", 2000 + 60_000)).toBe(ESPERA_MS - 60_000);
  });

  it("pasada la espera se puede volver a intentar desde cero", () => {
    const freno = crearFreno();
    for (let i = 0; i < MAX_FALLOS; i += 1) freno.fallo("mou", 1000);
    expect(freno.espera("mou", 1000 + ESPERA_MS)).toBe(0);
    freno.fallo("mou", 1000 + ESPERA_MS);
    expect(freno.espera("mou", 1000 + ESPERA_MS)).toBe(0);
  });

  it("un acierto borra los fallos y cada usuario va por su cuenta", () => {
    const freno = crearFreno();
    for (let i = 0; i < MAX_FALLOS; i += 1) freno.fallo("mou", 1000);
    expect(freno.espera("dani", 1000)).toBe(0);
    freno.acierto("mou");
    expect(freno.espera("mou", 1000)).toBe(0);
  });
});
