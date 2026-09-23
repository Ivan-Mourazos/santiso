import { expect, test, type Page } from "@playwright/test";
import { vigilarSalidasAInternet } from "./red";

/**
 * Generador de carteles contra la base de datos real. **Solo lectura**: se cambia de plantilla y
 * se escribe en el formulario, que vive en memoria; nada de esto se guarda.
 */
const lienzo = (page: Page) => page.locator("canvas");
const plantilla = (page: Page) => page.getByLabel("Plantilla de cartel", { exact: true });

test("la pantalla monta el lienzo y las acciones de cada plantilla", async ({ page }) => {
  const errores: string[] = [];
  const externas = vigilarSalidasAInternet(page);
  page.on("pageerror", (error) => errores.push(error.message));

  await page.goto("/admin/carteles");
  await expect(plantilla(page)).toBeVisible({ timeout: 20000 });
  await expect(lienzo(page)).toBeVisible({ timeout: 20000 });

  // El lienzo se dibuja al doble de tamaño para que Instagram no lo estropee.
  await expect(lienzo(page)).toHaveAttribute("width", "2160");
  await expect(lienzo(page)).toHaveAttribute("height", "2700");

  await expect(page.getByRole("button", { name: /Descargar JPG/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Limpiar datos" })).toBeVisible();

  expect(errores).toEqual([]);
  expect(externas).toEqual([]);
});

test("cambiar de plantilla cambia el formulario y conserva el lienzo", async ({ page }) => {
  await page.goto("/admin/carteles");
  await expect(plantilla(page)).toBeVisible({ timeout: 20000 });

  // Partido: rival y datos del encuentro, con sus etiquetas asociadas al campo.
  await expect(page.getByLabel("Rival", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Fecha", { exact: true })).toBeVisible();

  await plantilla(page).selectOption("clasificacion");
  await expect(page).toHaveURL(/plantilla=clasificacion/);
  // Clasificación trae además el texto listo para Instagram, sin depender de los datos.
  await expect(page.getByText("Texto para Instagram")).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("button", { name: /Copiar/ })).toBeVisible();
  await expect(lienzo(page)).toBeVisible();

  await plantilla(page).selectOption("proximos");
  await expect(page).toHaveURL(/plantilla=proximos/);
  await expect(lienzo(page)).toBeVisible();
});

for (const ancho of [360, 1280]) {
  test(`la pantalla de carteles cabe a ${ancho}px`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 900 });
    await page.goto("/admin/carteles");
    await expect(lienzo(page)).toBeVisible({ timeout: 20000 });
    const desborda = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(desborda).toBe(false);
  });
}

test("la clasificación en modo manual se dibuja sin errores", async ({ page }) => {
  const errores: string[] = [];
  page.on("pageerror", (error) => errores.push(error.message));
  page.on("console", (mensaje) => {
    if (mensaje.type() === "error") errores.push(mensaje.text());
  });
  await page.goto("/admin/carteles?plantilla=clasificacion");
  await expect(lienzo(page)).toBeVisible({ timeout: 20000 });
  // Hasta el arreglo, las filas manuales guardaban «puntos» y la plantilla leía «pts»: el
  // dibujo reventaba con cada fila.
  await page.getByRole("button", { name: /Manual/ }).click();
  await page.waitForTimeout(2000);
  expect(errores).toEqual([]);
});
