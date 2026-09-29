import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  anchoDeVariante,
  focoDeFoto,
  guardarFotoPartido,
  guardarImagen,
  leerImagenDeFormulario,
  resolverRutaMedia,
  tipoMedia,
  varianteDeImagen,
} from "./media";

const raizTemporal = () => mkdtempSync(path.join(tmpdir(), "santiso-media-"));

/** Imagen transparente de 200x100 con un rectángulo rojo opaco de 50x20 en (100, 40). */
const logoConTransparencia = () =>
  sharp({
    create: { width: 200, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      {
        input: {
          create: {
            width: 50,
            height: 20,
            channels: 4,
            background: { r: 255, g: 0, b: 0, alpha: 1 },
          },
        },
        left: 100,
        top: 40,
      },
    ])
    .png()
    .toBuffer();

describe("resolverRutaMedia", () => {
  const raiz = path.resolve(tmpdir(), "raiz-media");

  it("resuelve una clave válida dentro de la raíz", () => {
    expect(resolverRutaMedia(["escudos", "a.webp"], raiz)).toBe(
      path.join(raiz, "escudos", "a.webp"),
    );
  });

  it.each([
    [[]],
    [[""]],
    [["."]],
    [[".."]],
    [["escudos", "..", "..", "secreto"]],
    [["a\\..\\b.webp"]],
    [["a/b.webp"]],
    [["C:", "Windows"]],
    [["a\0.webp"]],
  ])("rechaza %j", (segmentos) => {
    expect(resolverRutaMedia(segmentos, raiz)).toBeNull();
  });
});

describe("tipoMedia", () => {
  it("reconoce las extensiones de imagen admitidas sin distinguir mayúsculas", () => {
    expect(tipoMedia("a/b.webp")).toBe("image/webp");
    expect(tipoMedia("a/b.PNG")).toBe("image/png");
    expect(tipoMedia("a/b.jpeg")).toBe("image/jpeg");
  });

  it("no sirve otros tipos", () => {
    expect(tipoMedia("a/b.svg")).toBeNull();
    expect(tipoMedia("a/b.html")).toBeNull();
    expect(tipoMedia("a/sin-extension")).toBeNull();
  });
});

describe("guardarImagen", () => {
  it("recorta la transparencia, centra en un cuadrado con 5 % de margen y guarda WebP", async () => {
    const raiz = raizTemporal();
    const clave = await guardarImagen(await logoConTransparencia(), "escudos", raiz);

    expect(clave).toMatch(/^escudos\/[0-9a-f-]{36}\.webp$/);
    const guardada = readFileSync(path.join(raiz, clave));
    const meta = await sharp(guardada).metadata();
    // Recorte 50x20; margen floor(50 * 0.05) = 2; lado 50 + 2 * 2 = 54.
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 54, 54]);

    const { data, info } = await sharp(guardada)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) =>
      Array.from(data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4));
    expect(pixel(0, 0)[3]).toBe(0);
    const [rojo = 0, verde = 255, , alfa = 0] = pixel(27, 27);
    expect(rojo).toBeGreaterThan(200);
    expect(verde).toBeLessThan(60);
    expect(alfa).toBe(255);
  });

  it("reduce a 1200 px escudos y logos, y a 2400 px las fotos de personas", async () => {
    const raiz = raizTemporal();
    const grande = await sharp({
      create: { width: 3000, height: 1000, channels: 3, background: { r: 0, g: 80, b: 160 } },
    })
      .jpeg()
      .toBuffer();
    const lado = async (carpeta: "escudos" | "jugadores" | "staff") => {
      const clave = await guardarImagen(grande, carpeta, raiz);
      const meta = await sharp(readFileSync(path.join(raiz, clave))).metadata();
      return [meta.width, meta.height];
    };
    expect(await lado("escudos")).toEqual([1200, 1200]);
    expect(await lado("jugadores")).toEqual([2400, 2400]);
    expect(await lado("staff")).toEqual([2400, 2400]);
  });

  it("no amplía las imágenes pequeñas", async () => {
    const raiz = raizTemporal();
    const pequena = await sharp({
      create: { width: 300, height: 300, channels: 3, background: { r: 0, g: 80, b: 160 } },
    })
      .png()
      .toBuffer();
    const clave = await guardarImagen(pequena, "jugadores", raiz);
    const meta = await sharp(readFileSync(path.join(raiz, clave))).metadata();
    expect(meta.width).toBeLessThanOrEqual(330);
  });

  it("rechaza bytes que no son una imagen", async () => {
    await expect(
      guardarImagen(new TextEncoder().encode("hola"), "staff", raizTemporal()),
    ).rejects.toThrow();
  });
});

describe("leerImagenDeFormulario", () => {
  const formularioCon = (valor: File | string) => {
    const formulario = new FormData();
    formulario.set("imagen", valor);
    return formulario;
  };

  it("devuelve los bytes de una imagen válida", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const resultado = await leerImagenDeFormulario(
      formularioCon(new File([bytes], "a.png", { type: "image/png" })),
      "imagen",
    );
    expect(resultado).toEqual({ ok: true, datos: bytes });
  });

  it("rechaza campos vacíos, ficheros que no son imagen y los mayores de 15 MB", async () => {
    await expect(leerImagenDeFormulario(new FormData(), "imagen")).resolves.toMatchObject({
      ok: false,
    });
    await expect(leerImagenDeFormulario(formularioCon("texto"), "imagen")).resolves.toMatchObject({
      ok: false,
    });
    await expect(
      leerImagenDeFormulario(
        formularioCon(new File(["x"], "a.pdf", { type: "application/pdf" })),
        "imagen",
      ),
    ).resolves.toMatchObject({ ok: false, error: "El fichero debe ser una imagen." });
    const enorme = new File([new Uint8Array(15 * 1024 * 1024 + 1)], "a.png", { type: "image/png" });
    await expect(leerImagenDeFormulario(formularioCon(enorme), "imagen")).resolves.toMatchObject({
      ok: false,
      error: "La imagen supera los 15 MB.",
    });
  });
});

/** Foto de prueba: fondo gris liso y un «jugador» (bloque con detalle y color) en `x`, `y`. */
async function fotoCon(ancho: number, alto: number, x: number, y: number) {
  const lado = Math.round(Math.min(ancho, alto) / 3);
  const detalle = await sharp({
    create: { width: lado, height: lado, channels: 3, background: { r: 230, g: 40, b: 30 } },
  })
    .composite([
      {
        input: await sharp({
          create: {
            width: Math.round(lado / 2),
            height: Math.round(lado / 2),
            channels: 3,
            background: { r: 250, g: 210, b: 30 },
          },
        })
          .png()
          .toBuffer(),
        left: Math.round(lado / 4),
        top: Math.round(lado / 4),
      },
    ])
    .png()
    .toBuffer();
  return await sharp({
    create: { width: ancho, height: alto, channels: 3, background: { r: 120, g: 120, b: 120 } },
  })
    .composite([{ input: detalle, left: Math.round(x - lado / 2), top: Math.round(y - lado / 2) }])
    .jpeg()
    .toBuffer();
}

describe("fotos de partido", () => {
  it("el foco sigue al motivo: en horizontal, en el eje X", async () => {
    const derecha = await focoDeFoto(await fotoCon(1600, 900, 1250, 450));
    expect(derecha.focoX).toBeGreaterThan(0.6);
    expect(derecha.focoY).toBe(0.5);
    const izquierda = await focoDeFoto(await fotoCon(1600, 900, 350, 450));
    expect(izquierda.focoX).toBeLessThan(0.4);
  });

  it("en vertical alargada, en el eje Y", async () => {
    const abajo = await focoDeFoto(await fotoCon(800, 1800, 400, 1450));
    expect(abajo.focoX).toBe(0.5);
    expect(abajo.focoY).toBeGreaterThan(0.6);
  });

  it("si ya es 4:5 no hay recorte: foco por defecto", async () => {
    expect(await focoDeFoto(await fotoCon(800, 1000, 700, 900))).toEqual({
      focoX: 0.5,
      focoY: 0.4,
    });
  });

  it("guarda la foto entera, sin margen, a 3000 px como mucho", async () => {
    const raiz = raizTemporal();
    const foto = await guardarFotoPartido(await fotoCon(4000, 2250, 3000, 1100), raiz);
    expect(foto.clave).toMatch(/^partidos\/[0-9a-f-]{36}\.webp$/);
    expect([foto.ancho, foto.alto]).toEqual([3000, 1688]);
    const meta = await sharp(readFileSync(path.join(raiz, foto.clave))).metadata();
    expect([meta.width, meta.height, meta.format]).toEqual([3000, 1688, "webp"]);
    expect(foto.focoX).toBeGreaterThan(0.6);
  });

  it("las variantes usan anchos fijos y no amplían", async () => {
    expect(anchoDeVariante(100)).toBe(480);
    expect(anchoDeVariante(1080)).toBe(1080);
    expect(anchoDeVariante(1500)).toBe(2160);
    expect(anchoDeVariante(9000)).toBe(2160);
    const foto = await fotoCon(3000, 2000, 1500, 1000);
    expect((await sharp(await varianteDeImagen(foto, 1080)).metadata()).width).toBe(1080);
    const pequena = await fotoCon(600, 400, 300, 200);
    expect((await sharp(await varianteDeImagen(pequena, 2160)).metadata()).width).toBe(600);
  });
});
