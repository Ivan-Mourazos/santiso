import type { Calendario, JornadaCalendario } from "@santiso/actas";
import { describe, expect, it } from "vitest";
import { planDeImportacion, type EstadoBd } from "./plan-importacion";

const equipo = (nombre: string, codigo = "000000") => ({ nombre, codigoFederativo: codigo });

function jornada(numero: number, cruces: [string, string][], fecha = "2026-09-27"): JornadaCalendario {
  return {
    numero,
    fechaNominal: fecha,
    partidos: cruces.map(([local, visitante]) => ({
      local: equipo(local),
      visitante: equipo(visitante),
    })),
  };
}

function calendario(jornadas: JornadaCalendario[]): Calendario {
  const nombres = new Set<string>();
  for (const j of jornadas) {
    for (const p of j.partidos) {
      nombres.add(p.local.nombre);
      nombres.add(p.visitante.nombre);
    }
  }
  return {
    competicion: "LIGA SINTETICA SENIOR | GRUPO 1",
    temporada: "2026-2027",
    equipos: [...nombres].map((n) => equipo(n)),
    jornadas,
  };
}

const bd = (parcial: Partial<EstadoBd> = {}): EstadoBd => ({
  equipos: [],
  jornadas: [],
  cruces: [],
  ...parcial,
});

describe("emparejado de equipos", () => {
  it("empareja por nombre idéntico salvo tildes, mayúsculas y puntuación", () => {
    const plan = planDeImportacion(
      calendario([jornada(1, [["U.D. SANTISO F.C.", "C.D. BERRES"]])]),
      bd({
        equipos: [
          { id: "san", nombre: "UD Santiso FC" },
          { id: "ber", nombre: "CD Berres" },
        ],
      }),
    );
    expect(plan.cruces).toHaveLength(1);
    expect(plan.cruces[0]).toMatchObject({ estado: "nuevo", localId: "san", visitanteId: "ber" });
    expect(plan.sinResolver).toEqual([]);
  });

  it("empareja por parecido cuando el nombre no es idéntico", () => {
    const plan = planDeImportacion(
      calendario([jornada(1, [["ATLETICO ETER", "CLUB ARENAL"]])]),
      bd({
        equipos: [
          { id: "ete", nombre: "Atlético Eter B" },
          { id: "are", nombre: "Club Arenal" },
        ],
      }),
    );
    expect(plan.cruces[0]).toMatchObject({ estado: "nuevo", localId: "ete", visitanteId: "are" });
  });

  it("no confunde un equipo con su filial", () => {
    // En el calendario real conviven `C.S.D ARZUA` y `C.S.D ARZUA "B"`.
    const equipos = [
      { id: "arz", nombre: 'C.S.D. Arzúa' },
      { id: "arzb", nombre: 'C.S.D. Arzúa "B"' },
      { id: "are", nombre: "Club Arenal" },
    ];
    const primero = planDeImportacion(
      calendario([jornada(1, [["C.S.D ARZUA", "CLUB ARENAL"]])]),
      bd({ equipos }),
    );
    expect(primero.cruces[0]?.localId).toBe("arz");

    const segundo = planDeImportacion(
      calendario([jornada(1, [['C.S.D ARZUA "B"', "CLUB ARENAL"]])]),
      bd({ equipos }),
    );
    expect(segundo.cruces[0]?.localId).toBe("arzb");
  });

  it("deja el cruce sin resolver cuando el equipo no está en la base de datos", () => {
    const plan = planDeImportacion(
      calendario([jornada(1, [["EQUIPO DESCONOCIDO", "CLUB ARENAL"]])]),
      bd({ equipos: [{ id: "are", nombre: "Club Arenal" }] }),
    );
    expect(plan.cruces[0]?.estado).toBe("sin-equipo");
    expect(plan.sinResolver).toEqual(["EQUIPO DESCONOCIDO"]);
  });

  it("no elige al azar cuando dos equipos empatan en parecido", () => {
    const plan = planDeImportacion(
      calendario([jornada(1, [["ARZUA", "CLUB ARENAL"]])]),
      bd({
        equipos: [
          { id: "a1", nombre: "CSD Arzúa" },
          { id: "a2", nombre: "Arzúa CSD" },
          { id: "are", nombre: "Club Arenal" },
        ],
      }),
    );
    expect(plan.cruces[0]?.estado).toBe("sin-equipo");
    expect(plan.sinResolver).toContain("ARZUA");
  });

  it("cada nombre sin resolver se lista una sola vez", () => {
    const plan = planDeImportacion(
      calendario([
        jornada(1, [["FANTASMA", "CLUB ARENAL"]]),
        jornada(2, [["CLUB ARENAL", "FANTASMA"]]),
      ]),
      bd({ equipos: [{ id: "are", nombre: "Club Arenal" }] }),
    );
    expect(plan.sinResolver).toEqual(["FANTASMA"]);
  });
});

describe("jornadas", () => {
  it("separa las jornadas que hay que crear de las que ya existen", () => {
    const plan = planDeImportacion(
      calendario([
        jornada(1, [["A", "B"]], "2026-09-27"),
        jornada(2, [["B", "A"]], "2026-10-04"),
      ]),
      bd({
        equipos: [
          { id: "a", nombre: "A" },
          { id: "b", nombre: "B" },
        ],
        jornadas: [{ id: "j1", numero: 1 }],
      }),
    );
    expect(plan.jornadasExistentes).toEqual([1]);
    expect(plan.jornadasNuevas).toEqual([{ numero: 2, fechaInicio: "2026-10-04" }]);
  });

  it("la fecha nominal viaja a la jornada, nunca al partido", () => {
    const plan = planDeImportacion(
      calendario([jornada(1, [["A", "B"]], "2026-09-27")]),
      bd({
        equipos: [
          { id: "a", nombre: "A" },
          { id: "b", nombre: "B" },
        ],
      }),
    );
    expect(plan.jornadasNuevas[0]?.fechaInicio).toBe("2026-09-27");
    expect(plan.cruces[0]).not.toHaveProperty("fecha");
  });
});

describe("cruces que ya están", () => {
  it("marca como existente el cruce que ya está en esa jornada y no lo cuenta como nuevo", () => {
    const plan = planDeImportacion(
      calendario([jornada(1, [["A", "B"]])]),
      bd({
        equipos: [
          { id: "a", nombre: "A" },
          { id: "b", nombre: "B" },
        ],
        jornadas: [{ id: "j1", numero: 1 }],
        cruces: [{ jornadaNumero: 1, equipoLocalId: "a", equipoVisitanteId: "b" }],
      }),
    );
    expect(plan.cruces[0]?.estado).toBe("existe");
    expect(plan.resumen.crucesNuevos).toBe(0);
    expect(plan.resumen.crucesExistentes).toBe(1);
  });

  it("el cruce inverso es otro partido: la vuelta no es la ida", () => {
    const plan = planDeImportacion(
      calendario([jornada(1, [["B", "A"]])]),
      bd({
        equipos: [
          { id: "a", nombre: "A" },
          { id: "b", nombre: "B" },
        ],
        jornadas: [{ id: "j1", numero: 1 }],
        cruces: [{ jornadaNumero: 1, equipoLocalId: "a", equipoVisitanteId: "b" }],
      }),
    );
    expect(plan.cruces[0]?.estado).toBe("nuevo");
  });
});

describe("resumen", () => {
  it("cuenta lo que va a pasar", () => {
    const plan = planDeImportacion(
      calendario([
        jornada(1, [
          ["A", "B"],
          ["C", "FANTASMA"],
        ]),
        jornada(2, [["B", "A"]]),
      ]),
      bd({
        equipos: [
          { id: "a", nombre: "A" },
          { id: "b", nombre: "B" },
          { id: "c", nombre: "C" },
        ],
        jornadas: [{ id: "j1", numero: 1 }],
        cruces: [{ jornadaNumero: 1, equipoLocalId: "a", equipoVisitanteId: "b" }],
      }),
    );
    expect(plan.resumen).toEqual({
      jornadasNuevas: 1,
      crucesNuevos: 1,
      crucesExistentes: 1,
      crucesSinEquipo: 1,
    });
  });

  it("aplicado el plan, volver a importar no propone nada nuevo", () => {
    const cal = calendario([jornada(1, [["A", "B"]]), jornada(2, [["B", "A"]])]);
    const equipos = [
      { id: "a", nombre: "A" },
      { id: "b", nombre: "B" },
    ];

    const primero = planDeImportacion(cal, bd({ equipos }));
    expect(primero.resumen).toMatchObject({ jornadasNuevas: 2, crucesNuevos: 2 });

    // Se simula la escritura del primer plan y se vuelve a planificar.
    const segundo = planDeImportacion(
      cal,
      bd({
        equipos,
        jornadas: primero.jornadasNuevas.map((j) => ({ id: `j${j.numero}`, numero: j.numero })),
        cruces: primero.cruces.map((c) => ({
          jornadaNumero: c.jornada,
          equipoLocalId: c.localId as string,
          equipoVisitanteId: c.visitanteId as string,
        })),
      }),
    );
    expect(segundo.resumen).toMatchObject({ jornadasNuevas: 0, crucesNuevos: 0, crucesExistentes: 2 });
  });
});
