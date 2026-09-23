import { expect, test } from "@playwright/test";

test("activar temporada exige confirmación y conserva la activa ante fallo", async ({ page }) => {
  await page.goto("/admin/temporadas");
  const active = page.getByText("Activa", { exact: true });
  await expect(active).toHaveCount(1);
  const current = (await active.locator("..").textContent()) ?? "";
  const activate = page.getByRole("button", { name: /Usar .* como temporada activa/ }).first();
  await activate.click();
  const dialog = page.getByRole("dialog", { name: "Confirmar acción" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(active.locator("..")).toHaveText(current);
  await activate.click();
  await page.route("**/admin/temporadas**", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await dialog.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(
    page.getByText("No se pudo activar la temporada. Vuelve a intentarlo.", { exact: true }),
  ).toBeVisible();
  await expect(active.locator("..")).toHaveText(current);
});

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
