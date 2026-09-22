import { describe, expect, it } from "vitest";
import {
  borradorDeEquipo,
  filtrarEquipos,
  formularioDeEquipo,
  type EquipoCatalogo,
} from "./modelo";

const lista: EquipoCatalogo[] = [
  {
    id: "senior",
    nombre: "Águias",
    categoria: "Senior",
    escudo_url: null,
    es_propio: false,
    competiciones: [],
    numeroPartidos: 0,
  },
  {
    id: "veteranos",
    nombre: "Águias",
    categoria: "Veteranos",
    escudo_url: "/media/escudo.webp",
    es_propio: false,
    competiciones: [],
    numeroPartidos: 2,
  },
];

describe("modelo de equipos", () => {
  it("busca sin tildes ni mayúsculas y combina el filtro de escudo", () => {
    expect(
      filtrarEquipos(lista, { texto: " AGUIAS ", soloSinEscudo: true }).map((e) => e.id),
    ).toEqual(["senior"]);
    expect(
      filtrarEquipos(lista, { texto: "aguias", soloSinEscudo: false }).map((e) => e.id),
    ).toEqual(["senior", "veteranos"]);
    expect(filtrarEquipos(lista, { texto: "  ", soloSinEscudo: false })).toEqual(lista);
    expect(filtrarEquipos(lista, { texto: "ausente", soloSinEscudo: false })).toEqual([]);
  });
  it("conserva identidad y nombre al enviar solamente un escudo", () => {
    const escudo = new Blob(["imagen"], { type: "image/webp" });
    const form = formularioDeEquipo(borradorDeEquipo(lista[0]!), { categoria: "Senior" }, escudo);
    expect(form.get("id")).toBe("senior");
    expect(form.get("nombre")).toBe("Águias");
    expect(form.get("escudo")).toBeInstanceOf(Blob);
    expect(form.has("competicionId")).toBe(false);
  });
  it("no elimina el escudo ni inscribe cuando no se solicitan esos cambios", () => {
    const form = formularioDeEquipo(
      borradorDeEquipo(null),
      { categoria: "Senior", competicionId: "" },
      null,
    );
    expect(form.get("id")).toBe("");
    expect(form.has("escudo")).toBe(false);
    expect(form.has("competicionId")).toBe(false);
    expect(
      formularioDeEquipo(
        { id: "", nombre: "Nuevo" },
        { categoria: "Senior", competicionId: "liga" },
        null,
      ).get("competicionId"),
    ).toBe("liga");
  });
});
