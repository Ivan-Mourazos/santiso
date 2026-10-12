import { describe, expect, it } from "vitest";
import { partidoEnMesa, progresoPartido, trasPartido } from "@/components/admin/jornada/vestiario";
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
  acta: null,
  clasificacion: null,
  preparacion: { convocatoria: null, titulares: 0, capitan: false },
  ...cambios,
});
const ahora = "2026-10-18T12:00";

describe("mesa de trabajo", () => {
  it("prioriza convocatoria realmente guardada, no valores por defecto del editor", () => {
    expect(progresoPartido(partido(), ahora).principal.titulo).toBe("Preparar convocatoria");
    expect(
      progresoPartido(
        partido({ preparacion: { convocatoria: 0, titulares: 0, capitan: false } }),
        ahora,
      ).principal.titulo,
    ).toBe("Preparar convocatoria");
  });
  it("pasa al once al guardar convocados; exige once completo y capitán", () => {
    const p = partido({ preparacion: { convocatoria: 18, titulares: 10, capitan: true } });
    expect(progresoPartido(p, ahora).principal.titulo).toBe("Completar once");
    expect(
      progresoPartido(
        { ...p, preparacion: { convocatoria: 18, titulares: 11, capitan: false } },
        ahora,
      ).principal.titulo,
    ).toBe("Completar once");
    expect(
      progresoPartido(
        { ...p, preparacion: { convocatoria: 18, titulares: 11, capitan: true } },
        ahora,
      ).principal.titulo,
    ).toBe("Preparar cartel de partido");
  });
  it("no inventa confirmaciones de exportación ni de publicación", () => {
    const p = partido({ preparacion: { convocatoria: 18, titulares: 11, capitan: true } });
    expect(progresoPartido(p, ahora).pasos.at(-1)?.estado).toBe("Para compartir");
  });
  it("no exige resultado al arrancar: concede dos horas y excluye aplazados", () => {
    expect(trasPartido(partido(), "2026-10-18T17:01")).toBe(false);
    expect(trasPartido(partido(), "2026-10-18T19:00")).toBe(true);
    expect(trasPartido(partido({ estado: "aplazado" }), "2026-10-19T19:00")).toBe(false);
  });
  it("marcador completo y acta gobiernan cierre, incluido 0–0", () => {
    expect(progresoPartido(partido(), "2026-10-18T20:00").principal.titulo).toBe(
      "Anotar resultado",
    );
    const p = partido({ golesSantiso: 0, golesRival: 0 });
    expect(progresoPartido(p, ahora).principal.titulo).toBe("Completar acta");
    expect(
      progresoPartido(
        {
          ...p,
          acta: { convocados: 18, goleadores: [], golesPropiaRival: 0, amarillas: 0, rojas: 0 },
        },
        ahora,
      ).principal.titulo,
    ).toBe("Preparar publicaciones");
  });
  it("mantiene cierre del partido de hoy, sin ocultar siguiente ni último", () => {
    const ultimo = partido({ id: "ultimo", golesSantiso: 1, golesRival: 0 });
    const proximo = partido({ id: "proximo", fecha: "2026-10-25T17:00" });
    expect(partidoEnMesa(proximo, ultimo, "2026-10-18T20:00")?.id).toBe("ultimo");
    expect(partidoEnMesa(proximo, ultimo, "2026-10-19T12:00")?.id).toBe("proximo");
    expect(partidoEnMesa(null, ultimo, ahora)?.id).toBe("ultimo");
    expect(partidoEnMesa(null, null, ahora)).toBeNull();
  });
});
