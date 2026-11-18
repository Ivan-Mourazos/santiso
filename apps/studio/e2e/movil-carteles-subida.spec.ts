import { expect, test } from "@playwright/test";
import sharp from "sharp";

/**
 * Subir una foto propia desde el móvil: una grande (como las de la cámara) se reduce sola, se
 * ve de fondo, se puede encuadrar y viaja en la exportación. Nada se guarda: la petición de guardar
 * se responde aquí.
 */
async function fotoGrande() {
  // 4000 × 3000 con ruido: varios MB, como una foto de móvil.
  const ruido = Buffer.alloc(4000 * 3000 * 3);
  for (let i = 0; i < ruido.length; i += 997) ruido[i] = (i * 31) % 255;
  return sharp(ruido, { raw: { width: 4000, height: 3000, channels: 3 } })
    .jpeg({ quality: 95 })
    .toBuffer();
}

// Resultado y Cronoloxía sueltos se retiraron el 18/11/2026: la foto de fondo queda en el cartel
// de partido. Con el próximo partido elegido, ese cartel se guarda en el partido en vez de
// prepararse solo: la petición de guardar se intercepta y nunca llega al servidor.
test("carteles: foto propia de fondo en partido, reducida y encuadrable", async ({ page }) => {
    const peticiones: { datos: { foto?: { url: string; zoom?: number } | null } }[] = [];
    await page.route("**/api/carteles/guardar", async (ruta) => {
      peticiones.push(...ruta.request().postDataJSON().peticiones);
      await ruta.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({ error: "Prueba: no se guarda." }),
      });
    });
    await page.goto("/admin/carteles?plantilla=partido");
    await page.locator("[data-vista-cartel]").scrollIntoViewIfNeeded();
    await page
      .locator("label", { hasText: "Subir foto de fondo" })
      .locator("input")
      .setInputFiles({ name: "campo.jpg", mimeType: "image/jpeg", buffer: await fotoGrande() });
    const fondo = page.locator("[data-vista-cartel] [data-foto-fondo] img");
    await expect(fondo).toBeVisible();
    const medidas = await fondo.evaluate((img: HTMLImageElement) => [
      img.naturalWidth,
      img.naturalHeight,
    ]);
    expect(medidas).toEqual([2160, 1620]);

    await page.locator("summary", { hasText: "Ajustar la foto" }).tap();
    await page.getByLabel("Acercar").fill("2");
    await expect(fondo).toHaveCSS("transform", /matrix\(2, 0, 0, 2/);

    await page
      .getByRole("button", { name: /^(Generar cartel|Actualizar cartel|Volver a generar)$/ })
      .tap();
    await expect.poll(() => peticiones.length, { timeout: 30000 }).toBeGreaterThan(0);
    const ultima = peticiones.at(-1)!.datos.foto!;
    expect(ultima.url.startsWith("data:image/jpeg")).toBe(true);
    expect(ultima.url.length).toBeLessThan(6_000_000);
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(ancho).toBeLessThanOrEqual(page.viewportSize()!.width);
});

// O Noso 11 es ahora el campo con las camisetas del club: va sin fotos (15/11/2026).
