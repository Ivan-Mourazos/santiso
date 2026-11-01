import { expect, test } from "@playwright/test";

test("otros clubes compacto a 360 px, elegir club sin red", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 780 });

  await page.goto("/admin/jugador?id=jugador-otros-clubes");

  const bloque = page.getByRole("region", { name: "Otros clubes", exact: true });

  await expect(bloque).toBeVisible({ timeout: 30000 });

  await expect(bloque).toContainText("2023-2024 · RIVAL FEDERATIVO Juvenil B");

  await expect(bloque).toContainText(
    "Primera Ficticia · 11 partidos · — goles · 3 amarillas · 0 rojas",
  );

  await expect(bloque).toContainText("Club por elegir");

  await bloque.scrollIntoViewIfNeeded();

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

  await page.screenshot({ path: testInfo.outputPath("otros-clubes-360.png"), fullPage: true });

  await bloque.getByRole("button", { name: "C.D. Rival Ficticio", exact: true }).click();

  await expect(bloque).toContainText("Buscando");

  await page.reload();

  await expect(bloque).toContainText("2022-2023 · C.D. Rival Ficticio");

  await expect(bloque).not.toContainText("Club por elegir");

  const codigo = bloque.getByRole("textbox", { name: "Código de equipo", exact: true });

  await codigo.fill("5120");

  await bloque.getByRole("button", { name: "Usar equipo", exact: true }).click();

  await page.reload();

  await expect(codigo).toHaveValue("5120");

  await expect(bloque).toContainText("Es el número de Codigo_Equipo");

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

  await bloque.evaluate((elemento) => elemento.scrollIntoView({ block: "center" }));
  await bloque.screenshot({ path: testInfo.outputPath("otros-clubes-equipo-360.png") });
});
