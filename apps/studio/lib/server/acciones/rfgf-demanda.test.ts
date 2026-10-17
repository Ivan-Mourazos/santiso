import { afterEach, expect, it, vi } from "vitest";

const controles = vi.hoisted(() => ({
  permiso: vi.fn(),
  descargador: vi.fn(),
  estado: vi.fn(),
}));
vi.mock("@/lib/server/acceso/permisos", () => ({ soloAdmin: controles.permiso }));
vi.mock("@/lib/server/rfgf/descargador", () => ({ crearDescargador: controles.descargador }));
vi.mock("@/lib/server/rfgf/estado", () => ({ estadoFederacion: controles.estado }));
afterEach(() => vi.resetAllMocks());

it("ninguna petición ni consulta histórica de administrador arranca sin permiso", async () => {
  controles.permiso.mockResolvedValue({
    ok: false,
    error: "Solo el administrador puede hacer eso.",
  });
  const acciones = await import("./rfgf");
  for (const pedir of [
    () => acciones.traerJornadaRfgf("competicion", 1),
    () => acciones.traerActaRfgf("competicion", "partido"),
    () => acciones.traerHorariosRfgf("competicion"),
    () => acciones.traerCifrasJugadoresRfgf("competicion"),
    () => acciones.actualizarClasificacionRfgf("competicion"),
    () => acciones.traerTemporadaHistoricaRfgf("grupo"),
    () => acciones.cargarEstadoHistoricoRfgf(),
    () => acciones.comprobarRfgfAhora(),
    () => acciones.reintentarActaRfgf("acta"),
  ])
    expect(await pedir()).toEqual({ ok: false, error: "Solo el administrador puede hacer eso." });
  expect(controles.descargador).not.toHaveBeenCalled();
});

it("estado de competición admite lectura de sesión y captura fallos de acceso", async () => {
  const { cargarEstadoFederacion } = await import("./rfgf");
  controles.estado.mockResolvedValue(null);
  expect(await cargarEstadoFederacion("ausente")).toEqual({ ok: true, datos: null });
  expect(controles.permiso).not.toHaveBeenCalled();
  controles.estado.mockRejectedValue(new Error("Sin sesión"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect(await cargarEstadoFederacion("competicion")).toMatchObject({ ok: false });
  expect(controles.descargador).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});
