import { expect, test } from "@playwright/test";
import { vigilarSalidasAInternet } from "./red";

/**
 * Plantilla por temporada, contra la base de datos real. **Solo lectura**: abre diálogos y los
 * cancela, para no tocar la temporada de verdad del usuario. Las escrituras se prueban en
 * `plantilla-escritura.spec.ts`, sobre una carpeta de datos temporal.
 */
test("la plantilla es por temporada y la nueva se construye desde la anterior", async ({
  page,
}) => {
  const errores: string[] = [];
  const externas = vigilarSalidasAInternet(page);
  page.on("pageerror", (error) => errores.push(error.message));

  await page.goto("/admin/jugadores?categoria=Senior");
  const temporada = page.getByLabel("Temporada", { exact: true });
  await expect(temporada).toBeVisible({ timeout: 20000 });

  // 2025/26 conserva su plantilla, con sus dorsales.
  await temporada.selectOption({ label: "2025/26" });
  await expect(page.getByText("Lo que cambies se guarda en esa temporada")).toBeVisible();
  const tabla = page.getByRole("table", { name: "Plantilla Senior 2025/26" });
  await expect(tabla).toBeVisible({ timeout: 20000 });
  expect(await tabla.getByRole("row").count()).toBeGreaterThan(1);

  // El buscador filtra sin tocar nada y el contador lo dice.
  const contador = page.getByRole("status").filter({ hasText: "jugadores" });
  const total = await contador.textContent();
  await page.getByLabel("Buscar", { exact: true }).fill("zzzz-nadie");
  await expect(page.getByText("Ningún jugador coincide con la búsqueda.")).toBeVisible();
  await page.getByRole("button", { name: "Quitar filtros" }).click();
  await expect(contador).toHaveText(total ?? "");

  // La activa se puede traer de la anterior.
  await temporada.selectOption({ label: "2026/27 (activa)" });
  const anadir = page.getByRole("button", { name: /Añadir de 2025\/26/ }).first();
  await expect(anadir).toBeVisible({ timeout: 20000 });
  await anadir.click();
  const dialogo = page.getByRole("dialog", { name: "Añadir de 2025/26" });
  await expect(dialogo).toBeVisible();
  const casillas = dialogo.locator('li input[type="checkbox"]');
  await casillas.first().check();
  await expect(dialogo.getByRole("button", { name: "Añadir 1" })).toBeEnabled();
  await dialogo.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialogo).toBeHidden();

  // Femenino vuelve a poder consultarse en Plantilla.
  await expect(page.getByRole("button", { name: "Femenino", exact: true })).toBeVisible();

  expect(errores).toEqual([]);
  expect(externas).toEqual([]);
});

test("cerrar el editor con cambios pide descartarlos", async ({ page }) => {
  await page.goto("/admin/jugadores?categoria=Senior");
  const temporada = page.getByLabel("Temporada", { exact: true });
  await expect(temporada).toBeVisible({ timeout: 20000 });
  await temporada.selectOption({ label: "2025/26" });
  await page
    .getByRole("button", { name: /^Editar a / })
    .first()
    .click();

  const editor = page.getByRole("dialog", { name: /^Editar a / });
  await expect(editor).toBeVisible();
  const apodo = editor.getByLabel("Apodo", { exact: true });
  await apodo.fill("Borrador de prueba");

  // Se rechaza el descarte: el editor sigue abierto y conserva lo escrito.
  page.once("dialog", (d) => d.dismiss());
  await editor.getByRole("button", { name: "Cancelar" }).click();
  await expect(editor).toBeVisible();
  await expect(apodo).toHaveValue("Borrador de prueba");

  // Se acepta: se cierra sin guardar.
  page.once("dialog", (d) => d.accept());
  await editor.getByRole("button", { name: "Cancelar" }).click();
  await expect(editor).toBeHidden();
});

for (const ancho of [360, 1280]) {
  test(`listado y editor de plantilla caben a ${ancho}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: ancho, height: 900 });
    await page.goto("/admin/jugadores?categoria=Senior");
    await page.getByLabel("Temporada", { exact: true }).selectOption({ label: "2025/26" });
    await expect(page.getByRole("table")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      ancho,
    );
    await page
      .getByRole("button", { name: /^Editar a / })
      .first()
      .click();
    const editor = page.getByRole("dialog", { name: /^Editar a / });
    await expect(editor).toBeVisible();
    expect(await editor.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`plantilla-${ancho}.png`), fullPage: true });
    await editor.getByRole("button", { name: "Cancelar" }).click();
  });
}
