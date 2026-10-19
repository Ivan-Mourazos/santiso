import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  emparejarClubes,
  nucleoDeNombre,
  parsearClubesExcel,
  siglaDeNombre,
  urlClubesExcel,
} from "./clubes";
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

  // Nombres reales del listado completo de la federación (19/10/2026).
  const clubes = [
    { codigo: "1800", nombre: "Unión Deportiva Santiso F.C." },
    { codigo: "5006", nombre: "Santiso Solaina" },
    { codigo: "1529", nombre: "S.D.C. Recesende" },
    { codigo: "4212", nombre: "C.D. Berres" },
    { codigo: "4604", nombre: "Veteranos Berres" },
    { codigo: "1300", nombre: "S.D. Camporrapado" },
    { codigo: "5106", nombre: "Asociación Club Unión Deportiva Camporrapado" },
    { codigo: "1282", nombre: "Vista Alegre S.D." },
    { codigo: "1827", nombre: "Club Vista Alegre Sociedad Deportiva" },
    { codigo: "1957", nombre: "C.F.S. Arzúa" },
    { codigo: "30", nombre: "Club Deportivo Lalín Fútbol Sala" },
  ];

  it("saca la sigla de la forma jurídica, escrita entera o con puntos", () => {
    expect(siglaDeNombre("A.C.U.D. Camporrapado")).toBe("acud");
    expect(siglaDeNombre("Asociación Club Unión Deportiva Camporrapado")).toBe("acud");
    expect(siglaDeNombre("Unión Deportiva Santiso F.C.")).toBe("udfc");
    expect(siglaDeNombre("Veteranos Berres")).toBe("");
  });

  it("enlaza solo lo inequívoco y deja el resto para elegir", () => {
    const resultado = emparejarClubes(
      [
        { id: "senior", nombre: "U.D. Santiso F.C.", categoria: "Senior" },
        { id: "veteranos", nombre: "U.D. Santiso F.C. Solaina", categoria: "Veteranos" },
        { id: "recesende", nombre: "S.D.C. Recesende", categoria: "Senior" },
        { id: "berres", nombre: "C.D. Berres", categoria: "Senior" },
        { id: "berres-vet", nombre: "Berres", categoria: "Veteranos" },
        { id: "camporrapado", nombre: "A.C.U.D. Camporrapado", categoria: "Senior" },
        { id: "vista", nombre: "Vista Alegre S.D.", categoria: "Senior" },
        { id: "arzua", nombre: 'C.S.D. Arzúa "B"', categoria: "Senior" },
        { id: "lalin", nombre: "C.D. Lalín", categoria: "Senior" },
        { id: "nadie", nombre: "Vilatuxe F.C.", categoria: "Senior" },
      ],
      clubes,
    );
    expect(resultado.enlazados).toEqual([
      { equipoId: "senior", codigo: "1800" },
      { equipoId: "veteranos", codigo: "5006" },
      { equipoId: "recesende", codigo: "1529" },
      // El senior no va con el club de veteranos, y el de veteranos sí.
      { equipoId: "berres", codigo: "4212" },
      { equipoId: "berres-vet", codigo: "4604" },
      // La sigla deshace el empate: «A.C.U.D.» no es «S.D.».
      { equipoId: "camporrapado", codigo: "5106" },
    ]);
    expect(resultado.dudosos).toEqual([
      // Dos clubes con el mismo núcleo y sigla compatible: no se adivina.
      { equipoId: "vista", candidatos: ["1282", "1827"] },
      // Un solo club con ese núcleo, pero «C.S.D.» no casa con «C.F.S.» (fútbol sala).
      { equipoId: "arzua", candidatos: ["1957"] },
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

  it("entiende el gallego, los matices del azul y las erratas del listado", () => {
    const de = (camiseta: string) => coloresDeEquipacion({ camiseta, pantalon: "Negro" });
    expect(de("Franxas verticais brancas e vermellas")).toEqual({
      color: "#ffffff",
      color2: "#c8102e",
    });
    expect(de("Amarela")?.color).toBe("#f4c300");
    expect(de("Amariila")?.color).toBe("#f4c300");
    expect(de("Azul Celeste (Franja Negra)")).toEqual({ color: "#5fb3e6", color2: "#111111" });
    expect(de("Azul Royal")?.color).toBe("#1d4ea8");
    expect(de("Azul oscuro")?.color).toBe("#14213d");
    expect(de("Roxa")?.color).toBe("#5b2a86");
    expect(de("Vino Tinto")?.color).toBe("#6d1a2b");
    expect(de("Fluor")).toBeNull();
  });
});
