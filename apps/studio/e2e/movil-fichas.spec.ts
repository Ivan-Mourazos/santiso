import { expect, test } from "@playwright/test";

/**
 * Fichas de equipo y jugador y el archivo de temporadas pasadas: se llega tocando un equipo o un
 * jugador, y caben en el móvil. Solo lee.
 */
const sinDeslizar = async (page: import("@playwright/test").Page) => {
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(ancho).toBeLessThanOrEqual(page.viewportSize()!.width);
};

test("fichas: de la clasificación a la ficha de un equipo", async ({ page }) => {
  await page.goto("/admin/clasificacion?categoria=Senior");
  const fila = page.getByRole("button", { name: /^Ver estadísticas de / }).first();
  await fila.waitFor({ timeout: 20000 }).catch(() => {});
  test.skip((await fila.count()) === 0, "Sin clasificación en los datos reales");
  await fila.tap();
  await page.getByRole("link", { name: "Ver la ficha completa" }).tap();
  await expect(page).toHaveURL(/\/admin\/equipo\?id=/);
  await expect(page.getByRole("heading", { level: 1, name: "Ficha de equipo" })).toBeVisible();
  const ficha = page.getByRole("article", { name: /^Ficha de / });
  await expect(ficha.getByRole("region", { name: "Club" })).toBeVisible();
  await sinDeslizar(page);
});

test("fichas: de la plantilla a la ficha completa de un jugador", async ({ page }) => {
  await page.goto("/admin/jugadores?categoria=Senior");
  const nombre = page.getByRole("button", { name: /^Ver ficha de / }).first();
  await nombre.waitFor({ timeout: 20000 }).catch(() => {});
  test.skip((await nombre.count()) === 0, "Sin jugadores en los datos reales");
  await nombre.tap();
  await page.getByRole("link", { name: "Ver la ficha completa" }).tap();
  await expect(page).toHaveURL(/\/admin\/jugador\?id=/);
  const ficha = page.getByRole("article", { name: /^Ficha de / });
  await expect(ficha.getByRole("region", { name: "En la federación" })).toBeVisible();
  await sinDeslizar(page);
});

test("fichas: el archivo de temporadas pasadas está en la hoja de Liga", async ({ page }) => {
  await page.goto("/admin/inicio");
  await page
    .getByRole("navigation", { name: "Accesos rápidos" })
    .getByRole("button", { name: "Liga", exact: true })
    .tap();
  await page.getByRole("dialog", { name: "Liga" }).getByRole("link", { name: "Archivo" }).tap();
  await expect(page).toHaveURL(/\/admin\/archivo/);
  await expect(page.getByRole("heading", { level: 1, name: "Archivo" })).toBeVisible();
  await sinDeslizar(page);
});
