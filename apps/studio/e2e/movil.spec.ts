import { expect, test, type Page } from "@playwright/test";

const SECCIONES = [
  "jornada",
  "calendario",
  "clasificacion",
  "estadisticas",
  "jugadores",
  "tecnicos",
  "directiva",
  "alineacion",
  "carteles",
  "actas",
  "importar-jornada",
  "equipos",
  "patrocinadores",
  "temporadas",
  "ajustes-graficos",
] as const;

async function abrir(page: Page, seccion: string) {
  // Solo consulta. No se pulsa ninguna acción que guarde en la base real.
  await page.goto(`/admin/${seccion}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/^(Preparando sección|Cargando sección)…$/)).toBeHidden();
  await page.waitForLoadState("networkidle");
}

async function comprobarAncho(page: Page) {
  const medidas = await page.evaluate(() => ({
    viewport: innerWidth,
    documento: document.documentElement.scrollWidth,
    cuerpo: document.body.scrollWidth,
    contenido: document.querySelector("main")!.scrollWidth,
    anchoContenido: document.querySelector("main")!.clientWidth,
  }));
  expect(medidas.documento).toBeLessThanOrEqual(medidas.viewport);
  expect(medidas.cuerpo).toBeLessThanOrEqual(medidas.viewport);
  expect(medidas.contenido).toBeLessThanOrEqual(medidas.anchoContenido);
}

for (const seccion of SECCIONES) {
  test(`${seccion}: sin desbordamiento ni errores de consola`, async ({ page }) => {
    const errores: string[] = [];
    page.on("pageerror", (error) => errores.push(error.message));
    page.on("console", (mensaje) => {
      if (mensaje.type() === "error") errores.push(mensaje.text());
    });
    await abrir(page, seccion);
    await comprobarAncho(page);
    expect(errores).toEqual([]);
  });
}

for (const ancho of [360, 390]) {
  test(`calendario: tarjetas y campos táctiles a ${ancho}px`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 844 });
    await abrir(page, "calendario");
    await comprobarAncho(page);
    const controles = page.locator("main input:visible, main select:visible, main button:visible");
    for (const control of await controles.all()) {
      const rect = (await control.boundingBox())!;
      expect(rect.width).toBeGreaterThanOrEqual(44);
      expect(rect.height).toBeGreaterThanOrEqual(44);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(ancho + 1);
      if (await control.evaluate((el) => el.matches("input, select"))) {
        expect(
          await control.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
        ).toBeGreaterThanOrEqual(16);
      }
    }
  });
}

for (const ancho of [360, 390]) {
  test(`marco táctil y cajón inferior a ${ancho}px`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 844 });
    await abrir(page, "equipos");
    const menuButton = page.getByRole("button", { name: "Menú", exact: true });
    const menuBox = (await menuButton.boundingBox())!;
    expect(menuBox.height).toBeGreaterThanOrEqual(44);
    expect(menuBox.y).toBeGreaterThan(650);
    const categories = page.getByRole("group", { name: "Categoría deportiva" });
    for (const category of ["Senior", "Veteranos"]) {
      expect(
        (await categories.getByRole("button", { name: category }).boundingBox())!.height,
      ).toBeGreaterThanOrEqual(44);
    }
    const campo = page.getByLabel("Buscar equipo", { exact: true });
    expect((await campo.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(
      await campo.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ).toBeGreaterThanOrEqual(16);
    await menuButton.click();
    const menu = page.getByRole("dialog", { name: "Menú de Studio" });
    await expect(menu).toBeVisible();
    const box = (await menu.boundingBox())!;
    expect(box.y + box.height).toBeGreaterThanOrEqual(834);
    expect(box.height).toBeLessThanOrEqual(844);
    expect(box.height).toBeLessThan(700);
    expect(box.width).toBeLessThanOrEqual(ancho);
    for (const link of await menu.getByRole("link").all()) {
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await menu.getByRole("button", { name: "Cerrar diálogo" }).click();
    await expect(menu).toBeHidden();
    await expect(menuButton).toBeFocused();
    await menuButton.click();
    await menu.getByRole("link", { name: "Ajustes gráficos", exact: true }).click();
    await expect(menu).toBeHidden();
    await expect(page).toHaveURL(/ajustes-graficos/);
    await comprobarAncho(page);
  });
}

for (const ancho of [360, 390]) {
  test(`clasificación: cinco columnas, detalle y borrador de zonas a ${ancho}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: ancho, height: 844 });
    await abrir(page, "clasificacion");
    const tabla = page.getByRole("table", { name: /^Clasificación de / });
    await expect(tabla).toBeVisible();
    await expect(tabla.getByRole("columnheader")).toHaveText(["#", "Equipo", "PTS", "PJ", "DG"]);
    const detalle = tabla.getByRole("button", { name: /^Ver estadísticas de / }).first();
    await detalle.click();
    await expect(detalle).toHaveAttribute("aria-expanded", "true");
    await expect(tabla.getByRole("region")).toContainText("Goles a favor");
    await comprobarAncho(page);
    await detalle.click();
    await expect(detalle).toHaveAttribute("aria-expanded", "false");
    await page.getByRole("button", { name: "Zonas de la clasificación", exact: true }).click();
    const dialogo = page.getByRole("dialog", { name: "Zonas de la clasificación", exact: true });
    // Solo borrador local: no se pulsa Guardar zonas contra datos reales.
    await dialogo.getByRole("button", { name: "Añadir zona", exact: true }).click();
    const rect = (await dialogo.boundingBox())!;
    expect(rect.width).toBeLessThanOrEqual(ancho);
    for (const control of await dialogo
      .locator("input:visible, select:visible, button:visible")
      .all()) {
      const box = (await control.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x + box.width).toBeLessThanOrEqual(ancho + 1);
    }
    page.once("dialog", (confirmacion) => confirmacion.accept());
    await dialogo.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(dialogo).toBeHidden();
    await comprobarAncho(page);
  });
}

test("categoría conserva contexto y diálogo de edición cabe en móvil", async ({ page }) => {
  await abrir(page, "equipos");
  await page.getByRole("button", { name: "Veteranos", exact: true }).click();
  await expect(page).toHaveURL(/categoria=Veteranos/);
  await expect(page.getByRole("button", { name: "Veteranos", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Crear equipo", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Crear equipo", exact: true });
  await expect(dialog).toBeVisible();
  const box = (await dialog.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(370);
  expect(box.height).toBeGreaterThanOrEqual(page.viewportSize()!.height - 24);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(844);
  const campo = dialog.getByRole("textbox").first();
  expect(
    await campo.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(16);
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(dialog).toBeHidden();
});

for (const ancho of [360, 390]) {
  test(`estadísticas: métricas, detalle y ordenación a ${ancho}px`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 844 });
    await abrir(page, "estadisticas");
    const tabla = page.getByRole("table", { name: /^Estadísticas de / });
    if ((await tabla.count()) === 0) {
      await expect(page.getByText(/^Todavía no hay datos de /)).toBeVisible();
      return;
    }
    const fila = tabla.locator("tbody tr").first();
    for (const etiqueta of ["Convocatorias", "Goles", "Amarillas", "Rojas"]) {
      await expect(fila.locator(`td[data-etiqueta="${etiqueta}"]`)).toBeVisible();
    }
    await expect(fila.locator('td[data-etiqueta="Titularidades"]')).toBeHidden();
    const detalle = fila.getByRole("button", { name: /^Más estadísticas de / });
    await detalle.click();
    await expect(fila.locator('td[data-etiqueta="Titularidades"]')).toBeVisible();
    await detalle.click();
    await expect(fila.locator('td[data-etiqueta="Titularidades"]')).toBeHidden();
    await page.getByLabel("Ordenar por", { exact: true }).selectOption("goles");
    const sentido = page.getByRole("button", {
      name: "Cambiar sentido de ordenación",
      exact: true,
    });
    await expect(sentido).toHaveText("Descendente");
    await sentido.click();
    await expect(sentido).toHaveText("Ascendente");
    await comprobarAncho(page);
  });
}

for (const seccion of ["actas", "importar-jornada"]) {
  test(`${seccion}: reservada a escritorio`, async ({ page }) => {
    await abrir(page, seccion);
    await expect(page.getByRole("status").filter({ hasText: "solo en escritorio" })).toBeVisible();
    await expect(page.locator("main input:visible")).toHaveCount(0);
    await comprobarAncho(page);
  });
}
