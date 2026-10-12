import { describe, expect, it } from "vitest";

import {
  cambioDeHorario,
  fechaBreve,
  fechaDeFederacion,
  jornadasPorJugar,
  tocaMirarHorarios,
} from "./horarios";
import type { PartidoLocal } from "./plan";

const partido = (jornada: number, fecha: string | null, extra: Partial<PartidoLocal> = {}) =>
  ({
    id: `p${jornada}-${fecha}`,
    jornada,
    local: "A",
    visitante: "B",
    fecha,
    conMarcador: false,
    propio: false,
    conActa: false,
    ...extra,
  }) satisfies PartidoLocal;

describe("horarios de la federación", () => {
  it("junta día y hora con el formato de los partidos", () => {
    expect(fechaDeFederacion("2026-10-18", "17:00")).toBe("2026-10-18T17:00");
    expect(fechaDeFederacion("2026-10-18", null)).toBe("2026-10-18");
    expect(fechaBreve("2026-10-18T17:00")).toBe("18/10 17:00");
    expect(fechaBreve("2026-10-18")).toBe("18/10");
  });

  it("se miran al principio y luego cada pocas horas", () => {
    const ahora = new Date("2026-10-12T20:00:00Z");
    expect(tocaMirarHorarios(null, ahora)).toBe(true);
    expect(tocaMirarHorarios("2026-10-12T18:30:00Z", ahora)).toBe(false);
    expect(tocaMirarHorarios("2026-10-12T17:00:00Z", ahora)).toBe(true);
    expect(tocaMirarHorarios("no es una fecha", ahora)).toBe(true);
  });

  it("elige las dos jornadas más próximas que quedan por jugar", () => {
    const partidos = [
      partido(2, "2026-10-04T17:00", { conMarcador: true }),
      partido(3, "2026-10-18T17:00"),
      partido(3, "2026-10-17T18:00"),
      partido(4, "2026-10-25"),
      partido(5, "2026-11-01"),
      partido(6, null),
    ];
    expect(jornadasPorJugar(partidos, "2026-10-12T22:00")).toEqual([3, 4]);
    // El mismo día, sin hora publicada, sigue contando; uno ya empezado, no.
    expect(jornadasPorJugar(partidos, "2026-10-25T09:00")).toEqual([4, 5]);
    expect(jornadasPorJugar([partido(3, "2026-10-18T17:00")], "2026-10-18T17:30")).toEqual([]);
  });

  it("la primera vez aplica lo que diga la federación si es distinto", () => {
    const federacion = { fecha: "2026-10-18T16:30", campo: "Municipal de Santiso" };
    expect(cambioDeHorario(undefined, federacion, { fecha: "2026-10-18T17:00" })).toEqual({
      fecha: "2026-10-18T16:30",
      campo: "Municipal de Santiso",
    });
    expect(cambioDeHorario(undefined, federacion, { fecha: "2026-10-18T16:30" })).toEqual({
      fecha: null,
      campo: "Municipal de Santiso",
    });
  });

  it("si la federación no ha cambiado nada, lo corregido a mano se respeta", () => {
    const visto = { fecha: "2026-10-18T17:00", campo: "Municipal de Santiso" };
    expect(cambioDeHorario(visto, { ...visto }, { fecha: "2026-10-18T19:00" })).toBeNull();
  });

  it("un cambio de la federación sí se aplica, aunque se hubiera tocado a mano", () => {
    const visto = { fecha: "2026-10-18T17:00", campo: "Municipal de Santiso" };
    expect(
      cambioDeHorario(
        visto,
        { fecha: "2026-10-17T16:00", campo: "Municipal de Santiso" },
        { fecha: "2026-10-18T19:00" },
      ),
    ).toEqual({ fecha: "2026-10-17T16:00", campo: null });
    expect(
      cambioDeHorario(visto, { fecha: visto.fecha, campo: "A Gandareira" }, { fecha: visto.fecha }),
    ).toEqual({ fecha: null, campo: "A Gandareira" });
  });

  it("no cambia una hora por «sin hora» ni un campo por «por asignar»", () => {
    expect(
      cambioDeHorario(undefined, { fecha: "2026-10-25", campo: "" }, { fecha: "2026-10-25T17:00" }),
    ).toEqual({ fecha: null, campo: null });
    // Pero si la federación mueve el día, manda ella aunque todavía no dé hora.
    expect(
      cambioDeHorario(undefined, { fecha: "2026-10-24", campo: "" }, { fecha: "2026-10-25T17:00" }),
    ).toEqual({ fecha: "2026-10-24", campo: null });
  });
});
