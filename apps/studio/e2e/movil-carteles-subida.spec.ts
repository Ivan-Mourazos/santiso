import { expect, test } from "@playwright/test";
import sharp from "sharp";

/**
 * Subir una foto propia desde el móvil: una grande (como las de la cámara) se reduce sola, se
 * ve de fondo, se puede encuadrar y viaja en la exportación. Nada se guarda: la exportación se
 * responde aquí.
 */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function fotoGrande() {
  // 4000 × 3000 con ruido: varios MB, como una foto de móvil.
  const ruido = Buffer.alloc(4000 * 3000 * 3);
  for (let i = 0; i < ruido.length; i += 997) ruido[i] = (i * 31) % 255;
  return sharp(ruido, { raw: { width: 4000, height: 3000, channels: 3 } })
    .jpeg({ quality: 95 })
    .toBuffer();
}

for (const plantilla of ["cronoloxia", "resumo"]) {
  test(`carteles: foto propia de fondo en ${plantilla}, reducida y encuadrable`, async ({ page }) => {
    const peticiones: { datos: { foto?: { url: string; zoom?: number } | null } }[] = [];
    await page.route("**/api/carteles/png", async (ruta) => {
      peticiones.push(ruta.request().postDataJSON());
      await ruta.fulfill({ status: 200, contentType: "image/png", body: PNG });
    });
    await page.goto(`/admin/carteles?plantilla=${plantilla}`);
    await page.getByRole("tab", { name: "Vista previa" }).tap();
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

    await expect.poll(() => peticiones.length, { timeout: 15000 }).toBeGreaterThan(0);
    const ultima = peticiones.at(-1)!.datos.foto!;
    expect(ultima.url.startsWith("data:image/jpeg")).toBe(true);
    expect(ultima.url.length).toBeLessThan(6_000_000);
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(ancho).toBeLessThanOrEqual(page.viewportSize()!.width);
  });
}

test("carteles: foto propia de jugador en O noso 11", async ({ page }) => {
  await page.route("**/api/carteles/png", (ruta) =>
    ruta.fulfill({ status: 200, contentType: "image/png", body: PNG }),
  );
  await page.goto("/admin/carteles?plantilla=noso11");
  await page.locator("summary", { hasText: "Foto y encuadre" }).tap();
  await page.getByLabel("Uso de la foto").selectOption("retrato");
  await page
    .locator("label", { hasText: "Subir foto del jugador" })
    .locator("input")
    .setInputFiles({ name: "jugador.jpg", mimeType: "image/jpeg", buffer: await fotoGrande() });
  await page.getByRole("tab", { name: "Vista previa" }).tap();
  const retrato = page.locator("[data-vista-cartel] img[src^='data:image/jpeg']");
  await expect(retrato).toBeVisible();
  expect(await retrato.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(2160);
});
