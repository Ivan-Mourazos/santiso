import { expect, test } from "@playwright/test";
import { vigilarSalidasAInternet } from "./red";

/**
 * Clasificación contra la base de datos real. **Solo lectura**: se cambia de competición y de
 * categoría, que viven en la URL; nada se guarda.
 */
test("la clasificación trae la tabla de la competición elegida", async ({ page }) => {
  const errores: string[] = [];
  const externas = vigilarSalidasAInternet(page);
  page.on("pageerror", (error) => errores.push(error.message));

  await page.goto("/admin/clasificacion?categoria=Senior");
  const competicion = page.getByLabel("Competición", { exact: true });
  await expect(competicion).toBeVisible({ timeout: 30000 });

  const tabla = page.getByRole("table", { name: /Clasificación/ });
  await expect(tabla).toBeVisible({ timeout: 30000 });
  for (const columna of ["Puntos", "Partidos jugados", "Diferencia de goles"]) {
    await expect(tabla.getByRole("columnheader", { name: columna })).toBeVisible();
  }
  expect(await tabla.locator("tbody tr").count()).toBeGreaterThan(1);

  expect(errores).toEqual([]);
  expect(externas).toEqual([]);
});

for (const ancho of [360, 1280]) {
  test(`la clasificación cabe a ${ancho}px`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 900 });
    await page.goto("/admin/clasificacion?categoria=Senior");
    await expect(page.getByRole("table", { name: /Clasificación/ })).toBeVisible({
      timeout: 30000,
    });
    const desborda = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(desborda).toBe(false);
  });
}
