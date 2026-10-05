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
    test.fixme(
      seccion === "calendario",
      "Pendiente tarea 2: selectores y filas de Calendario desbordan el viewport móvil.",
    );
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

for (const seccion of ["actas", "importar-jornada"]) {
  test(`${seccion}: reservada a escritorio`, async ({ page }) => {
    await abrir(page, seccion);
    await expect(page.getByRole("status").filter({ hasText: "solo en escritorio" })).toBeVisible();
    await expect(page.locator("main input:visible")).toHaveCount(0);
    await comprobarAncho(page);
  });
}
