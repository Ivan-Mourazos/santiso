import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { emparejarClubes, nucleoDeNombre, parsearClubesExcel, urlClubesExcel } from "./clubes";
import { coloresDeEquipacion, coloresDeTexto } from "./colores";

const muestra = new TextDecoder("iso-8859-15").decode(
  readFileSync(path.join(__dirname, "__muestras__/clubes-santiso.xls")),
);

describe("listado de clubes de la federación", () => {
  it("lee la exportación real filtrada por SANTISO", () => {
    const clubes = parsearClubesExcel(muestra);
    expect(clubes).toHaveLength(2);
    expect(clubes[0]).toEqual({
      codigo: "1800",
      nombre: "Unión Deportiva Santiso F.C.",
      clave: "union deportiva santiso f c",
      delegacion: "Santiago",
      comarca: null,
      direccion: "Arcediago s/n",
      localidad: "Santiso",
      provincia: "A Coruña",
      codigoPostal: "15808",
      fechaFundacion: null,
      fechaInscripcionFederacion: "2014-08-21",
      camiseta: "Amarilla",
      pantalon: "Negro",
      medias: "Negras",
      numeroEquipos: 7,
    });
    // «0» de localidad y celdas vacías: la federación no lo tiene.
    expect(clubes[1]).toMatchObject({
      codigo: "5006",
      nombre: "Santiso Solaina",
      localidad: null,
      direccion: null,
      camiseta: null,
      fechaInscripcionFederacion: "2017-08-09",
      numeroEquipos: 1,
    });
  });

  it("rechaza lo que no es el listado", () => {
    expect(() => parsearClubesExcel("<html><body>Acceso</body></html>")).toThrow();
  });

  it("arma la dirección con o sin filtro por nombre", () => {
    expect(urlClubesExcel()).toContain("cod_primaria=1000118");
    expect(urlClubesExcel()).not.toContain("nclub");
    expect(urlClubesExcel("SANTISO")).toContain("nclub=SANTISO");
    expect(new URL(urlClubesExcel()).hostname).toBe("www.futgal.es");
  });
});

describe("emparejar equipos con clubes", () => {
  it("deja el núcleo del nombre sin forma jurídica, siglas ni filial", () => {
    expect(nucleoDeNombre("S.D.C. Recesende")).toBe("recesende");
    expect(nucleoDeNombre("SOCIEDAD DEPORTIVA CULTURAL RECESENDE")).toBe("recesende");
    expect(nucleoDeNombre('C.S.D Arzúa "B"')).toBe("arzua");
    expect(nucleoDeNombre("U.D. Santiso F.C. Solaina")).toBe("santiso solaina");
    expect(nucleoDeNombre("UD Santiso FC")).toBe("santiso");
    expect(nucleoDeNombre("A.D. A Estrada")).toBe("a estrada");
  });

  const clubes = [
    { codigo: "1800", nombre: "Unión Deportiva Santiso F.C." },
    { codigo: "5006", nombre: "Santiso Solaina" },
    { codigo: "10", nombre: "Sociedad Deportiva Cultural Recesende" },
    { codigo: "20", nombre: "Club Deportivo Berres" },
    { codigo: "21", nombre: "Sociedad Deportiva Berres" },
    { codigo: "30", nombre: "Club Deportivo Lalín Fútbol Sala" },
  ];

  it("enlaza solo lo inequívoco y deja el resto para elegir", () => {
    const resultado = emparejarClubes(
      [
        { id: "senior", nombre: "U.D. Santiso F.C." },
        { id: "veteranos", nombre: "U.D. Santiso F.C. Solaina" },
        { id: "recesende", nombre: "S.D.C. Recesende" },
        { id: "berres", nombre: "C.D. Berres" },
        { id: "lalin", nombre: "C.D. Lalín" },
        { id: "nadie", nombre: "Vilatuxe F.C." },
      ],
      clubes,
    );
    expect(resultado.enlazados).toEqual([
      { equipoId: "senior", codigo: "1800" },
      { equipoId: "veteranos", codigo: "5006" },
      { equipoId: "recesende", codigo: "10" },
    ]);
    expect(resultado.dudosos).toEqual([
      // Dos clubes con el mismo núcleo: no se adivina.
      { equipoId: "berres", candidatos: ["20", "21"] },
      // Solo un parecido (el de sala lleva una palabra más): se ofrece, no se enlaza.
      { equipoId: "lalin", candidatos: ["30"] },
    ]);
    expect(resultado.sinClub).toEqual(["nadie"]);
  });
});

describe("colores de la equipación", () => {
  it("pasa las palabras de la federación a #rrggbb", () => {
    expect(coloresDeEquipacion({ camiseta: "Amarilla", pantalon: "Negro" })).toEqual({
      color: "#f4c300",
      color2: "#111111",
    });
    expect(coloresDeEquipacion({ camiseta: "Blanca", pantalon: "Blanco" })).toEqual({
      color: "#ffffff",
      color2: null,
    });
    expect(coloresDeEquipacion({ camiseta: "Rayas rojas y blancas", pantalon: "Azul" })).toEqual({
      color: "#c8102e",
      color2: "#ffffff",
    });
    expect(coloresDeEquipacion({ camiseta: "Azulgrana", pantalon: null })).toEqual({
      color: "#1d4ea8",
      color2: "#7b1e2e",
    });
    expect(coloresDeEquipacion({ camiseta: "Azul marino", pantalon: "Celeste" })).toEqual({
      color: "#14213d",
      color2: "#5fb3e6",
    });
    expect(coloresDeEquipacion({ camiseta: "Verde", pantalon: "Verdes" })?.color2).toBeNull();
    expect(coloresDeEquipacion({ camiseta: "Granate", pantalon: "Blanco" })?.color).toBe("#7b1e2e");
  });

  it("no adivina lo que no conoce", () => {
    expect(coloresDeEquipacion({ camiseta: "Varios", pantalon: "Negro" })).toBeNull();
    expect(coloresDeEquipacion({ camiseta: null, pantalon: null })).toBeNull();
    expect(coloresDeTexto("Rojiblanca").map((c) => c.nombre)).toEqual(["rojo", "blanco"]);
  });
});
