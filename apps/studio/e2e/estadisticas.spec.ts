import { expect, test } from "@playwright/test";
import { vigilarSalidasAInternet } from "./red";

test("la ficha de consulta cierra desde fuera y devuelve el foco", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/admin/estadisticas?categoria=Senior");
  await expect(page.getByRole("heading", { name: "Estadísticas de Senior" })).toBeVisible();
  const jugador = page.getByRole("button", { name: /^Ver ficha de / }).first();
  test.skip((await jugador.count()) === 0, "Sin filas de estadísticas");
  const ficha = page.getByRole("dialog");

  await jugador.click();
  await expect(ficha).toHaveAttribute("closedby", "any");
  await page.mouse.click(5, 5);
  await expect(ficha).toBeHidden();
  await expect(jugador).toBeFocused();

  await jugador.press("Enter");
  await expect(ficha).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(ficha).toBeHidden();
  await expect(jugador).toBeFocused();
});

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
  // El selector de temporada solo sale si hay más de una para elegir.
  const temporada = page.getByLabel("Temporada", { exact: true });
  if (await temporada.count())
    expect(await temporada.locator("option").count()).toBeGreaterThan(1);

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
