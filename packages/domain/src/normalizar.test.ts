import { describe, expect, it } from "vitest";
import {
  normalizarCampo,
  normalizarNombreCompeticion,
  normalizarNombreEquipo,
  normalizarNombrePersona,
} from "./normalizar";

describe("normalizarNombreEquipo", () => {
  it("deja los nombres federativos en mayúsculas como se escriben, con tildes", () => {
    const casos: [string, string][] = [
      ["PREFABRICADOS FARO RODEIRO VETERANS", "Prefabricados Faro Rodeiro"],
      ["C.D. VETERANOS BERMÉS", "C.D. Bermés"],
      ["CAF SILLEDA", "CAF Silleda"],
      ["CLUB TABERNA DO PORTUGUES-BOQUEIXON VETERANOS", "Club Taberna do Portugués-Boqueixón"],
      ["MELIDE VETERANOS", "Melide"],
      ["RESMON C.F.", "Resmon C.F."],
      ["S.D. CACHEIRAS", "S.D. Cacheiras"],
      ["S.D. TOURO VETERANOS", "S.D. Touro"],
      ["S.D.C. RECESENDE", "S.D.C. Recesende"],
      ["S.E. ABELLA S.D.E C.", "S.E. Abella S.D.E.C."],
      ["SR CALO - MILONGAS", "S.R. Calo - Milongas"],
      ["ULLA OIL VETERANOS", "Ulla Oil"],
      ["VETERANOS BALOMPIE FOGAR DE BREOGAN", "Balompié Fogar de Breogán"],
    ];
    for (const [entrada, salida] of casos) {
      expect(normalizarNombreEquipo(entrada, "Veteranos"), entrada).toBe(salida);
    }
  });

  it("no cambia lo que ya está bien", () => {
    for (const nombre of [
      "U.D. Santiso F.C. Solaina",
      "A.C.U.D. Camporrapado",
      "C.D. Compañía de María",
      'C.S.D. Arzúa "B"',
      "Guerreros del Sol",
      "Atlético Éter",
      "Vista Alegre S.D.",
    ]) {
      expect(normalizarNombreEquipo(nombre, "Senior"), nombre).toBe(nombre);
    }
  });

  it("corrige siglas sin el último punto y conserva el filial", () => {
    expect(normalizarNombreEquipo('C.S.D Arzúa "B"', "Senior")).toBe('C.S.D. Arzúa "B"');
  });

  it("«Veteranos» solo se quita en veteranos y si queda un nombre", () => {
    expect(normalizarNombreEquipo("Negreira Veteranos", "Senior")).toBe("Negreira Veteranos");
    expect(normalizarNombreEquipo("C.D. Veteranos", "Veteranos")).toBe("C.D. Veteranos");
  });

  it("es idempotente", () => {
    const una = normalizarNombreEquipo("VETERANOS BALOMPIE FOGAR DE BREOGAN", "Veteranos");
    expect(normalizarNombreEquipo(una, "Veteranos")).toBe(una);
  });
});

describe("normalizarCampo", () => {
  it("separa la población y escribe «Municipal» entero", () => {
    expect(normalizarCampo("A Rega- Pontepedra", null)).toEqual({
      nombre: "A Rega",
      poblacion: "Pontepedra",
    });
    expect(normalizarCampo("O Vedral ,Abella", null)).toEqual({
      nombre: "O Vedral",
      poblacion: "Abella",
    });
    expect(normalizarCampo("Mpal Do Camballón", null)).toEqual({
      nombre: "Municipal do Camballón",
      poblacion: null,
    });
    expect(normalizarCampo("Munic. Rebordelo", null)).toEqual({
      nombre: "Municipal Rebordelo",
      poblacion: null,
    });
    expect(normalizarCampo("Suso Conde", "Santiago De Compostela")).toEqual({
      nombre: "Suso Conde",
      poblacion: "Santiago de Compostela",
    });
  });

  it("la población entre paréntesis y «Campo Municipal» abreviado", () => {
    expect(normalizarCampo("Municipal De Loxo (Touro)", null)).toEqual({
      nombre: "Municipal de Loxo",
      poblacion: "Touro",
    });
    expect(normalizarCampo("Campo Municipal As Cancelas", null)).toEqual({
      nombre: "Municipal As Cancelas",
      poblacion: null,
    });
  });

  it("con población, el guion es parte del nombre", () => {
    expect(normalizarCampo("Municipal de Santiso", "Arcediago (Santiso)")).toEqual({
      nombre: "Municipal de Santiso",
      poblacion: "Arcediago (Santiso)",
    });
    expect(normalizarCampo("Municipal De Loxo", "Loxo (Touro)")).toEqual({
      nombre: "Municipal de Loxo",
      poblacion: "Loxo (Touro)",
    });
  });
});

describe("normalizarNombreCompeticion", () => {
  it("escribe el grupo entero", () => {
    expect(normalizarNombreCompeticion("Tercera Futgal - Gr. 3")).toBe("Tercera Futgal - Grupo 3");
    expect(normalizarNombreCompeticion("Veteranos 1ª Galicia - Gr. 2")).toBe(
      "Veteranos 1ª Galicia - Grupo 2",
    );
  });
});

describe("normalizarNombrePersona", () => {
  it("solo toca nombres sin cuidar", () => {
    expect(normalizarNombrePersona("JOSÉ A. MARTÍNEZ IGLESIAS")).toBe("José A. Martínez Iglesias");
    expect(normalizarNombrePersona("José A. Martínez Iglesias")).toBe("José A. Martínez Iglesias");
    expect(normalizarNombrePersona("Xoel  Amboage Rial ")).toBe("Xoel Amboage Rial");
  });
});
