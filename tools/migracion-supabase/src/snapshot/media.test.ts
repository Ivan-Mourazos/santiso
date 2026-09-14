import { describe, expect, it } from "vitest";
import { fabricar, snapshotMinimo } from "../test/fabricas";
import { claveMediaDesdeUrl, clavesMedia } from "./media";

const BASE = "https://abc.supabase.co/storage/v1/object/public/fotos/";

describe("claveMediaDesdeUrl", () => {
  it("extrae la clave relativa decodificada y sin parámetros", () => {
    expect(claveMediaDesdeUrl(`${BASE}escudos/a%20b.webp`)).toBe("escudos/a b.webp");
    expect(claveMediaDesdeUrl(`${BASE}escudo_club.webp?t=123`)).toBe("escudo_club.webp");
  });

  it("devuelve null si no hay URL", () => {
    expect(claveMediaDesdeUrl("")).toBeNull();
    expect(claveMediaDesdeUrl(null)).toBeNull();
  });

  it("rechaza URLs de otro origen o con segmentos peligrosos", () => {
    expect(() => claveMediaDesdeUrl("https://otro.com/x.webp")).toThrow(/fuera del bucket/);
    expect(() => claveMediaDesdeUrl(`${BASE}../secreto`)).toThrow(/inválida/);
  });

  it("rechaza claves con barra invertida (traversal en Windows)", () => {
    expect(() => claveMediaDesdeUrl(`${BASE}..%5C..%5Cmalo.webp`)).toThrow(/inválida/);
    expect(() => claveMediaDesdeUrl(`${BASE}..\\..\\malo.webp`)).toThrow(/inválida/);
  });
});

describe("clavesMedia", () => {
  it("reúne las referencias de todas las tablas y el escudo del club", () => {
    const { snapshot } = snapshotMinimo();
    snapshot.equipos[0]!.escudo_url = `${BASE}escudos/santiso.webp`;
    snapshot.cartel_assets.push(
      fabricar.asset({ tipo: "config", subtipo: "logo_order", nombre: "xunta_left", url: "" }),
      fabricar.asset({ nombre: "Concello", url: `${BASE}cartel/logo_patrocinador/concello.webp` }),
    );
    expect([...clavesMedia(snapshot)].sort()).toEqual([
      "cartel/logo_patrocinador/concello.webp",
      "escudo_club.webp",
      "escudos/santiso.webp",
    ]);
  });
});
