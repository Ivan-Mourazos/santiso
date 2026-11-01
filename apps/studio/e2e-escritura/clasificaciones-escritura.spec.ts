import { expect, test } from "@playwright/test";
test("clasificaciones históricas a 360 px: liga, copa, pendientes y categoría", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/admin/archivo?categoria=Senior");
  const seccion = page.getByRole("region", { name: "Clasificaciones", exact: true });
  await expect(seccion).toBeVisible({ timeout: 30000 });
  await expect(seccion).toContainText("2023-2024");
  await expect(seccion).toContainText(
    "6.º · 34 puntos · PJ 26 · G 10 · E 4 · P 12 · GF 31 · GC 35",
  );
  await expect(seccion).toContainText("Copa do Sar: llegó a Octavos");
  await expect(seccion).toContainText("Buscando…");
  await expect(seccion).not.toContainText("Liga Veterana Ficticia");
  await seccion.locator("summary").filter({ hasText: "TERCEIRA FICTICIA" }).click();
  const tabla = seccion.getByRole("table");
  await expect(tabla).toBeVisible();
  await expect(tabla.locator("tbody tr")).toHaveCount(12);
  await expect(tabla.locator('tr[data-propio="true"]')).toContainText("U.D. Santiso");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await seccion.locator("summary").filter({ hasText: "TERCEIRA FICTICIA" }).click();
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: testInfo.outputPath("clasificaciones-360.png"), fullPage: true });
  // El botón manual de partidos sigue en Archivo, sin pedir nada a la federación.
  await expect(
    page.getByRole("button", { name: "Traer partidos", exact: true }).first(),
  ).toBeVisible();
  await page.goto("/admin/archivo?categoria=Veteranos");
  await expect(seccion).toContainText("Liga Veterana Ficticia");
  await expect(seccion).not.toContainText("Copa do Sar");
});
