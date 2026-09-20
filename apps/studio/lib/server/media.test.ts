import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { guardarImagen, leerImagenDeFormulario, resolverRutaMedia, tipoMedia } from "./media";

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

  it("reduce a un máximo de 1200 px y no amplía las pequeñas", async () => {
    const raiz = raizTemporal();
    const grande = await sharp({
      create: { width: 3000, height: 1000, channels: 3, background: { r: 0, g: 80, b: 160 } },
    })
      .jpeg()
      .toBuffer();
    const clave = await guardarImagen(grande, "jugadores", raiz);
    const meta = await sharp(readFileSync(path.join(raiz, clave))).metadata();
    expect([meta.width, meta.height]).toEqual([1200, 1200]);
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
