import { expect, test } from "@playwright/test";

test("la clasificación se muestra calculada y sin editor", async ({ page }) => {
  const errores: string[] = [];
  page.on("pageerror", (error) => errores.push(error.message));

  await page.goto("/admin");
  await page.getByText("Clasificación", { exact: true }).first().click();

  await expect(page.getByRole("heading", { name: "Clasificación" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Guardar Clasificación/i })).toHaveCount(0);
  // El editor manual desaparece: ninguna celda de la tabla admite escritura. Se espera a la
  // tabla primero, o contar cero campos no diría nada.
  const tabla = page.getByRole("table", { name: /Clasificación/ });
  await expect(tabla).toBeVisible({ timeout: 30000 });
  await expect(tabla.locator("input")).toHaveCount(0);
  expect(errores).toEqual([]);
});

test("la clasificación trae equipos de la base de datos local", async ({ page }) => {
  await page.goto("/admin");
  await page.getByText("Clasificación", { exact: true }).first().click();

  const filas = page.getByRole("table", { name: /Clasificación/ }).locator("tbody tr");
  await expect(filas.first()).toBeVisible();
  expect(await filas.count()).toBeGreaterThan(0);
});

test("la pestaña de temporadas lista la temporada activa", async ({ page }) => {
  await page.goto("/admin");
  await page.getByRole("link", { name: "Temporadas", exact: true }).click();
  await expect(page.getByText("Activa").first()).toBeVisible();
});
