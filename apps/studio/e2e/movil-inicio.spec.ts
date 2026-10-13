import { expect, test } from "@playwright/test";

/**
 * La portada: botones de categoría que caben en la pantalla sin deslizar; se entra en una
 * categoría, se ven sus pantallas (también sin deslizar) y se llega a la elegida. Solo lee.
 */
const sinDeslizar = async (page: import("@playwright/test").Page) => {
  const [alto, ventana, ancho] = await page.evaluate(() => [
    document.documentElement.scrollHeight,
    window.innerHeight,
    document.documentElement.scrollWidth,
  ]);
  expect(alto).toBeLessThanOrEqual(ventana);
  expect(ancho).toBeLessThanOrEqual(page.viewportSize()!.width);
};

for (const [ancho, alto] of [
  [360, 640],
  [390, 844],
] as const) {
  test(`inicio: categorías sin deslizar y entrada a un cartel a ${ancho}px`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: alto });
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/inicio/);
    await expect(page.getByRole("heading", { name: "¿Qué quieres hacer?" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Carteles/ })).toBeVisible();
    await sinDeslizar(page);

    await page.getByRole("button", { name: /^Carteles/ }).tap();
    await expect(page.getByRole("heading", { name: "Carteles", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Cronoloxía" })).toBeVisible();
    await sinDeslizar(page);

    // Se vuelve a la portada y una categoría de un solo destino entra directa.
    await page.getByRole("button", { name: "‹ Inicio" }).tap();
    await expect(page.getByRole("heading", { name: "¿Qué quieres hacer?" })).toBeVisible();
    await page.getByRole("button", { name: /^La liga/ }).tap();
    await page.getByRole("link", { name: "Goleadores y tarjetas" }).tap();
    await expect(page).toHaveURL(/\/admin\/liga/);
  });
}

test("inicio: la pestaña de abajo vuelve a la portada", async ({ page }) => {
  await page.goto("/admin/multas");
  await page.getByRole("link", { name: "Inicio", exact: true }).last().tap();
  await expect(page).toHaveURL(/\/admin\/inicio/);
  await page
    .getByRole("link", { name: /^Multas/ })
    .first()
    .tap();
  await expect(page).toHaveURL(/\/admin\/multas/);
});
