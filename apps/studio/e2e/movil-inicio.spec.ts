import { expect, test } from "@playwright/test";

/**
 * La portada: nuestros partidos arriba y, debajo, filas de categoría; se entra en una categoría,
 * se ven sus pantallas y se llega a la elegida. Solo lee.
 */
const sinDeslizar = async (page: import("@playwright/test").Page) => {
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(ancho).toBeLessThanOrEqual(page.viewportSize()!.width);
};

for (const [ancho, alto] of [
  [360, 640],
  [390, 844],
] as const) {
  test(`inicio: partidos, categorías y entrada a un cartel a ${ancho}px`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: alto });
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/inicio/);
    await expect(page.getByRole("heading", { name: "¿Qué quieres hacer?" })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: /^Carteles/ })).toBeVisible();
    // El partido que toca, con su siguiente paso, antes que el menú.
    const partido = page.locator("[data-partido-inicio]").first();
    await expect(partido).toBeVisible();
    const paso = (await partido.locator("[data-accion-principal]").boundingBox())!;
    expect(paso.height).toBeGreaterThanOrEqual(44);
    expect(paso.y + paso.height).toBeLessThanOrEqual(alto);
    await sinDeslizar(page);

    // Carteles entra directa a su catálogo, ordenado por momentos de la semana.
    await page.getByRole("main").getByRole("link", { name: /^Carteles/ }).tap();
    await expect(page).toHaveURL(/\/admin\/carteles/);
    await expect(page.getByRole("link", { name: /^Cronoloxía/ })).toBeVisible();
    await sinDeslizar(page);

    // Se vuelve a la portada y una categoría con varios destinos abre su lista.
    await page.goto("/admin/inicio");
    await expect(page.getByRole("heading", { name: "¿Qué quieres hacer?" })).toBeVisible();
    await page.getByRole("button", { name: /^La liga/ }).tap();
    await page.getByRole("link", { name: "Goleadores y tarjetas" }).tap();
    await expect(page).toHaveURL(/\/admin\/liga/);

    // La federación tiene su propio botón en la portada y entra directa.
    await page.goto("/admin/inicio");
    await page.getByRole("link", { name: /^Federación/ }).tap();
    await expect(page).toHaveURL(/\/admin\/federacion/);
  });
}

test("inicio: la pestaña de abajo vuelve a la portada", async ({ page }) => {
  await page.goto("/admin/multas");
  await page.getByRole("link", { name: "Inicio", exact: true }).last().tap();
  await expect(page).toHaveURL(/\/admin\/inicio/);
  await expect(page.locator("[data-partido-inicio]").first()).toBeVisible();
  await page
    .getByRole("link", { name: /^Multas/ })
    .first()
    .tap();
  await expect(page).toHaveURL(/\/admin\/multas/);
});
