import { describe, expect, it } from "vitest";
import { claveNombre, esEquipoPropio, similitudTokens } from "./nombres";

describe("claveNombre", () => {
  it("ignora mayúsculas, puntuación y espacios sobrantes", () => {
    expect(claveNombre("  U.D. Santiso F.C. ")).toBe("u d santiso f c");
    expect(claveNombre("U.D. SANTISO F.C.")).toBe(claveNombre("U.D. Santiso F.C."));
  });

  it("elimina tildes y eñes", () => {
    expect(claveNombre("C.D. COMPAÑÍA DE MARÍA")).toBe("c d compania de maria");
  });

  it("devuelve cadena vacía si no hay letras ni dígitos", () => {
    expect(claveNombre(" .-/ ")).toBe("");
  });
});

describe("similitudTokens", () => {
  it("vale 1 para nombres equivalentes", () => {
    expect(similitudTokens("S.D. Touro", "s.d. TOURO")).toBe(1);
  });

  it("es la proporción de tokens comunes sobre el nombre más largo", () => {
    expect(similitudTokens("S.D. Touro", "S.D. Touro Veteranos")).toBe(0.75);
  });

  it("vale 0 sin tokens comunes o con un nombre vacío", () => {
    expect(similitudTokens("Berres", "Cruces")).toBe(0);
    expect(similitudTokens("", "Cruces")).toBe(0);
  });
});

describe("esEquipoPropio", () => {
  it("reconoce al club en cualquier categoría", () => {
    expect(esEquipoPropio("U.D. SANTISO F.C.")).toBe(true);
    expect(esEquipoPropio("U.D. Santiso F.C. Solaina")).toBe(true);
  });

  it("no confunde palabras que solo contienen el texto", () => {
    expect(esEquipoPropio("Santisoil C.F.")).toBe(false);
    expect(esEquipoPropio("C.D. San Mamed")).toBe(false);
  });
});
