import { expect, test } from "@playwright/test";

test("la clasificación se muestra calculada y sin editor", async ({ page }) => {
  const errores: string[] = [];
  page.on("pageerror", (error) => errores.push(error.message));

  await page.goto("/admin");
  await page.getByText("Ligas", { exact: true }).first().click();

  await expect(page.getByRole("heading", { name: "Clasificación" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Guardar Clasificación/i })).toHaveCount(0);
  // El editor manual desaparece: ninguna celda de la tabla admite escritura.
  await expect(page.locator("table.league-editor input")).toHaveCount(0);
  expect(errores).toEqual([]);
});

test("la clasificación trae equipos de la base de datos local", async ({ page }) => {
  await page.goto("/admin");
  await page.getByText("Ligas", { exact: true }).first().click();

  const filas = page.locator("table.league-editor tbody tr");
  await expect(filas.first()).toBeVisible();
  expect(await filas.count()).toBeGreaterThan(0);
});

test("la pestaña de temporadas lista la temporada activa", async ({ page }) => {
  await page.goto("/admin");
  await page.getByText("Temporadas", { exact: true }).first().click();
  await expect(page.getByText("(ACTIVA)").first()).toBeVisible();
});
