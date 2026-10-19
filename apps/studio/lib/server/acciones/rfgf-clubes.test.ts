import { afterEach, expect, it, vi } from "vitest";

const simulacion = vi.hoisted(() => ({
  denegado: false,
  traer: vi.fn(async () => ({ clubes: 2, enlazados: 1, colores: 1, dudosos: [], avisos: [] })),
  dudosos: vi.fn(async () => []),
  elegir: vi.fn(async () => undefined),
}));
vi.mock("@/lib/server/acceso/permisos", () => ({
  soloAdmin: async () =>
    simulacion.denegado ? { ok: false, error: "Solo administradores." } : null,
}));
vi.mock("@/lib/server/rfgf/clubes", () => ({
  traerClubes: simulacion.traer,
  equiposPorEnlazar: simulacion.dudosos,
  elegirClubDeEquipo: simulacion.elegir,
}));

afterEach(() => {
  simulacion.denegado = false;
  vi.clearAllMocks();
});

it("las acciones de clubes exigen administrador antes de tocar nada", async () => {
  const acciones = await import("./rfgf");
  simulacion.denegado = true;
  expect(await acciones.traerClubesRfgf()).toMatchObject({ ok: false });
  expect(await acciones.cargarEquiposPorEnlazarRfgf()).toMatchObject({ ok: false });
  expect(await acciones.enlazarEquipoConClubRfgf("e1", "1800")).toMatchObject({ ok: false });
  expect(simulacion.traer).not.toHaveBeenCalled();
  expect(simulacion.dudosos).not.toHaveBeenCalled();
  expect(simulacion.elegir).not.toHaveBeenCalled();
});

it("delegan, validan el código y capturan errores", async () => {
  const acciones = await import("./rfgf");
  expect(await acciones.traerClubesRfgf()).toMatchObject({ ok: true, datos: { clubes: 2 } });
  expect(await acciones.enlazarEquipoConClubRfgf("e1", "1800")).toEqual({ ok: true, datos: null });
  expect(simulacion.elegir).toHaveBeenCalledWith("e1", "1800");
  expect(await acciones.enlazarEquipoConClubRfgf("e1", null)).toEqual({ ok: true, datos: null });
  expect(await acciones.enlazarEquipoConClubRfgf("e1", "x; drop")).toMatchObject({ ok: false });
  vi.spyOn(console, "error").mockImplementation(() => {});
  simulacion.elegir.mockRejectedValueOnce(new Error("Ese equipo no existe."));
  expect(await acciones.enlazarEquipoConClubRfgf("nadie", "1800")).toMatchObject({ ok: false });
});
