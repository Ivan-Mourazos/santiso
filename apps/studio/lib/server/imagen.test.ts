import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { guardarImagenOpcional } from "./imagen";

const raizTemporal = () => mkdtempSync(path.join(tmpdir(), "santiso-imagen-"));

const pngRojo = () =>
  sharp({
    create: { width: 40, height: 40, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
  })
    .png()
    .toBuffer();

const formularioCon = (valor: File | string | null) => {
  const formulario = new FormData();
  if (valor !== null) formulario.set("imagen", valor);
  return formulario;
};

describe("guardarImagenOpcional", () => {
  it("sin campo devuelve null: la imagen existente no se toca", async () => {
    expect(await guardarImagenOpcional(formularioCon(null), "imagen", "escudos")).toEqual({
      ok: true,
      datos: null,
    });
  });

  it("con un fichero vacío devuelve null", async () => {
    const vacio = new File([], "a.png", { type: "image/png" });
    expect(await guardarImagenOpcional(formularioCon(vacio), "imagen", "escudos")).toEqual({
      ok: true,
      datos: null,
    });
  });

  it("guarda la imagen y devuelve su clave relativa", async () => {
    const raiz = raizTemporal();
    const fichero = new File([await pngRojo()], "a.png", { type: "image/png" });
    const resultado = await guardarImagenOpcional(
      formularioCon(fichero),
      "imagen",
      "escudos",
      raiz,
    );

    expect(resultado.ok).toBe(true);
    if (!resultado.ok || !resultado.datos) throw new Error("sin clave");
    expect(resultado.datos).toMatch(/^escudos\/[0-9a-f-]{36}\.webp$/);
    const meta = await sharp(readFileSync(path.join(raiz, resultado.datos))).metadata();
    expect(meta.format).toBe("webp");
  });

  it("rechaza un fichero que no es imagen", async () => {
    const pdf = new File(["x"], "a.pdf", { type: "application/pdf" });
    expect(await guardarImagenOpcional(formularioCon(pdf), "imagen", "escudos")).toMatchObject({
      ok: false,
      error: "El fichero debe ser una imagen.",
    });
  });

  it("convierte en fallo unos bytes que dicen ser imagen pero no lo son", async () => {
    const registro = vi.spyOn(console, "error").mockImplementation(() => {});
    const falsa = new File([new TextEncoder().encode("no soy una imagen")], "a.png", {
      type: "image/png",
    });
    expect(
      await guardarImagenOpcional(formularioCon(falsa), "imagen", "escudos", raizTemporal()),
    ).toMatchObject({ ok: false });
    expect(registro).toHaveBeenCalledOnce();
    registro.mockRestore();
  });
});
