import { expect, test } from "@playwright/test";
import { vigilarSalidasAInternet } from "./red";

/**
 * Estadísticas contra la base de datos real. **Solo lectura**. La base real solo guarda la
 * temporada activa, que puede no tener actas todavía: aquí se comprueba que la pantalla carga y
 * cabe. Totales, orden y filtros con datos conocidos: `e2e-escritura/historial-escritura.spec.ts`.
 */
test("abre con la temporada activa sin errores ni salidas a internet", async ({ page }) => {
  const errores: string[] = [];
  const externas = vigilarSalidasAInternet(page);
  page.on("pageerror", (error) => errores.push(error.message));

  await page.goto("/admin/estadisticas?categoria=Senior");
  await expect(page.getByRole("heading", { name: "Estadísticas de Senior" })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByLabel("Temporada", { exact: true })).toBeVisible();

  expect(errores).toEqual([]);
  expect(externas).toEqual([]);
});

test("la categoría de la cabecera cambia los datos", async ({ page }) => {
  await page.goto("/admin/estadisticas?categoria=Senior");
  await expect(page.getByRole("heading", { name: "Estadísticas de Senior" })).toBeVisible({
    timeout: 30000,
  });
  await page.getByRole("button", { name: "Veteranos", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Estadísticas de Veteranos" })).toBeVisible({
    timeout: 30000,
  });
});

for (const ancho of [360, 1280]) {
  test(`la pantalla de estadísticas cabe a ${ancho}px`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 900 });
    await page.goto("/admin/estadisticas?categoria=Senior");
    await expect(page.getByRole("heading", { name: "Estadísticas de Senior" })).toBeVisible({
      timeout: 30000,
    });
    const desborda = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(desborda).toBe(false);
  });
}
