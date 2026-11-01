import type { Calendario, EquipoCalendario, JornadaCalendario } from "@santiso/actas";
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
  it("la categoría añadida por la federación no impide casar el club («MELIDE VETERANOS»)", () => {
    const plan = planDeImportacion(
      calendario([
        jornada(1, [
          ["MELIDE VETERANOS", "S.D. TOURO VETERANOS"],
          ["PREFABRICADOS FARO RODEIRO VETERANS", "ULLA OIL VETERANOS"],
        ]),
      ]),
      bd({
        equipos: [
          { id: "mel", nombre: "Melide" },
          { id: "tou", nombre: "S.D. Touro" },
          { id: "pre", nombre: "Prefabricados Faro Rodeiro" },
          { id: "ull", nombre: "Ulla Oil" },
        ],
      }),
    );
    expect(plan.sinResolver).toEqual([]);
    expect(plan.cruces.map((c) => [c.localId, c.visitanteId])).toEqual([
      ["mel", "tou"],
      ["pre", "ull"],
    ]);
  });

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
      equiposNuevos: 0,
      equiposExistentes: 3,
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

describe("contra los calendarios reales del parser", () => {
  // Los PDF originales no están en git; sí sus fragmentos anonimizados, que conservan la
  // estructura y las coordenadas. Esto prueba la cadena entera sobre datos de verdad.
  const cargar = async (fichero: string) => {
    const { readFile } = await import("node:fs/promises");
    const path = (await import("node:path")).default;
    const { fileURLToPath } = await import("node:url");
    const aqui = path.dirname(fileURLToPath(new URL(import.meta.url)));
    const ruta = path.resolve(aqui, "../../../../packages/actas/src/fixtures", fichero);
    const { parsearCalendario } = await import("@santiso/actas");
    return parsearCalendario(JSON.parse(await readFile(ruta, "utf8")));
  };

  it("sin equipos en la base de datos, ningún cruce se puede crear y se dice cuáles faltan", async () => {
    const cal = await cargar("calendario-senior.json");
    const plan = planDeImportacion(cal, bd());

    expect(plan.resumen.jornadasNuevas).toBe(26);
    expect(plan.resumen.crucesNuevos).toBe(0);
    expect(plan.resumen.crucesSinEquipo).toBe(182);
    expect(plan.sinResolver).toHaveLength(14);
  });

  it("con los equipos dados de alta, planifica la temporada entera", async () => {
    const cal = await cargar("calendario-veteranos.json");
    const equipos = cal.equipos.map((e, i) => ({ id: `eq-${i}`, nombre: e.nombre }));
    const plan = planDeImportacion(cal, bd({ equipos }));

    expect(plan.resumen.jornadasNuevas).toBe(30);
    expect(plan.resumen.crucesNuevos).toBe(240);
    expect(plan.resumen.crucesSinEquipo).toBe(0);
    expect(plan.sinResolver).toEqual([]);
    // Nadie se enfrenta a sí mismo: el CHECK de la tabla lo rechazaría.
    expect(plan.cruces.every((c) => c.localId !== c.visitanteId)).toBe(true);
  });
});

describe("con la categoría, los equipos que faltan se dan de alta", () => {
  const conCodigos = (cruces: [EquipoCalendario, EquipoCalendario][]): Calendario => ({
    competicion: "COPA",
    temporada: "2026-2027",
    equipos: cruces.flat(),
    jornadas: [
      {
        numero: 1,
        fase: "Fase previa",
        fechaNominal: "2026-10-31",
        partidos: cruces.map(([local, visitante]) => ({ local, visitante })),
      },
    ],
  });
  const eq = (nombre: string, codigoFederativo = "") => ({ nombre, codigoFederativo });
  const estado = (equipos: EstadoBd["equipos"]): EstadoBd => ({
    equipos,
    jornadas: [],
    cruces: [],
    categoria: "Veteranos",
  });

  it("crea los desconocidos con las reglas de nombres y su club, y deja los partidos listos", () => {
    const plan = planDeImportacion(
      conCodigos([[eq("MELIDE VETERANOS", "5120"), eq("ALFA VETERANOS C.F.", "1000")]]),
      estado([{ id: "melide", nombre: "Melide", clubCodigo: "5120" }]),
    );
    expect(plan.equiposNuevos).toEqual([
      { nombre: "Alfa C.F.", clave: "alfa c f", clubCodigo: "1000" },
    ]);
    expect(plan.equiposExistentes).toEqual(["melide"]);
    expect(plan.sinResolver).toEqual([]);
    expect(plan.cruces[0]).toMatchObject({
      estado: "nuevo",
      localId: "melide",
      visitanteId: null,
      visitanteNuevo: "alfa c f",
    });
    expect(plan.jornadasNuevas[0]?.nombreFase).toBe("Fase previa");
  });

  it("el código de club reconoce a un equipo escrito de otra forma, y lo enseña", () => {
    const plan = planDeImportacion(
      conCodigos([[eq("SR XOGADORES DA VILA", "1234"), eq("ALFA", "1000")]]),
      estado([
        { id: "v", nombre: "Vila", clubCodigo: "1234" },
        { id: "a", nombre: "Alfa", clubCodigo: "1000" },
      ]),
    );
    expect(plan.equiposNuevos).toEqual([]);
    expect(plan.cruces[0]?.localId).toBe("v");
    expect(plan.parecidos).toEqual([{ federacion: "SR XOGADORES DA VILA", equipo: "Vila" }]);
  });

  it("un filial no se confunde con el primer equipo aunque compartan club", () => {
    const plan = planDeImportacion(
      conCodigos([[eq('BASTAVALES U.D. "B"', "1122"), eq("ALFA", "1000")]]),
      estado([
        { id: "b", nombre: "Bastavales U.D.", clubCodigo: "1122" },
        { id: "a", nombre: "Alfa", clubCodigo: "1000" },
      ]),
    );
    expect(plan.equiposNuevos.map((e) => e.clubCodigo)).toEqual(["1122"]);
    expect(plan.cruces[0]?.localId).toBeNull();
  });

  it("un nombre parecido de otro club no es el mismo equipo", () => {
    const plan = planDeImportacion(
      conCodigos([[eq("S.D. TOURO NORTE", "1754"), eq("ALFA", "1000")]]),
      estado([
        { id: "t", nombre: "S.D. Touro Norte Sur", clubCodigo: "1703" },
        { id: "a", nombre: "Alfa", clubCodigo: "1000" },
      ]),
    );
    expect(plan.equiposNuevos.map((e) => e.clave)).toEqual(["s d touro norte"]);
  });

  it("un equipo de la categoría no inscrito todavía se reutiliza e inscribe", () => {
    const plan = planDeImportacion(
      conCodigos([[eq("MELIDE VETERANOS"), eq("ULLA OIL VETERANOS")]]),
      estado([
        { id: "m", nombre: "Melide", inscrito: true },
        { id: "u", nombre: "Ulla Oil" },
      ]),
    );
    expect(plan.equiposNuevos).toEqual([]);
    expect(plan.equiposExistentes.sort()).toEqual(["m", "u"]);
  });
});
