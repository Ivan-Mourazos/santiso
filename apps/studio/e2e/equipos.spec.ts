import { expect, test, type Page } from "@playwright/test";

async function biblioteca(page: Page) {
  await page.goto("/admin/equipos?categoria=Senior");
  await page.getByRole("button", { name: "Biblioteca de Senior", exact: true }).click();
  await expect(page.getByRole("table", { name: "Equipos Senior" })).toBeVisible();
}

test("búsqueda y filtro sin escudo consultan la biblioteca sin escribir", async ({ page }) => {
  await biblioteca(page);
  const contador = page.getByRole("status").filter({ hasText: /equipos/ });
  const inicial = await contador.textContent();
  await page.getByLabel("Buscar equipo", { exact: true }).fill("zzzz-no-existe");
  await expect(page.getByText("Ningún equipo coincide con los filtros.")).toBeVisible();
  await page.getByRole("button", { name: "Quitar filtros" }).click();
  await expect(contador).toHaveText(inicial ?? "");
  const sinEscudo = await page
    .getByRole("table")
    .getByRole("img", { name: "Sin escudo", exact: true })
    .count();
  await page.getByRole("checkbox", { name: "Sin escudo", exact: true }).check();
  await expect(contador).toHaveText(new RegExp(`^${sinEscudo} de `));
  await expect(page.locator("table img")).toHaveCount(0);
});

for (const ancho of [360, 1280]) {
  test(`Equipos y editor caben a ${ancho}px y protegen borrador`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: ancho, height: 900 });
    await biblioteca(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      ancho,
    );
    await page.screenshot({ path: testInfo.outputPath(`equipos-${ancho}.png`) });
    const boton = page.getByRole("button", { name: /^Editar a / }).first();
    await boton.click();
    const editor = page.getByRole("dialog", { name: /^Editar a / });
    const nombre = editor.getByLabel("Nombre del equipo");
    await nombre.fill("Borrador sin guardar");
    expect(await editor.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`editor-${ancho}.png`) });
    page.once("dialog", (dialog) => dialog.dismiss());
    await editor.getByRole("button", { name: "Cancelar" }).click();
    await expect(nombre).toHaveValue("Borrador sin guardar");
    page.once("dialog", (dialog) => dialog.accept());
    await page.keyboard.press("Escape");
    await expect(editor).toBeHidden();
    await expect(boton).toBeFocused();
  });
}

test("un error de lectura permite reintentar sin simular una biblioteca vacía", async ({
  page,
}) => {
  await page.route("**/admin/equipos**", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await page.goto("/admin/equipos");
  await expect(page.getByText("No se pudo cargar el contexto", { exact: true })).toBeVisible();
  await expect(page.getByText("La biblioteca está vacía.")).toHaveCount(0);
  await page.unroute("**/admin/equipos**");
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  // El catálogo también falló en paralelo; ofrece su propio reintento.
  if (
    await page.getByText("No se pudo cargar el catálogo de equipos.", { exact: true }).isVisible()
  ) {
    await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  }
  await expect(page.getByLabel("Buscar equipo", { exact: true })).toBeVisible();
});
