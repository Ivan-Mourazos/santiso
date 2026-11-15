import { expect, test } from "@playwright/test";

/**
 * La portada: solo el partido de cada equipo, que se abre al tocarlo, sin repetir el menú; cada pestaña de abajo
 * abre su hoja y desde ella se llega a la pantalla. Solo lee.
 */
const sinDeslizar = async (page: import("@playwright/test").Page) => {
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(ancho).toBeLessThanOrEqual(page.viewportSize()!.width);
};

for (const [ancho, alto] of [
  [360, 640],
  [390, 844],
] as const) {
  test(`inicio: solo los partidos, se abren al tocarlos, y cada pestaña abre su hoja a ${ancho}px`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: alto });
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/inicio/);
    // Solo los partidos: cada tarjeta, entera a la vista, sin pasos ni tareas.
    const partido = page.locator("[data-partido-inicio]").first();
    await expect(partido).toBeVisible();
    await expect(page.locator("[data-accion-principal]")).toHaveCount(0);
    const abrir = page.locator("[data-abrir-partido]");
    if (alto >= 800) {
      for (const tarjeta of await page.locator("[data-partido-inicio]").all()) {
        const caja = (await tarjeta.boundingBox())!;
        expect(caja.y + caja.height).toBeLessThanOrEqual(alto);
      }
    }
    await expect(page.getByRole("heading", { name: "¿Qué quieres hacer?" })).toHaveCount(0);
    await sinDeslizar(page);

    // Tocar la tarjeta abre ese partido en Liga → Partidos, con su detalle.
    await partido.tap();
    await expect(page).toHaveURL(/\/admin\/partidos/);
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Cerrar partido" }).tap();
    await page.goto("/admin/inicio");
    await expect(abrir.first()).toBeVisible();

    const pestanas = page.getByRole("navigation", { name: "Accesos rápidos" });
    // Carteles abre su hoja; de ahí, a la plantilla elegida.
    await pestanas.getByRole("button", { name: "Carteles", exact: true }).tap();
    const carteles = page.getByRole("dialog", { name: "Carteles" });
    await carteles.getByRole("link", { name: /^Resultado e O Noso 11/ }).tap();
    await expect(page).toHaveURL(/\/admin\/carteles\?.*plantilla=despues/);
    await expect(carteles).toBeHidden();
    await sinDeslizar(page);

    // Liga lleva primero a Partidos y, tocada otra vez, abre su hoja; Más, a la federación.
    await pestanas.getByRole("button", { name: "Liga", exact: true }).tap();
    await expect(page).toHaveURL(/\/admin\/partidos/);
    await pestanas.getByRole("button", { name: "Liga", exact: true }).tap();
    await page
      .getByRole("dialog", { name: "Liga" })
      .getByRole("link", { name: /^Goleadores/ })
      .tap();
    await expect(page).toHaveURL(/\/admin\/liga/);
    await pestanas.getByRole("button", { name: "Más", exact: true }).tap();
    await page
      .getByRole("dialog", { name: "Más" })
      .getByRole("link", { name: /^Federación/ })
      .tap();
    await expect(page).toHaveURL(/\/admin\/federacion/);
  });
}

test("inicio: la pestaña de abajo vuelve a la portada y Multas está en «Más»", async ({ page }) => {
  await page.goto("/admin/multas");
  await page.getByRole("link", { name: "Inicio", exact: true }).last().tap();
  await expect(page).toHaveURL(/\/admin\/inicio/);
  await expect(page.locator("[data-partido-inicio]").first()).toBeVisible();
  const pestanas = page.getByRole("navigation", { name: "Accesos rápidos" });
  await expect(pestanas.getByRole("link", { name: "Multas" })).toHaveCount(0);
  await pestanas.getByRole("button", { name: "Más", exact: true }).tap();
  await page
    .getByRole("dialog", { name: "Más" })
    .getByRole("link", { name: /^Multas/ })
    .tap();
  await expect(page).toHaveURL(/\/admin\/multas/);
});
