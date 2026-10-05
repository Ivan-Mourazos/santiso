import { expect, test, type Locator, type Page } from "@playwright/test";
import sharp from "sharp";

test.use({ viewport: { width: 360, height: 844 }, hasTouch: true, isMobile: true });
let PNG: Buffer;
test.beforeAll(async () => {
  PNG = await sharp({
    create: { width: 40, height: 40, channels: 4, background: { r: 245, g: 197, b: 24, alpha: 1 } },
  })
    .png()
    .toBuffer();
});

async function abrirPasada(page: Page, seccion: string) {
  await page.goto(`/admin/${seccion}?categoria=Veteranos`);
  const temporada = page.getByLabel("Temporada", { exact: true });
  await expect(temporada).toBeVisible();
  await temporada.selectOption({ label: "2025/26" });
  await page.waitForLoadState("networkidle");
}

async function comprobarFormulario(page: Page, dialogo: Locator) {
  const rect = (await dialogo.boundingBox())!;
  expect(rect.width).toBeGreaterThanOrEqual(page.viewportSize()!.width - 24);
  expect(rect.height).toBeGreaterThanOrEqual(page.viewportSize()!.height - 24);
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.y + rect.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  for (const control of await dialogo
    .locator(
      'input:visible:not([type="checkbox"]), select:visible, textarea:visible, button:visible',
    )
    .all()) {
    const box = (await control.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
    if (await control.evaluate((el) => el.matches("input, select, textarea"))) {
      expect(
        await control.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
      ).toBeGreaterThanOrEqual(16);
    }
  }
}

test("jugador móvil conserva foto/borrador ante fallo, guarda y cancela nueva selección", async ({
  page,
}) => {
  const nombre = "Xoán Xogador de Proba Móbil con Nome Moi Longo";
  await abrirPasada(page, "jugadores");
  const fila = page.getByRole("row").filter({ has: page.getByText(nombre, { exact: true }) });
  await fila.getByRole("button", { name: /^Editar a / }).click();
  const editor = page.getByRole("dialog");
  const archivo = editor.locator('input[type="file"]');
  await expect(archivo).toHaveAttribute("accept", "image/*");
  await archivo.setInputFiles({
    name: "fotografia-con-un-nombre-muy-largo-desde-galeria-del-movil.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await comprobarFormulario(page, editor);
  await page.setViewportSize({ width: 360, height: 500 });
  await comprobarFormulario(page, editor);
  await page.route("**/admin/jugadores**", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await editor.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(editor.getByRole("alert")).toBeVisible();
  await expect(editor.getByLabel("Nombre completo")).toHaveValue(nombre);
  await expect(editor.locator("img")).toHaveAttribute("src", /^blob:/);
  await page.unroute("**/admin/jugadores**");
  await editor.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(editor).toBeHidden();
  await page.reload();
  const src = await fila.locator("img").getAttribute("src");
  expect(src).toMatch(/^\/media\//);
  await fila.getByRole("button", { name: /^Editar a / }).click();
  await archivo.setInputFiles({ name: "descartar.png", mimeType: "image/png", buffer: PNG });
  page.once("dialog", (dialogo) => dialogo.accept());
  await editor.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.reload();
  await expect(fila.locator("img")).toHaveAttribute("src", src!);
});

for (const seccion of ["tecnicos", "directiva"]) {
  test(`${seccion}: alta y edición móvil con foto y nombre largo`, async ({ page }) => {
    await abrirPasada(page, seccion);
    await page.getByRole("button", { name: "Añadir", exact: true }).click();
    const editor = page.getByRole("dialog");
    const nombre = `Persoa de Proba Móbil para ${seccion} con Nome Longo`;
    await editor.getByLabel("Nombre completo").fill(nombre);
    await editor.getByLabel("Cargo", { exact: true }).fill("Responsable de proba móbil");
    const archivo = editor.locator('input[type="file"]');
    await expect(archivo).toHaveAttribute("accept", "image/*");
    await archivo.setInputFiles({ name: `${seccion}.png`, mimeType: "image/png", buffer: PNG });
    await comprobarFormulario(page, editor);
    await editor.getByRole("button", { name: "Añadir", exact: true }).click();
    await expect(editor).toBeHidden();
    await page.reload();
    const fila = page.getByRole("row").filter({ hasText: "Responsable de proba móbil" });
    await expect(fila.locator("img")).toHaveAttribute("src", /^\/media\//);
    await fila.getByRole("button", { name: /^Editar a / }).click();
    await editor.getByLabel("Cargo", { exact: true }).fill("Responsable actualizado");
    await editor.getByRole("button", { name: "Guardar cambios", exact: true }).click();
    await expect(editor).toBeHidden();
    await page.reload();
    await expect(
      page.getByRole("row").filter({ hasText: "Responsable actualizado" }),
    ).toBeVisible();
  });
}
