import { describe, expect, it } from "vitest";
import { cierreHecho, partidoEnMesa, progresoPartido, trasPartido } from "./vestiario";
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

const guardado = (desactualizado = false) => [
  { formato: "publicacion" as const, url: "/media/c.png", generadoEn: ahora, desactualizado },
];

describe("mesa de trabajo", () => {
  it("Senior antes del partido: cartel de partido, convocatoria y once inicial, en ese orden", () => {
    const { pasos, principal } = progresoPartido(partido(), ahora, "Senior");
    expect(pasos.map((p) => p.titulo)).toEqual([
      "Cartel de partido",
      "Convocatoria",
      "Once inicial",
    ]);
    expect(principal.titulo).toBe("Preparar cartel de partido");
  });
  it("prioriza convocatoria realmente guardada, no valores por defecto del editor", () => {
    const carteles = { partido: guardado() };
    expect(progresoPartido(partido(), ahora, "Senior", carteles).principal.titulo).toBe(
      "Preparar convocatoria",
    );
    expect(
      progresoPartido(
        partido({ preparacion: { convocatoria: 0, titulares: 0, capitan: false } }),
        ahora,
        "Senior",
        carteles,
      ).principal.titulo,
    ).toBe("Preparar convocatoria");
  });
  it("una convocatoria guardada sin su cartel sigue pendiente", () => {
    const p = partido({ preparacion: { convocatoria: 18, titulares: 0, capitan: false } });
    const { pasos, principal } = progresoPartido(p, ahora, "Senior", { partido: guardado() });
    expect(pasos[1]).toMatchObject({ estado: "18 convocados · Sin cartel", tono: "pendiente" });
    expect(principal.titulo).toBe("Preparar convocatoria");
  });
  it("pasa al once al tener convocatoria y su cartel; exige once completo y capitán", () => {
    const carteles = { partido: guardado(), convocatoria: guardado() };
    const p = partido({ preparacion: { convocatoria: 18, titulares: 10, capitan: true } });
    expect(progresoPartido(p, ahora, "Senior", carteles).principal.titulo).toBe(
      "Completar once inicial",
    );
    const sinCapitan = { ...p, preparacion: { convocatoria: 18, titulares: 11, capitan: false } };
    expect(progresoPartido(sinCapitan, ahora, "Senior", carteles).pasos[2]?.estado).toBe(
      "11/11 · falta capitán",
    );
    const completo = { ...p, preparacion: { convocatoria: 18, titulares: 11, capitan: true } };
    expect(
      progresoPartido(completo, ahora, "Senior", { ...carteles, once: guardado() }).principal
        .titulo,
    ).toBe("Todo listo: compartir");
  });
  it("un cartel con datos que cambiaron no cuenta como hecho", () => {
    const { pasos, principal } = progresoPartido(partido(), ahora, "Senior", {
      partido: guardado(true),
    });
    expect(pasos[0]).toMatchObject({ estado: "⚠ Cartel desactualizado", tono: "pendiente" });
    expect(principal.titulo).toBe("Preparar cartel de partido");
  });
  it("tras el partido: resultado, acta y los tres carteles de después, uno tras otro", () => {
    const acta = { convocados: 18, goleadores: [], golesPropiaRival: 0, amarillas: 0, rojas: 0 };
    const p = partido({ golesSantiso: 2, golesRival: 1, acta });
    const { pasos } = progresoPartido(p, ahora);
    expect(pasos.map((x) => x.titulo)).toEqual([
      "Marcador",
      "Acta",
      "Cartel de resultado",
      "Cronoloxía",
      "O Noso 11",
    ]);
    expect(progresoPartido(p, ahora, "Senior", { resultado: guardado() }).principal.titulo).toBe(
      "Hacer cronoloxía",
    );
    const sinActa = progresoPartido({ ...p, acta: null }, ahora).pasos[3];
    expect(sinActa).toMatchObject({ estado: "Espera acta", tono: "espera" });
  });
  it("Veteranos no convoca ni alinea: antes del partido solo queda el cartel", () => {
    const { pasos, principal } = progresoPartido(partido(), ahora, "Veteranos");
    expect(pasos.map((p) => p.titulo)).toEqual(["Cartel de partido"]);
    expect(principal.titulo).toBe("Preparar cartel de partido");
  });
  it("no exige resultado al arrancar: concede dos horas y excluye aplazados", () => {
    expect(trasPartido(partido(), "2026-10-18T17:01")).toBe(false);
    expect(trasPartido(partido(), "2026-10-18T19:00")).toBe(true);
    expect(trasPartido(partido({ estado: "aplazado" }), "2026-10-19T19:00")).toBe(false);
  });
  it("con la federación, sin marcador se espera a que lo traiga: no se manda a Calendario", () => {
    const { pasos, principal } = progresoPartido(
      partido({ federacion: true }),
      "2026-10-18T20:00",
    );
    expect(principal).toMatchObject({ titulo: "Esperando a la federación", traerActa: true });
    expect(principal.href).not.toContain("/admin/calendario");
    expect(pasos[0]).toMatchObject({ titulo: "Marcador", estado: "Lo trae la federación" });
    expect(pasos[0]!.href).toContain("/admin/actas");
    const sin = progresoPartido(partido(), "2026-10-18T20:00");
    expect(sin.principal).toMatchObject({ titulo: "Anotar resultado" });
    expect(sin.principal.traerActa).toBeUndefined();
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
    ).toBe("Hacer cartel de resultado");
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
  it("el cierre pide resultado, cronoloxía y O Noso 11 guardados", () => {
    const g = [{ formato: "publicacion" as const, url: "/x.png", generadoEn: "", desactualizado: false }];
    expect(cierreHecho({ resultado: g, cronoloxia: g })).toBe(false);
    expect(cierreHecho({ resultado: g, cronoloxia: g, noso11: g })).toBe(true);
  });
});
