import { expect, test } from "@playwright/test";

/**
 * Liga → Partidos: abre en la jornada que toca, con nuestro partido entero arriba si es el de la
 * mesa; las flechas cambian de jornada y cada partido abre su detalle en una hoja. Solo lee.
 */
for (const ancho of [360, 390]) {
  test(`partidos: jornada actual, flechas y detalle a ${ancho}px`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 800 });
    await page.goto("/admin/partidos?categoria=Senior");
    const liga = page.getByRole("navigation", { name: "Liga" });
    await expect(liga.getByRole("link", { name: "Partidos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const jornada = page.getByRole("navigation", { name: "Jornada" });
    await expect(jornada.getByText(/^Jornada \d+$/)).toBeVisible();
    for (const flecha of ["Jornada anterior", "Jornada siguiente"]) {
      const caja = (await jornada.getByRole("button", { name: flecha }).boundingBox())!;
      expect(caja.height).toBeGreaterThanOrEqual(44);
      expect(caja.width).toBeGreaterThanOrEqual(44);
    }
    const antes = await jornada.getByText(/^Jornada \d+$/).textContent();
    const anterior = jornada.getByRole("button", { name: "Jornada anterior" });
    if (await anterior.isEnabled()) {
      await anterior.click();
      await expect(jornada.getByText(/^Jornada \d+$/)).not.toHaveText(antes!);
      await expect(jornada.getByRole("button", { name: "Ir a la actual" })).toBeVisible();
    }
    const filas = page.getByRole("button", { name: /\S+ (\d+–\d+|contra) \S+/ });
    await expect(filas.first()).toBeVisible();
    for (const caja of await filas.evaluateAll((els) => els.map((e) => e.getBoundingClientRect())))
      expect(caja.height).toBeGreaterThanOrEqual(44);
    await filas.first().click();
    const hoja = page.getByRole("dialog");
    await expect(hoja).toBeVisible();
    await expect(hoja.getByText("Campo", { exact: true })).toBeVisible();
    await hoja.getByRole("button", { name: "Cerrar partido" }).click();
    await expect(hoja).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      ancho,
    );
  });
}
