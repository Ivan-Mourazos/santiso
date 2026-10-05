import { describe, expect, it } from "vitest";
import { leerPeticion } from "@/lib/cartel2/esquema";
import { medidasDe } from "@/lib/cartel2/modelo";
import {
  ALINEACION_VACIA,
  alternar,
  conCapitan,
  errorDeAlineacion,
  papelDe,
  peticionDeAlineacion,
  type Alineacion,
  type JugadorAlineacion,
  type PartidoAlineacion,
} from "./modelo";

const jugadores: JugadorAlineacion[] = Array.from({ length: 16 }, (_, i) => ({
  id: `j${i + 1}`,
  nombre: `Jugador ${i + 1}`,
  apodo: i === 3 ? "Iago SR" : null,
  dorsal: i === 15 ? null : i + 1,
  fotoUrl: null,
  capitan: i === 3,
}));

const partido: PartidoAlineacion = {
  id: "p",
  competicion: "Tercera Futgal - Grupo 3",
  jornada: 3,
  fecha: "2026-10-11T17:00",
  campo: "Pardiñeiro",
  santisoLocal: false,
  santiso: { nombre: "U.D. Santiso F.C.", escudoUrl: "/media/escudos/s.webp", escudo3d: false },
  rival: { nombre: "C.D. Berres", escudoUrl: null, escudo3d: false, color: null },
  finalizado: false,
};

const once = (): Alineacion =>
  jugadores.slice(0, 11).reduce((a, j) => alternar(a, j.id), ALINEACION_VACIA);

describe("elegir la alineación", () => {
  it("un toque: fuera → titular → suplente → fuera", () => {
    let a = alternar(ALINEACION_VACIA, "j1");
    expect(papelDe(a, "j1")).toBe("titular");
    a = alternar(a, "j1");
    expect(papelDe(a, "j1")).toBe("suplente");
    a = alternar(a, "j1");
    expect(papelDe(a, "j1")).toBe("fuera");
  });

  it("con once titulares, el siguiente entra de suplente", () => {
    const a = alternar(once(), "j12");
    expect(a.titulares).toHaveLength(11);
    expect(papelDe(a, "j12")).toBe("suplente");
  });

  it("el capitán es un titular y deja de serlo al salir del once", () => {
    let a = conCapitan(once(), "j4");
    expect(a.capitanId).toBe("j4");
    expect(conCapitan(a, "j12").capitanId).toBe("j4");
    a = alternar(a, "j4");
    expect(a.capitanId).toBeNull();
  });

  it("valida repetidos, demasiados titulares y capitán fuera del once", () => {
    expect(errorDeAlineacion(once())).toBeNull();
    expect(errorDeAlineacion({ titulares: ["a"], suplentes: ["a"], capitanId: null })).toMatch(
      /repetido/,
    );
    expect(
      errorDeAlineacion({
        titulares: jugadores.slice(0, 12).map((j) => j.id),
        suplentes: [],
        capitanId: null,
      }),
    ).toMatch(/11 titulares/);
    expect(errorDeAlineacion({ titulares: ["a"], suplentes: [], capitanId: "b" })).toMatch(
      /capitán/,
    );
  });
});

describe("cartel de la alineación", () => {
  const recursos = { institucionales: [], patrocinadores: [], colorRival: "#64748b" };

  it("es una historia 9:16 con el once por dorsal, apodos y capitán", () => {
    const alineacion = conCapitan(alternar(alternar(once(), "j16"), "j12"), "j4");
    const p = peticionDeAlineacion("Senior", partido, jugadores, alineacion, recursos);
    if (p.plantilla !== "alineacion") throw new Error("plantilla");
    expect(medidasDe(p.plantilla)).toEqual({ ancho: 1080, alto: 1920 });
    expect(p.datos.titulares.map((j) => j.dorsal)).toEqual(
      Array.from({ length: 11 }, (_, i) => String(i + 1)),
    );
    expect(p.datos.titulares[3]).toEqual({ dorsal: "4", nombre: "Iago SR", capitan: true });
    // Suplentes por dorsal; quien no tiene, al final.
    expect(p.datos.suplentes.map((j) => j.dorsal)).toEqual(["12", ""]);
    expect(p.datos).toMatchObject({
      local: false,
      fecha: "2026-10-11",
      hora: "17:00",
      campo: "Pardiñeiro",
      jornada: "3",
    });
    expect(p.datos.rival.color).toBe("#64748b");
    expect(leerPeticion(JSON.parse(JSON.stringify(p)))).not.toBeNull();
  });

  it("sin fecha ni campo no inventa nada; el color de Equipos manda", () => {
    const p = peticionDeAlineacion(
      "Veteranos",
      { ...partido, fecha: null, campo: null, rival: { ...partido.rival, color: "#1d4ed8" } },
      jugadores,
      once(),
      recursos,
    );
    if (p.plantilla !== "alineacion") throw new Error("plantilla");
    expect(p.datos).toMatchObject({ fecha: "", hora: "", campo: "" });
    expect(p.datos.club.nombre).toBe("UD Santiso FC Solaina");
    expect(p.datos.rival.color).toBe("#1d4ed8");
  });
});
