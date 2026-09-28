import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { aHex, colorDominante, oscurecer } from "./color";
import { categoriaCartel, datosDeFormulario, fechaCartel } from "./modelo";

/** Píxeles RGBA de una imagen hecha con franjas de colores, como un escudo simplificado. */
async function pixeles(franjas: { color: string; alto: number }[], ancho = 40) {
  const alto = franjas.reduce((s, f) => s + f.alto, 0);
  let y = 0;
  const capas = [];
  for (const f of franjas) {
    capas.push({
      input: await sharp({
        create: { width: ancho, height: f.alto, channels: 4, background: f.color },
      })
        .png()
        .toBuffer(),
      top: y,
      left: 0,
    });
    y += f.alto;
  }
  return sharp({
    create: { width: ancho, height: alto, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(capas)
    .raw()
    .toBuffer();
}

describe("colorDominante", () => {
  it("se queda con el color del club, no con el blanco del fondo ni el negro del contorno", async () => {
    const rgba = await pixeles([
      { color: "#ffffff", alto: 40 },
      { color: "#000000", alto: 10 },
      { color: "#1e88e5", alto: 20 },
      { color: "#d32f2f", alto: 8 },
    ]);
    const color = colorDominante(rgba);
    expect(color && aHex(color)).toBe("#1e88e5");
  });

  it("ignora lo transparente y los grises; sin color, null", async () => {
    const rgba = await pixeles([
      { color: "#00000000", alto: 30 },
      { color: "#808080", alto: 30 },
      { color: "#ffffff", alto: 10 },
    ]);
    expect(colorDominante(rgba)).toBeNull();
  });

  it("oscurecer mezcla con negro", () => {
    expect(oscurecer({ r: 200, g: 100, b: 50 }, 0.5)).toEqual({ r: 100, g: 50, b: 25 });
  });
});

describe("modelo del cartel", () => {
  it("fecha en gallego, sin depender de la zona horaria", () => {
    expect(fechaCartel("2026-09-27")).toEqual({ dia: "DOMINGO", numero: "27", mes: "SET" });
    expect(fechaCartel("2026-10-03")).toEqual({ dia: "SÁBADO", numero: "3", mes: "OUT" });
    expect(fechaCartel("")).toBeNull();
  });

  it("categoría en gallego", () => {
    expect(categoriaCartel("Senior")).toBe("SÉNIOR");
    expect(categoriaCartel("Veteranos")).toBe("VETERANOS");
  });

  it("el formulario pone al Santiso de local o visitante según el lado", () => {
    const base = {
      categoria: "Senior",
      competicion: "Tercera Futgal - Grupo 3",
      jornada: "2",
      rivalNombre: "C.D. Berres",
      rivalEscudoUrl: "/media/escudos/b.webp",
      fecha: "2026-10-04",
      hora: "17:00",
      lugar: "Pardiñeiro",
    };
    const recursos = {
      escudoClub: "/media/club.webp",
      nombreClub: "UD Santiso FC",
      patrocinadores: [],
      institucionales: [],
    };
    const colores = { club: "#1f7a3a", rival: "#d32f2f" };
    const fuera = datosDeFormulario({ ...base, santisoSide: "right" }, recursos, colores);
    expect(fuera.local).toMatchObject({ nombre: "C.D. Berres", propio: false, color: "#d32f2f" });
    expect(fuera.visitante).toMatchObject({ nombre: "UD Santiso FC", propio: true });
    const casa = datosDeFormulario({ ...base, santisoSide: "left" }, recursos, colores);
    expect(casa.local.propio).toBe(true);
    expect(
      datosDeFormulario({ ...base, rivalNombre: " ", santisoSide: "left" }, recursos, colores)
        .visitante.nombre,
    ).toBe("Rival");
  });
});
