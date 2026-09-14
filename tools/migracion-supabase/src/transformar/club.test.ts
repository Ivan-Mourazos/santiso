import { describe, expect, it } from "vitest";
import { fabricar, snapshotVacio } from "../test/fabricas";
import { transformarClub } from "./club";
import { crearInforme } from "./tipos";

const BASE = "https://abc.supabase.co/storage/v1/object/public/fotos/";

describe("transformarClub — patrocinadores", () => {
  it("une el catálogo con los logos de carteles, fusionando por nombre", () => {
    const origen = snapshotVacio();
    const autobuses = fabricar.patrocinador({
      nombre: "Autobuses Santiso",
      web_url: " https://autobuses.example ",
      logo_url: `${BASE}sponsors/autobuses.webp`,
      orden: 3,
    });
    const concello = fabricar.asset({
      nombre: "Concello de Santiso",
      url: `${BASE}cartel/logo_patrocinador/concello.webp`,
      orden: 1,
    });
    origen.patrocinadores.push(autobuses);
    origen.cartel_assets.push(
      concello,
      fabricar.asset({
        nombre: "AUTOBUSES SANTISO",
        url: `${BASE}cartel/logo_patrocinador/autobuses.webp`,
        orden: 0,
      }),
    );
    const informe = crearInforme();

    const { patrocinadores } = transformarClub(origen, informe);

    expect(patrocinadores).toEqual([
      expect.objectContaining({
        id: autobuses.id,
        nombre: "Autobuses Santiso",
        clave: "autobuses santiso",
        logo: "sponsors/autobuses.webp",
        webUrl: "https://autobuses.example",
        orden: 0,
        enCarteles: true,
      }),
      expect.objectContaining({
        id: concello.id,
        nombre: "Concello de Santiso",
        logo: "cartel/logo_patrocinador/concello.webp",
        webUrl: null,
        orden: 1,
        enCarteles: true,
      }),
    ]);
    expect(informe.avisos).toEqual([
      'Logo de cartel "AUTOBUSES SANTISO" unido al patrocinador existente.',
    ]);
  });
});

describe("transformarClub — ajustes", () => {
  it("guarda escudo, logos institucionales y orden de logos", () => {
    const origen = snapshotVacio();
    origen.cartel_assets.push(
      fabricar.asset({
        tipo: "logo_institucional",
        subtipo: "xunta",
        url: `${BASE}cartel/logo_institucional/xunta.webp`,
      }),
      fabricar.asset({
        tipo: "logo_institucional",
        subtipo: "rfgf",
        url: `${BASE}cartel/logo_institucional/rfgf.webp`,
      }),
      fabricar.asset({ tipo: "config", subtipo: "logo_order", nombre: "rfgf_left", url: "" }),
    );

    const { ajustes } = transformarClub(origen, crearInforme());

    expect(ajustes).toEqual([
      { id: "club.escudo", valor: "escudo_club.webp" },
      { id: "cartel.logo_xunta", valor: "cartel/logo_institucional/xunta.webp" },
      { id: "cartel.logo_rfgf", valor: "cartel/logo_institucional/rfgf.webp" },
      { id: "cartel.orden_logos", valor: "rfgf_izquierda" },
    ]);
  });

  it("usa valores por defecto si no hay activos", () => {
    expect(transformarClub(snapshotVacio(), crearInforme()).ajustes).toEqual([
      { id: "club.escudo", valor: "escudo_club.webp" },
      { id: "cartel.orden_logos", valor: "xunta_izquierda" },
    ]);
  });

  it("se detiene ante activos desconocidos o duplicados", () => {
    const tipoRaro = snapshotVacio();
    tipoRaro.cartel_assets.push(fabricar.asset({ tipo: "fondo", nombre: "Fondo" }));
    expect(() => transformarClub(tipoRaro, crearInforme())).toThrow(/tipo desconocido/);

    const duplicado = snapshotVacio();
    duplicado.cartel_assets.push(
      fabricar.asset({ tipo: "logo_institucional", subtipo: "xunta", url: `${BASE}a.webp` }),
      fabricar.asset({ tipo: "logo_institucional", subtipo: "xunta", url: `${BASE}b.webp` }),
    );
    expect(() => transformarClub(duplicado, crearInforme())).toThrow(/2 logos institucionales/);
  });
});
