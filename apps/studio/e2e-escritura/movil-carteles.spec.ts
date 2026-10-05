import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import path from "node:path";

test.use({
  viewport: { width: 360, height: 844 },
  hasTouch: true,
  isMobile: true,
  actionTimeout: 15000,
});

async function activar(page: Page, temporada: string) {
  await page.goto("/admin/temporadas");
  const fila = page.locator("main li").filter({ hasText: temporada });
  if (await fila.getByText("Activa", { exact: true }).count()) return;
  await fila
    .getByRole("button", { name: `Usar ${temporada} como temporada activa`, exact: true })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(fila.getByText("Activa", { exact: true })).toBeVisible();
}

for (const ancho of [360, 390]) {
  test(`galería móvil: cámara, carrete, encuadre táctil guardado y foto en cartel a ${ancho}px`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: ancho, height: 844 });
    // Temporada histórica de juguete: partido propio finalizado, sin tocar datos reales.
    await activar(page, "2025/26");
    try {
      await page.goto("/admin/carteles?plantilla=resumo");
      await expect(
        page.locator('datalist#competiciones-cartel option[value="Liga Histórica"]'),
      ).toHaveCount(1);
      await page.getByLabel("Competición", { exact: true }).fill("Liga Histórica");
      const partido = page.getByLabel("Autocompletar desde la liga", { exact: true });
      await expect(partido).toBeVisible();
      const id = await partido.locator('option:not([value=""])').first().getAttribute("value");
      await partido.selectOption(id!);
      const url = `/admin/carteles?plantilla=resumo&partido=${id}`;
      await page.goto(url);
      await expect(page.getByLabel("Rival", { exact: true })).toHaveValue(/Rival .*Ficticio/i);
      await page.getByRole("tab", { name: "Vista previa", exact: true }).tap();
      await page.getByRole("button", { name: "Foto de fondo", exact: true }).tap();
      const galeria = page.getByRole("dialog", { name: "Fotos del partido", exact: true });
      await expect(galeria).toBeVisible();
      const camara = galeria.getByLabel("Tomar foto", { exact: true });
      const carrete = galeria.getByLabel("Subir fotos", { exact: true });
      await expect(camara).toHaveAttribute("capture", "environment");
      await expect(carrete).not.toHaveAttribute("capture");
      await expect(carrete).toHaveAttribute("multiple", "");
      const buffer = await sharp({
        create: {
          width: 800,
          height: 600,
          channels: 4,
          background: { r: 245, g: 197, b: 24, alpha: 1 },
        },
      })
        .png()
        .toBuffer();
      const fichero = { name: "foto-movil.png", mimeType: "image/png", buffer };
      await carrete.setInputFiles(fichero);
      await expect(galeria.getByRole("img", { name: "Foto 1", exact: true })).toBeVisible();
      await camara.setInputFiles({ ...fichero, name: "camara-movil.png" });
      await expect(galeria.getByRole("img", { name: "Foto 2", exact: true })).toBeVisible();
      for (const control of await galeria.locator("button:visible, label:visible").all()) {
        expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        ancho,
      );
      const primera = galeria.getByRole("listitem").first();
      await primera.getByRole("button", { name: "Encuadre", exact: true }).tap();
      const marcar = primera.getByRole("button", {
        name: "Marcar encuadre de foto 1",
        exact: true,
      });
      if (process.env.STUDIO_CAPTURAS_DIR)
        await page.screenshot({
          path: path.join(process.env.STUDIO_CAPTURAS_DIR, `galeria-encuadre-${ancho}.png`),
        });
      await marcar.tap({
        position: {
          x: (await marcar.boundingBox())!.width * 0.8,
          y: (await marcar.boundingBox())!.height * 0.2,
        },
      });
      await expect(primera.getByRole("button", { name: "Encuadre", exact: true })).toBeVisible();
      await page.reload();
      await expect(page.getByLabel("Rival", { exact: true })).toHaveValue(/Rival .*Ficticio/i);
      await page.getByRole("tab", { name: "Vista previa", exact: true }).tap();
      await page.getByRole("button", { name: "Foto de fondo", exact: true }).tap();
      const foco = galeria.getByRole("listitem").first().locator("[data-foco]");
      const coordenadas = await foco.evaluate((el) => ({
        x: parseFloat((el as HTMLElement).style.left),
        y: parseFloat((el as HTMLElement).style.top),
      }));
      expect(coordenadas.x).toBeCloseTo(80, 0);
      expect(coordenadas.y).toBeCloseTo(20, 0);
      await galeria.getByRole("button", { name: "Usar en el cartel", exact: true }).first().tap();
      await expect(galeria).toBeHidden();
      await expect(page.getByRole("button", { name: "Cambiar foto", exact: true })).toBeVisible();
      await expect(page.locator('[data-vista-cartel] img[src*="/media/partidos/"]')).toBeVisible();
      if (process.env.STUDIO_CAPTURAS_DIR)
        await page.screenshot({
          path: path.join(process.env.STUDIO_CAPTURAS_DIR, `resumo-foto-${ancho}.png`),
        });
      // Deja galería vacía para que ambas anchuras comprueben la misma situación.
      await page.getByRole("button", { name: "Cambiar foto", exact: true }).tap();
      await galeria.getByRole("button", { name: "Quitar foto 2", exact: true }).tap();
      await galeria.getByRole("button", { name: "Quitar foto 1", exact: true }).tap();
      await expect(galeria.getByText("Este partido todavía no tiene fotos.")).toBeVisible();
      await galeria.getByRole("button", { name: "Cerrar", exact: true }).tap();
    } finally {
      await activar(page, "2026/27");
    }
  });
}
