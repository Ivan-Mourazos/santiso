import { afterEach, expect, it, vi } from "vitest";

const simulacion = vi.hoisted(() => ({
  denegado: false,
  pedir: vi.fn(async () => undefined),
  cargar: vi.fn(async () => ({ codGrupo: "300", partidos: [], resumen: { total: 0 } })),
}));
vi.mock("@/lib/server/acceso/permisos", () => ({
  soloAdmin: async () =>
    simulacion.denegado ? { ok: false, error: "Solo administradores." } : null,
}));
vi.mock("@/lib/server/rfgf/historico-partidos", () => ({
  pedirPartidosHistoricos: simulacion.pedir,
  partidosHistoricos: simulacion.cargar,
}));

afterEach(() => {
  simulacion.denegado = false;
  vi.clearAllMocks();
});

it("ambas acciones exigen administrador antes de acceder al archivo", async () => {
  const { pedirPartidosHistoricosRfgf, cargarPartidosHistoricosRfgf } = await import("./rfgf");
  simulacion.denegado = true;
  for (const accion of [pedirPartidosHistoricosRfgf, cargarPartidosHistoricosRfgf]) {
    expect(await accion("300")).toEqual({ ok: false, error: "Solo administradores." });
  }
  expect(simulacion.pedir).not.toHaveBeenCalled();
  expect(simulacion.cargar).not.toHaveBeenCalled();
});

it("acciones delegan solo al grupo pedido y capturan errores", async () => {
  const { pedirPartidosHistoricosRfgf, cargarPartidosHistoricosRfgf } = await import("./rfgf");
  expect(await pedirPartidosHistoricosRfgf("300")).toEqual({ ok: true, datos: null });
  expect(simulacion.pedir).toHaveBeenCalledWith("300");
  expect(await cargarPartidosHistoricosRfgf("300")).toMatchObject({ ok: true });
  expect(simulacion.cargar).toHaveBeenCalledWith("300");
  simulacion.pedir.mockRejectedValueOnce(new Error("Grupo inexistente"));
  expect(await pedirPartidosHistoricosRfgf("ausente")).toMatchObject({ ok: false });
});
