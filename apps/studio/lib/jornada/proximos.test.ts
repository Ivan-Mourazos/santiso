import { describe, expect, it } from "vitest";
import type { SelectorMatch } from "@/components/admin/cartel/Common";
import { elegirProximos } from "./proximos";

const SANTISO = { nombre: "U.D. Santiso F.C.", escudo_url: "/media/s.webp" };
const SOLAINA = { nombre: "U.D. Santiso F.C. Solaina", escudo_url: "/media/s.webp" };

function partido(p: Partial<SelectorMatch> & { id: string }): SelectorMatch {
  return { estado: "programado", ...p };
}

const HOY = new Date(2026, 8, 24, 21, 0); // jueves 24/09/2026 por la noche

describe("elegirProximos", () => {
  it("un partido por categoría, por orden de fecha, con el Santiso en su lado", () => {
    const [primero, segundo] = elegirProximos(
      [
        partido({
          id: "sen",
          categoria: "Senior",
          fecha: "2026-09-27T17:00",
          equipo_local: { nombre: "Rival Ficticio", escudo_url: "/media/r.webp" },
          equipo_visitante: SANTISO,
          campo: { nombre: "Campo Ficticio" },
        }),
        partido({
          id: "vet",
          categoria: "Veteranos",
          fecha: "2026-09-26T18:00",
          equipo_local: SOLAINA,
          equipo_visitante: { nombre: "Veterano Ficticio" },
        }),
      ],
      HOY,
    );
    expect(primero).toMatchObject({
      categoria: "Veteranos",
      rival: "Veterano Ficticio",
      fecha: "2026-09-26",
      hora: "18:00",
      santisoSide: "left",
    });
    expect(segundo).toMatchObject({
      categoria: "Senior",
      rival: "Rival Ficticio",
      rivalEscudoUrl: "/media/r.webp",
      lugar: "Campo Ficticio",
      santisoSide: "right",
    });
  });

  it("la categoría que descansa queda sin rival y al final; no coge la semana siguiente", () => {
    const elegidos = elegirProximos(
      [
        partido({
          id: "vet",
          categoria: "Veteranos",
          fecha: "2026-09-26T18:00",
          equipo_local: SOLAINA,
          equipo_visitante: { nombre: "A" },
        }),
        partido({
          id: "sen-lejos",
          categoria: "Senior",
          fecha: "2026-10-04T17:00",
          equipo_local: SANTISO,
          equipo_visitante: { nombre: "B" },
        }),
      ],
      HOY,
    );
    expect(elegidos.map((m) => [m.categoria, m.rival])).toEqual([
      ["Veteranos", "A"],
      ["Senior", ""],
    ]);
  });

  it("ignora jugados, pasados, sin fecha y partidos ajenos", () => {
    const elegidos = elegirProximos(
      [
        partido({
          id: "jugado",
          categoria: "Senior",
          estado: "finalizado",
          fecha: "2026-09-27T17:00",
          equipo_local: SANTISO,
          equipo_visitante: { nombre: "Jugado" },
        }),
        partido({
          id: "pasado",
          categoria: "Senior",
          fecha: "2026-09-20T17:00",
          equipo_local: SANTISO,
          equipo_visitante: { nombre: "Pasado" },
        }),
        partido({ id: "sin-fecha", categoria: "Senior", equipo_local: SANTISO }),
        partido({
          id: "ajeno",
          categoria: "Senior",
          fecha: "2026-09-27T12:00",
          equipo_local: { nombre: "Otro" },
          equipo_visitante: { nombre: "Más" },
        }),
      ],
      HOY,
    );
    expect(elegidos.every((m) => m.rival === "")).toBe(true);
    expect(elegidos.map((m) => m.categoria)).toEqual(["Senior", "Veteranos"]);
  });

  it("un partido de hoy ya empezado todavía cuenta", () => {
    const [primero] = elegirProximos(
      [
        partido({
          id: "hoy",
          categoria: "Senior",
          fecha: "2026-09-24T10:00",
          equipo_local: SANTISO,
          equipo_visitante: { nombre: "Hoy" },
        }),
      ],
      HOY,
    );
    expect(primero!.rival).toBe("Hoy");
  });
});
