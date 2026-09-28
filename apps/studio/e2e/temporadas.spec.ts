import { expect, test } from "@playwright/test";

test("crear temporada conserva nombre si falla y cabe en móvil", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/temporadas");
  // La lista también se carga con un POST: si se corta antes de que termine, la pantalla entra
  // en error y deshabilita «Crear». Se espera a la lista primero.
  await expect(page.getByText("Activa", { exact: true })).toBeVisible({ timeout: 30000 });
  const input = page.getByRole("textbox", { name: "Nombre de temporada" });
  await input.fill("2098/99");
  await page.route("**/admin/temporadas**", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await page.getByRole("button", { name: "Crear temporada", exact: true }).click();
  await expect(
    page.getByText("No se pudo crear la temporada. Tus datos siguen aquí.", { exact: true }),
  ).toBeVisible();
  await expect(input).toHaveValue("2098/99");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const width of [390, 1280])
  test(`temporadas visual ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin/temporadas");
    await expect(page.getByText("Activa", { exact: true })).toBeVisible();
    await page.screenshot({
      path: test.info().outputPath(`temporadas-${width}.png`),
      fullPage: true,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
