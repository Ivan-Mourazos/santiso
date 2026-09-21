import { describe, it, expect } from "vitest";
import { categoriaDe, cambiarParametros, esSeccion, rutaSeccion } from "./contexto";
describe("contexto de navegación", () => {
  it("Directiva nunca es categoría deportiva", () => {
    expect(categoriaDe(new URLSearchParams("categoria=Directiva"))).toBe("Senior");
    expect(categoriaDe(new URLSearchParams("categoria=Veteranos"))).toBe("Veteranos");
  });
  it("cambiar sección conserva contexto", () => {
    expect(rutaSeccion("directiva", new URLSearchParams("categoria=Veteranos&temporada=t1"))).toBe(
      "/admin/directiva?categoria=Veteranos&temporada=t1",
    );
  });
  it("cambiar categoría limpia destinos incompatibles", () => {
    const next = cambiarParametros(
      new URLSearchParams("categoria=Senior&competicion=c1&jornada=j1&temporada=t1"),
      { categoria: "Veteranos" },
    );
    expect(next.get("competicion")).toBeNull();
    expect(next.get("jornada")).toBeNull();
    expect(next.get("temporada")).toBe("t1");
  });
  it("cambiar temporada limpia competición", () => {
    expect(
      cambiarParametros(new URLSearchParams("competicion=c"), { temporada: "t" }).has(
        "competicion",
      ),
    ).toBe(false);
  });
  it("no admite rutas arbitrarias", () => {
    expect(esSeccion("login")).toBe(false);
    expect(esSeccion("ajustes-graficos")).toBe(true);
  });
});
