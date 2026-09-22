import { describe, expect, it } from "vitest";
import type { PatrocinadorDto } from "@/lib/dto";
import {
  activadosSinLogo,
  borradorDePatrocinador,
  erroresPatrocinador,
  filtrarPatrocinadores,
  formularioDePatrocinador,
  logosExcedentes,
  logosVisibles,
} from "./modelo";

const fila = (parcial: Partial<PatrocinadorDto> & { id: string }): PatrocinadorDto => ({
  nombre: parcial.id,
  logo_url: `/media/sponsors/${parcial.id}.webp`,
  web_url: null,
  orden: 0,
  en_carteles: true,
  ...parcial,
});

// Cinco con logo, uno sin logo entre medias y uno fuera de carteles.
const CATALOGO: PatrocinadorDto[] = [
  fila({ id: "logo-1", nombre: "Concello de Santiso" }),
  fila({ id: "logo-2", nombre: "Deputación da Coruña" }),
  fila({ id: "sin-logo", nombre: "Campaña Ficticia", logo_url: null }),
  fila({ id: "logo-3", nombre: "Deporte Galego" }),
  fila({ id: "logo-4", nombre: "Eu Futbolista" }),
  fila({ id: "logo-5", nombre: "Non á Violencia" }),
  fila({ id: "logo-6", nombre: "Sexto Ficticio" }),
  fila({
    id: "web",
    nombre: "Autobuses Santiso",
    en_carteles: false,
    web_url: "https://example.test",
  }),
];

describe("filtrarPatrocinadores", () => {
  it("sin texto ni filtro devuelve todo en el mismo orden", () => {
    expect(filtrarPatrocinadores(CATALOGO, "", "todos").map((f) => f.id)).toEqual(
      CATALOGO.map((f) => f.id),
    );
  });

  it("busca sin tildes ni mayúsculas", () => {
    expect(filtrarPatrocinadores(CATALOGO, "DEPUTACION", "todos").map((f) => f.id)).toEqual([
      "logo-2",
    ]);
  });

  it("separa los que salen en carteles de los que no", () => {
    expect(filtrarPatrocinadores(CATALOGO, "", "fuera-carteles").map((f) => f.id)).toEqual(["web"]);
    expect(filtrarPatrocinadores(CATALOGO, "", "en-carteles")).toHaveLength(7);
  });

  it("encuentra los que no tienen logo", () => {
    expect(filtrarPatrocinadores(CATALOGO, "", "sin-logo").map((f) => f.id)).toEqual(["sin-logo"]);
  });

  it("no altera la lista de entrada", () => {
    const copia = [...CATALOGO];
    filtrarPatrocinadores(CATALOGO, "concello", "en-carteles");
    expect(CATALOGO).toEqual(copia);
  });
});

describe("qué se ve en el cartel", () => {
  it("son los cinco primeros activados con logo, sin contar al que no lo tiene", () => {
    expect(logosVisibles(CATALOGO).map((f) => f.id)).toEqual([
      "logo-1",
      "logo-2",
      "logo-3",
      "logo-4",
      "logo-5",
    ]);
  });

  it("señala al que se queda fuera por pasarse del límite", () => {
    expect(logosExcedentes(CATALOGO).map((f) => f.id)).toEqual(["logo-6"]);
  });

  it("señala al activado que no aparecerá por no tener logo", () => {
    expect(activadosSinLogo(CATALOGO).map((f) => f.id)).toEqual(["sin-logo"]);
  });

  it("con cinco o menos no sobra ninguno", () => {
    const cinco = CATALOGO.filter((f) => f.en_carteles && f.logo_url).slice(0, 5);
    expect(logosVisibles(cinco)).toHaveLength(5);
    expect(logosExcedentes(cinco)).toEqual([]);
  });
});

describe("borrador y formulario", () => {
  it("el alta parte desactivada", () => {
    expect(borradorDePatrocinador(null)).toEqual({
      id: "",
      nombre: "",
      webUrl: "",
      enCarteles: false,
    });
  });

  it("conserva el estado del registro que se edita", () => {
    expect(borradorDePatrocinador(CATALOGO[7]!)).toMatchObject({
      nombre: "Autobuses Santiso",
      webUrl: "https://example.test",
      enCarteles: false,
    });
  });

  it("el formulario siempre dice si sale en carteles, y el logo solo si hay uno nuevo", () => {
    const borrador = borradorDePatrocinador(CATALOGO[0]!);
    const f = formularioDePatrocinador({ ...borrador, webUrl: "  " }, null);
    expect(Object.fromEntries(f.entries())).toEqual({
      id: "logo-1",
      nombre: "Concello de Santiso",
      webUrl: "",
      enCarteles: "true",
    });
    expect(formularioDePatrocinador(borrador, new Blob(["x"])).has("logo")).toBe(true);
  });
});

describe("validación", () => {
  it("exige nombre", () => {
    expect(erroresPatrocinador(borradorDePatrocinador(null))).toHaveProperty("nombre");
  });

  it("admite web vacía y rechaza direcciones que no son http", () => {
    const base = { ...borradorDePatrocinador(null), nombre: "Uno" };
    expect(erroresPatrocinador(base)).toEqual({});
    expect(erroresPatrocinador({ ...base, webUrl: "https://example.test" })).toEqual({});
    expect(erroresPatrocinador({ ...base, webUrl: "example.test" })).toHaveProperty("webUrl");
    expect(erroresPatrocinador({ ...base, webUrl: "javascript:alert(1)" })).toHaveProperty(
      "webUrl",
    );
  });
});
