import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { capturar, exito, fallo, validar } from "./resultado";

describe("exito / fallo", () => {
  it("construyen las dos variantes", () => {
    expect(exito(3)).toEqual({ ok: true, datos: 3 });
    expect(fallo("Error")).toEqual({ ok: false, error: "Error" });
    expect(fallo("Error", { nombre: "Obligatorio" })).toEqual({
      ok: false,
      error: "Error",
      campos: { nombre: "Obligatorio" },
    });
  });
});

describe("validar", () => {
  const esquema = z.object({
    nombre: z.string().trim().min(1, "El nombre es obligatorio"),
    jugador: z.object({ dorsal: z.number().int().positive("Dorsal no válido") }),
  });

  it("devuelve los datos ya transformados", () => {
    expect(validar(esquema, { nombre: "  Ana ", jugador: { dorsal: 9 } })).toEqual({
      ok: true,
      datos: { nombre: "Ana", jugador: { dorsal: 9 } },
    });
  });

  it("devuelve el primer mensaje de cada campo con su ruta", () => {
    expect(validar(esquema, { nombre: " ", jugador: { dorsal: -1 } })).toEqual({
      ok: false,
      error: "Revisa los datos del formulario.",
      campos: { nombre: "El nombre es obligatorio", "jugador.dorsal": "Dorsal no válido" },
    });
  });
});

describe("capturar", () => {
  it("envuelve el resultado de la operación", async () => {
    await expect(capturar("No se pudo", async () => "hecho")).resolves.toEqual({
      ok: true,
      datos: "hecho",
    });
  });

  it("convierte una excepción en un fallo y la registra", async () => {
    const registro = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      capturar("No se pudo guardar el equipo.", async () => {
        throw new Error("SQLITE_CONSTRAINT");
      }),
    ).resolves.toEqual({ ok: false, error: "No se pudo guardar el equipo." });
    expect(registro).toHaveBeenCalledOnce();
    registro.mockRestore();
  });
});
