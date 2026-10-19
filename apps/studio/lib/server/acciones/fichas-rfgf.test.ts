import { afterEach, expect, it, vi } from "vitest";

const simulacion = vi.hoisted(() => ({
  denegado: false,
  traer: vi.fn(async (jugadorId: string) => ({
    jugadorId,
    paginas: 1,
    leidas: 1,
    pendientes: 0,
    avisos: [],
    errores: [],
  })),
  ficha: vi.fn(async () => null),
}));
vi.mock("@/lib/server/acceso/permisos", () => ({
  soloAdmin: async () =>
    simulacion.denegado ? { ok: false, error: "Solo administradores." } : null,
}));
vi.mock("@/lib/server/rfgf/historico", () => ({ traerTemporadasDeJugador: simulacion.traer }));
vi.mock("@/lib/server/consultas/fichas-rfgf", () => ({
  fichaDeEquipo: simulacion.ficha,
  fichaCompletaDeJugador: simulacion.ficha,
  archivoHistorico: async () => [],
}));

afterEach(() => {
  simulacion.denegado = false;
  vi.clearAllMocks();
});

it("traer temporadas de un jugador exige administrador; leer fichas no", async () => {
  const acciones = await import("./fichas-rfgf");
  simulacion.denegado = true;
  expect(await acciones.traerTemporadasJugador("j1")).toMatchObject({ ok: false });
  expect(simulacion.traer).not.toHaveBeenCalled();
  expect(await acciones.cargarFichaDeEquipo("e1")).toEqual({ ok: true, datos: null });
  expect(await acciones.cargarFichaCompletaDeJugador("j1")).toEqual({ ok: true, datos: null });
  expect(await acciones.cargarArchivoHistorico()).toEqual({ ok: true, datos: [] });
});

it("delega en el repaso del jugador y captura sus fallos", async () => {
  const acciones = await import("./fichas-rfgf");
  expect(await acciones.traerTemporadasJugador("j1")).toMatchObject({
    ok: true,
    datos: { jugadorId: "j1", paginas: 1 },
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
  simulacion.traer.mockRejectedValueOnce(new Error("caída"));
  expect(await acciones.traerTemporadasJugador("j1")).toMatchObject({ ok: false });
});
