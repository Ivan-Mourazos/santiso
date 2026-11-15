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
  aplicarColocacion,
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
  posicion: null,
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

  it("es el campo en historia 9:16 con el once colocado, apodos, capitán y portero", () => {
    const alineacion = conCapitan(alternar(alternar(once(), "j16"), "j12"), "j4");
    const conPortero = jugadores.map((j) => (j.id === "j7" ? { ...j, posicion: "POR" as const } : j));
    const p = peticionDeAlineacion("Senior", partido, conPortero, alineacion, recursos);
    if (p.plantilla !== "campo") throw new Error("plantilla");
    expect(medidasDe(p.plantilla, p.formato)).toEqual({ ancho: 1080, alto: 1920 });
    expect(p.datos.momento).toBe("previa");
    expect(p.datos.sistema).toBe("4-4-2");
    expect(p.datos.huecos[0]).toEqual({ dorsal: "7", nombre: "Jugador 7", capitan: false, portero: true });
    expect(p.datos.huecos.filter((h) => h?.portero)).toHaveLength(1);
    expect(p.datos.huecos.map((h) => h?.dorsal).sort()).toEqual(
      Array.from({ length: 11 }, (_, i) => String(i + 1)).sort(),
    );
    expect(p.datos.huecos.find((h) => h?.dorsal === "4")).toMatchObject({ nombre: "Iago SR", capitan: true });
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

  it("usa la colocación guardada y quita a quien ya no es titular", () => {
    const huecos = ["j11", "j99", ...Array<null>(9).fill(null)];
    const p = peticionDeAlineacion("Senior", partido, jugadores, once(), recursos, {
      sistema: "4-3-3",
      huecos,
    });
    if (p.plantilla !== "campo") throw new Error("plantilla");
    expect(p.datos.sistema).toBe("4-3-3");
    expect(p.datos.huecos[0]).toMatchObject({ dorsal: "11", portero: true });
    expect(p.datos.huecos.filter(Boolean)).toHaveLength(11);
  });

  it("sin fecha ni campo no inventa nada; el color de Equipos manda", () => {
    const p = peticionDeAlineacion(
      "Veteranos",
      { ...partido, fecha: null, campo: null, rival: { ...partido.rival, color: "#1d4ed8" } },
      jugadores,
      once(),
      recursos,
    );
    if (p.plantilla !== "campo") throw new Error("plantilla");
    expect(p.datos).toMatchObject({ fecha: "", hora: "", campo: "" });
    expect(p.datos.club.nombre).toBe("UD Santiso FC Solaina");
    expect(p.datos.rival.color).toBe("#1d4ed8");
  });
});

describe("cambios desde el campo", () => {
  const base: Alineacion = { titulares: ["a", "b", "c"], suplentes: ["s1", "s2"], capitanId: "b" };

  it("quien sale del campo pasa a suplente y deja de ser capitán", () => {
    const r = aplicarColocacion(base, ["a", null, "c", ...Array<null>(8).fill(null)]);
    expect(r.titulares).toEqual(["a", "c"]);
    expect(r.suplentes).toEqual(["b", "s1", "s2"]);
    expect(r.capitanId).toBeNull();
  });

  it("un suplente puesto en el campo entra de titular y sale del banco", () => {
    const r = aplicarColocacion(base, ["a", "s2", "c", ...Array<null>(8).fill(null)]);
    expect(r.titulares).toEqual(["a", "s2", "c"]);
    expect(r.suplentes).toEqual(["b", "s1"]);
  });

  it("un jugador de fuera puesto en el campo entra de titular", () => {
    const r = aplicarColocacion(base, ["a", "b", "c", "nuevo", ...Array<null>(7).fill(null)]);
    expect(r.titulares).toEqual(["a", "b", "c", "nuevo"]);
    expect(r.capitanId).toBe("b");
  });
});
