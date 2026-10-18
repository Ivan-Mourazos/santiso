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

/** Un partido nuestro ya pasado (no el de la mesa) también deja descargar y rehacer sus carteles. */
test("partidos: nuestro partido de otra jornada lleva sus carteles", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/admin/partidos?categoria=Veteranos");
  const jornada = page.getByRole("navigation", { name: "Jornada" });
  await expect(jornada.getByText(/^Jornada \d+$/)).toBeVisible();
  const anterior = jornada.getByRole("button", { name: "Jornada anterior" });
  test.skip(!(await anterior.isEnabled()), "Sin jornadas anteriores en los datos reales");
  const antes = await jornada.getByText(/^Jornada \d+$/).textContent();
  await anterior.click();
  await expect(jornada.getByText(/^Jornada \d+$/)).not.toHaveText(antes!);
  const nuestro = page.locator("button[data-propio]").first();
  test.skip((await nuestro.count()) === 0, "El Santiso descansó esa jornada");
  await nuestro.click();
  const carteles = page.getByRole("dialog").getByRole("region", { name: "Carteles del partido" });
  await expect(carteles).toBeVisible();
  const resultado = carteles.getByRole("link", { name: /^(Hacer|Rehacer) Resultado$/ });
  await expect(resultado).toHaveAttribute("href", /plantilla=resumo&partido=[^&]+/);
  // Veteranos no convoca ni alinea: no salen esos pasos.
  await expect(carteles.getByText("Convocatoria", { exact: true })).toHaveCount(0);
  for (const caja of await carteles
    .getByRole("link")
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect())))
    expect(caja.height).toBeGreaterThanOrEqual(44);
  await resultado.click();
  await expect(
    page.getByRole("banner").getByRole("heading", { level: 1, name: "Resultado" }),
  ).toBeVisible();
  // Llega con el partido puesto: su tarjeta arriba y los campos plegados para retocar.
  const elegido = page.getByRole("region", { name: "Partido del cartel" });
  await expect(elegido).toContainText(/\d+–\d+/);
  await expect(elegido).toContainText("Veteranos");
  await expect(page.getByLabel("Categoría")).toBeHidden();
  await page.getByText("Cambiar partido o editar datos").click();
  await expect(page.getByLabel("Categoría")).toHaveValue("Veteranos");
});
