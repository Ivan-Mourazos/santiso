import { describe, expect, it } from "vitest";
import { cierreHecho, partidoEnMesa, trasPartido } from "./vestiario";
import type { PartidoDeLaSemana } from "@/lib/server/consultas/jornada";

const partido = (cambios: Partial<PartidoDeLaSemana> = {}): PartidoDeLaSemana => ({
  id: "p",
  competicionId: "liga",
  competicion: "Liga",
  jornadaId: "j",
  jornadaNumero: 3,
  fecha: "2026-10-18T17:00",
  estado: "programado",
  santisoLocal: true,
  santiso: "Santiso",
  santisoEscudoUrl: null,
  rival: { nombre: "Rival", escudoUrl: null },
  golesSantiso: null,
  golesRival: null,
  campo: null,
  arbitro: null,
  federacion: false,
  cambioFederacion: null,
  avisos: [],
  acta: null,
  clasificacion: null,
  preparacion: { convocatoria: null, titulares: 0, capitan: false },
  ...cambios,
});
const ahora = "2026-10-18T12:00";

describe("partido de la semana", () => {
  it("no exige resultado al arrancar: concede dos horas y excluye aplazados", () => {
    expect(trasPartido(partido(), "2026-10-18T17:01")).toBe(false);
    expect(trasPartido(partido(), "2026-10-18T19:00")).toBe(true);
    expect(trasPartido(partido({ estado: "aplazado" }), "2026-10-19T19:00")).toBe(false);
  });
  it("mantiene cierre del partido de hoy, sin ocultar siguiente ni último", () => {
    const ultimo = partido({ id: "ultimo", golesSantiso: 1, golesRival: 0 });
    const proximo = partido({ id: "proximo", fecha: "2026-10-25T17:00" });
    expect(partidoEnMesa(proximo, ultimo, "2026-10-18T20:00")?.id).toBe("ultimo");
    // Al día siguiente, con sus carteles ya hechos, manda el próximo.
    expect(partidoEnMesa(proximo, { ...ultimo, cierreHecho: true }, "2026-10-19T12:00")?.id).toBe(
      "proximo",
    );
    expect(partidoEnMesa(null, ultimo, ahora)?.id).toBe("ultimo");
    expect(partidoEnMesa(null, null, ahora)).toBeNull();
  });
  it("el recién jugado sigue dos días mientras le falten los carteles de después", () => {
    const ultimo = partido({ id: "ultimo", fecha: "2026-10-18T17:00", estado: "finalizado" });
    const proximo = partido({ id: "proximo", fecha: "2026-10-25T17:00" });
    expect(partidoEnMesa(proximo, ultimo, "2026-10-19T12:00")?.id).toBe("ultimo");
    expect(partidoEnMesa(proximo, ultimo, "2026-10-20T23:00")?.id).toBe("ultimo");
    expect(partidoEnMesa(proximo, ultimo, "2026-10-21T08:00")?.id).toBe("proximo");
    const cerrado = { ...ultimo, cierreHecho: true };
    expect(partidoEnMesa(proximo, cerrado, "2026-10-19T12:00")?.id).toBe("proximo");
    // Si el próximo se juega hoy, manda el próximo aunque el anterior siga abierto.
    const hoy = partido({ id: "proximo", fecha: "2026-10-19T17:00" });
    expect(partidoEnMesa(hoy, ultimo, "2026-10-19T12:00")?.id).toBe("proximo");
  });
  it("el cierre pide el carrusel de después: resultado y O Noso 11; la cronoloxía ya no", () => {
    const g = [{ formato: "publicacion" as const, url: "/x.png", generadoEn: "", desactualizado: false }];
    expect(cierreHecho({ resultado: g })).toBe(false);
    expect(cierreHecho({ cronoloxia: g, noso11: g })).toBe(false);
    expect(cierreHecho({ resultado: g, noso11: g })).toBe(true);
  });
});
