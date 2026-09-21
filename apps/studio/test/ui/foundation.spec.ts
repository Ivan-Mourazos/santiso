import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
});
test("etiquetas, errores y botón pendiente", async ({ page }) => {
  await expect(page.getByLabel("Nombre del equipo", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByLabel("Nombre del equipo", { exact: true })).toHaveAccessibleDescription(
    "Escribe el nombre que aparece en el calendario. Falta el nombre.",
  );
  await page.getByLabel("Temporada", { exact: true }).selectOption("2026/27");
  await page.getByLabel("Notas", { exact: true }).fill("Partido aplazado");
  await expect(page.getByRole("button", { name: "Guardando…" })).toBeDisabled();
  await expect(page.getByRole("table", { name: "Clasificación de ejemplo" })).toBeVisible();
});
for (const width of [360, 390, 1280])
  test(`galería sin desbordamiento a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: test.info().outputPath(`galeria-${width}.png`), fullPage: true });
  });
test("respeta movimiento reducido", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByRole("status").filter({ hasText: "Cargando plantilla" })).toBeVisible();
  const duration = await page
    .getByRole("button", { name: "Abrir diálogo", exact: true })
    .evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(duration).toMatch(/^0s|0.001s$/);
});
