import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("./");
});

test("diálogo contiene foco y lo devuelve al cerrar con Escape", async ({ page }) => {
  const opener = page.getByRole("button", { name: "Abrir diálogo", exact: true });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Editar partido", exact: true });
  await expect(dialog).toBeVisible();
  const heading = dialog.getByRole("heading", { name: "Editar partido", exact: true });
  await expect(dialog.getByLabel("Campo", { exact: true })).toBeFocused();
  await heading.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.locator("button:visible:enabled, input:visible:enabled").last(),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Cerrar diálogo", exact: true })).toBeFocused();
  await dialog.getByLabel("Campo", { exact: true }).fill("Municipal");
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Shift+Tab");
    await expect
      .poll(() => dialog.evaluate((node) => node.contains(document.activeElement)))
      .toBe(true);
  }
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    await expect
      .poll(() => dialog.evaluate((node) => node.contains(document.activeElement)))
      .toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
  await opener.click();
  await dialog.getByRole("button", { name: "Cerrar diálogo", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
});

test("confirmación enfoca cancelar y cierra sin confirmar", async ({ page }) => {
  const opener = page.getByRole("button", { name: "Abrir confirmación", exact: true });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Eliminar equipo", exact: true });
  await expect(dialog.getByRole("button", { name: "Cancelar", exact: true })).toBeFocused();
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
});

test("pestañas recorren extremos, omiten deshabilitadas y etiquetan paneles", async ({ page }) => {
  const list = page.getByRole("tablist", { name: "Categoría", exact: true });
  const senior = list.getByRole("tab", { name: "Senior", exact: true });
  const veterans = list.getByRole("tab", { name: "Veteranos", exact: true });
  await expect(list.getByRole("tab", { name: "Directiva", exact: true })).toBeDisabled();
  await senior.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(veterans).toBeFocused();
  await expect(veterans).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "Veteranos", exact: true })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(senior).toBeFocused();
  await page.keyboard.press("End");
  await expect(veterans).toBeFocused();
  await page.keyboard.press("Home");
  await expect(senior).toBeFocused();
});

test("aviso conserva región viva antes y después del cierre", async ({ page }) => {
  const region = page.getByRole("region", { name: "Avisos", exact: true }).getByRole("status");
  await expect(region).toHaveCount(1);
  await expect(region).toBeEmpty();
  await page.getByRole("button", { name: "Mostrar aviso", exact: true }).click();
  await expect(region).toContainText("Cambios guardados");
  await page.getByRole("button", { name: "Cerrar aviso", exact: true }).click();
  await expect(region).toHaveCount(1);
  await expect(region).toBeEmpty();
});

test("confirmación pendiente impide repetir y cerrar", async ({ page }) => {
  await page.getByRole("button", { name: "Abrir confirmación", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Eliminar equipo", exact: true });
  const confirm = dialog.getByRole("button", { name: "Eliminar", exact: true });
  await confirm.click();
  await expect(confirm).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Cancelar", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Cerrar diálogo", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel("Confirmaciones", { exact: true })).toHaveText("1");
});

for (const width of [360, 390]) {
  test("diálogo cabe en móvil de " + width + " px y devuelve foco", async ({ page }) => {
    await page.setViewportSize({ width, height: 780 });
    const opener = page.getByRole("button", { name: "Abrir diálogo", exact: true });
    await opener.click();
    const dialog = page.getByRole("dialog", { name: "Editar partido", exact: true });
    await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await dialog.getByRole("button", { name: "Cerrar diálogo", exact: true }).click();
    await expect(opener).toBeFocused();
  });
}

test("diálogo conserva Tab entre segmentos nativos de fecha", async ({ page }) => {
  await page.getByRole("button", { name: "Abrir diálogo", exact: true }).click();
  const date = page.getByLabel("Fecha del partido", { exact: true });
  await date.focus();
  await page.keyboard.press("Tab");
  await expect(date).toBeFocused();
});
