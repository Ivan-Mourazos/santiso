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

test("la temporada pasada trae su clasificación final, ordenada por puntos", async ({ page }) => {
  await page.goto("/admin/clasificacion?categoria=Senior");
  const temporada = page.getByLabel("Temporada", { exact: true });
  await expect(temporada).toBeVisible({ timeout: 30000 });
  await temporada.selectOption({ label: "2025/26" });
  await expect(page).toHaveURL(/temporada=/);

  const tabla = page.getByRole("table", { name: /Clasificación/ });
  await expect(tabla).toBeVisible({ timeout: 30000 });
  // 2025/26 está jugada: el líder tiene puntos, o la comprobación de orden no diría nada. La
  // aserción reintenta: justo después de cambiar, aún puede verse la tabla de la activa.
  await expect(tabla.locator("tbody tr").first().locator("td:nth-child(4)")).not.toHaveText("0", {
    timeout: 30000,
  });
  const filas = tabla.locator("tbody tr");
  const n = await filas.count();
  const posiciones = await filas.locator("td:nth-child(1)").allTextContents();
  expect(posiciones.map(Number)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
  const puntos = (await filas.locator("td:nth-child(4)").allTextContents()).map(Number);
  expect(puntos).toEqual([...puntos].sort((a, b) => b - a));
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
