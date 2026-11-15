import { describe, expect, it } from "vitest";
import { pestanasConAviso, seccionDeRuta } from "./avisos";

const pendiente = { titulo: "x", estado: "", tono: "pendiente" as const, href: "" };
const hecho = { ...pendiente, tono: "hecho" as const };

describe("seccionDeRuta", () => {
  it("saca la sección de la ruta, sin parámetros", () => {
    expect(seccionDeRuta("/admin/convocatoria?categoria=Senior&partido=1")).toBe("convocatoria");
    expect(seccionDeRuta("/admin/carteles?plantilla=despues")).toBe("carteles");
    expect(seccionDeRuta("/admin")).toBe("inicio");
    expect(seccionDeRuta("/otra/cosa")).toBeUndefined();
  });
});

describe("pestanasConAviso", () => {
  it("marca la pestaña del siguiente paso", () => {
    const avisos = pestanasConAviso([
      { pasos: [pendiente], principal: { href: "/admin/carteles?plantilla=partido&partido=1" } },
      { pasos: [hecho, pendiente], principal: { href: "/admin/alineacion?partido=2" } },
    ]);
    expect([...avisos].sort()).toEqual(["carteles", "equipo"]);
  });

  it("sin nada pendiente, o esperando a la federación, no avisa", () => {
    expect(
      pestanasConAviso([
        { pasos: [hecho], principal: { href: "/admin/carteles?plantilla=partido" } },
        { pasos: [pendiente], principal: { href: "/admin/actas", traerActa: true } },
      ]).size,
    ).toBe(0);
  });
});
