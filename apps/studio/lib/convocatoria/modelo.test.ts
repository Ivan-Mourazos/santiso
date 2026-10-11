import { describe, expect, it } from "vitest";
import {
  convocatoriaInicial,
  errorDeConvocatoria,
  peticionDeConvocatoria,
  textoWhatsApp,
} from "./modelo";
import { leerPeticion } from "@/lib/cartel2/esquema";
import { medidasDe } from "@/lib/cartel2/modelo";
import type { JugadorAlineacion, PartidoAlineacion } from "@/lib/alineacion/modelo";

describe("convocatoria", () => {
  it("marca todos por defecto y exige al menos uno, con quedada opcional", () => {
    const c = convocatoriaInicial(["a", "b"]);
    expect(c.jugadores).toEqual(["a", "b"]);
    expect(errorDeConvocatoria(c)).toBeNull();
    expect(errorDeConvocatoria({ ...c, jugadores: [] })).toContain("al menos");
    expect(errorDeConvocatoria({ ...c, jugadores: ["a", "a"] })).toContain("repetido");
    expect(errorDeConvocatoria({ ...c, horaQuedada: "25:00" })).toContain("hora");
  });

  const partido: PartidoAlineacion = {
    id: "p",
    competicion: "Liga",
    jornada: 5,
    fecha: "2026-10-18T17:00",
    campo: "Campo Santiso",
    santisoLocal: false,
    finalizado: false,
    santiso: { nombre: "Santiso", escudoUrl: "/media/club.webp", escudo3d: true },
    rival: { nombre: "Rival", escudoUrl: "/media/rival.webp", escudo3d: false, color: null },
  };
  const jugadores: JugadorAlineacion[] = Array.from({ length: 22 }, (_, i) => ({
    id: String(i),
    nombre: `Xogador ${i + 1}`,
    apodo: i === 0 ? "Brais" : null,
    dorsal: 22 - i,
    fotoUrl: null,
    capitan: false,
  }));
  it("texto WhatsApp incluye solo convocados, por dorsal, con apodo y quedada", () => {
    const c = {
      ...convocatoriaInicial(["0", "1"]),
      horaQuedada: "16:00",
      lugarQuedada: "Entrada",
      equipacion: "Amarela",
      nota: "Puntualidade",
    };
    const texto = textoWhatsApp(partido, jugadores, c);
    expect(texto).toContain("Rival – Santiso");
    expect(texto).toContain("DOMINGO 18 OUT · 17:00");
    expect(texto).toContain("Quedada: 16:00 · Entrada");
    expect(texto).toContain("Equipación: Amarela");
    expect(texto).toContain("Puntualidade");
    expect(texto).toContain("22 · Brais");
    expect(texto.indexOf("21 · Xogador 2")).toBeLessThan(texto.indexOf("22 · Brais"));
    expect(texto).not.toContain("Xogador 3");
    const sinFecha = textoWhatsApp(
      { ...partido, fecha: null, campo: null },
      jugadores,
      convocatoriaInicial(["0"]),
    );
    expect(sinFecha).not.toContain("undefined");
    expect(sinFecha).not.toContain("Quedada:");
  });
  it.each([11, 22])("cartel de %i nombres válido, 4:5 y sin colarse en alineación", (cantidad) => {
    const c = convocatoriaInicial(jugadores.slice(0, cantidad).map((j) => j.id));
    const peticion = peticionDeConvocatoria("Senior", partido, jugadores, c, {
      institucionales: [],
      patrocinadores: [],
      colorRival: "#abcdef",
    });
    expect(leerPeticion(peticion)).toEqual(peticion);
    expect(medidasDe(peticion.plantilla)).toEqual({ ancho: 1080, alto: 1350 });
    if (peticion.plantilla !== "convocatoria") throw new Error("plantilla");
    expect(peticion.datos.convocados).toHaveLength(cantidad);
    expect(peticion.datos.rival.color).toBe("#abcdef");
    expect(peticion.datos.local).toBe(false);
    expect(leerPeticion({ ...peticion, datos: { ...peticion.datos, convocados: [] } })).toBeNull();
  });
});
