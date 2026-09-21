import { expect, test } from "@playwright/test";
import { vigilarSalidasAInternet } from "./red";

/**
 * Plantilla por temporada, contra la base de datos real. **Solo lectura**: abre el diálogo de
 * incorporar y lo cancela, para no meter jugadores en la temporada de verdad del usuario.
 */
test("la plantilla es por temporada y la nueva se construye desde la anterior", async ({ page }) => {
  const errores: string[] = [];
  const externas = vigilarSalidasAInternet(page);
  page.on("pageerror", (error) => errores.push(error.message));

  await page.goto("/admin/jugadores?categoria=Senior");
  const temporada = page.getByLabel("Temporada", { exact: true });
  await expect(temporada).toBeVisible({ timeout: 20000 });

  // 2025/26 conserva su plantilla, con sus dorsales.
  await temporada.selectOption({ label: "2025/26" });
  await expect(page.getByText("Lo que cambies se guarda en esa temporada")).toBeVisible();
  await expect(page.locator("table.admin-table tbody tr").first()).toBeVisible({ timeout: 20000 });
  const filasAnteriores = await page.locator("table.admin-table tbody tr").count();
  expect(filasAnteriores).toBeGreaterThan(0);

  // La activa se puede traer de la anterior.
  await temporada.selectOption({ label: "2026/27 (activa)" });
  const anadir = page.getByRole("button", { name: /Añadir de 2025\/26/ }).first();
  await expect(anadir).toBeVisible({ timeout: 20000 });
  await anadir.click();

  const dialogo = page.getByRole("dialog", { name: "Añadir de 2025/26" });
  await expect(dialogo).toBeVisible();
  const casillas = dialogo.locator('li input[type="checkbox"]');
  await expect(casillas.first()).toBeVisible();
  // Marcar uno habilita su dorsal, que viene del año pasado.
  await casillas.first().check();
  await expect(dialogo.getByRole("button", { name: "Añadir 1" })).toBeEnabled();
  await dialogo.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialogo).toBeHidden();

  // Femenino vuelve a poder consultarse en Plantilla.
  await expect(page.getByRole("button", { name: "Femenino", exact: true })).toBeVisible();

  expect(errores).toEqual([]);
  expect(externas).toEqual([]);
});
