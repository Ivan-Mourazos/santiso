import { expect, test, type Page } from "@playwright/test";
import { vigilarSalidasAInternet } from "./red";

/**
 * Generador de carteles contra la base de datos real. **Solo lectura**: se cambia de plantilla y
 * se escribe en el formulario, que vive en memoria; nada de esto se guarda.
 */
/** El cartel de la previsualización (motor HTML/CSS). */
const lienzo = (page: Page) => page.locator("[data-vista-cartel] [data-cartel]");
const plantilla = (page: Page) => page.getByLabel("Plantilla de cartel", { exact: true });

test("la pantalla monta el cartel y las acciones de cada plantilla", async ({ page }) => {
  const errores: string[] = [];
  const externas = vigilarSalidasAInternet(page);
  page.on("pageerror", (error) => errores.push(error.message));

  await page.goto("/admin/carteles");
  await expect(plantilla(page)).toBeVisible({ timeout: 20000 });
  await expect(lienzo(page)).toBeVisible({ timeout: 20000 });

  await expect(page.getByRole("button", { name: "Descargar PNG" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Limpiar datos" })).toBeVisible();

  expect(errores).toEqual([]);
  expect(externas).toEqual([]);
});

test("cambiar de plantilla cambia el formulario y el cartel", async ({ page }) => {
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

// Solo escritorio (decisión del usuario, 28/09/2026): de monitor pequeño en adelante.
for (const ancho of [1280, 1920]) {
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

test("«Próximos encuentros» tiene dos huecos y desde Jornada se rellena solo", async ({ page }) => {
  await page.goto("/admin/carteles?plantilla=proximos");
  await expect(page.getByLabel("Rival del partido 2", { exact: true })).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByLabel("Rival del partido 3", { exact: true })).toHaveCount(0);

  await page.goto("/admin/jornada");
  await page.getByRole("link", { name: "Próximos encuentros" }).click();
  await expect(page).toHaveURL(/plantilla=proximos&rellenar=1/);
  // Con partidos pendientes, el primer hueco trae rival; si no, avisa de por qué.
  const rival = page.getByLabel("Rival del partido 1", { exact: true });
  await expect
    .poll(
      async () =>
        (await rival.inputValue()) !== "" ||
        (await page
          .getByRole("status")
          .filter({ hasText: /partidos pendientes/ })
          .count()) > 0,
      { timeout: 30000 },
    )
    .toBe(true);
});

test("el cartel se previsualiza y se descarga en PNG a 2160×2700", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/admin/carteles?plantilla=partido");
  const piloto = page.getByRole("region", { name: "Previsualización del cartel" });
  await expect(piloto).toBeVisible({ timeout: 30000 });
  await expect(piloto.locator("[data-vista-cartel] [data-cartel]")).toBeVisible();

  await piloto.getByRole("button", { name: "Enfrentados", exact: true }).click();
  await expect(piloto.locator("[data-cartel]")).toHaveClass(/enfrentados/);

  const descarga = page.waitForEvent("download", { timeout: 90000 });
  await piloto.getByRole("button", { name: "Descargar PNG" }).click();
  const fichero = await (await descarga).createReadStream();
  const trozos: Buffer[] = [];
  for await (const trozo of fichero) trozos.push(trozo as Buffer);
  const png = Buffer.concat(trozos);
  // Firma PNG y medidas de la cabecera IHDR.
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([2160, 2700]);
});

test("las siete plantillas tienen su cartel en el Estudio", async ({ page }) => {
  test.setTimeout(120000);
  for (const plantilla of [
    "partido",
    "resumo",
    "cronoloxia",
    "proximos",
    "noso11",
    "multiusos",
    "clasificacion",
  ]) {
    await page.goto(`/admin/carteles?plantilla=${plantilla}`);
    const piloto = page.getByRole("region", { name: "Previsualización del cartel" });
    await expect(piloto.locator("[data-vista-cartel] [data-cartel]"), plantilla).toBeVisible({
      timeout: 30000,
    });
  }
});
