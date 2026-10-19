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
  const categorias = page.getByRole("group", { name: "Categoría" });
  await expect(categorias).toBeHidden();
  await page.getByText("Cambiar partido o editar datos").click();
  // Un solo selector de partido: el de arriba, dentro del plegable, ya en Veteranos.
  await expect(categorias.getByRole("button", { name: "Veteranos" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByLabel("Jornada", { exact: true })).toHaveCount(1);
  await expect(page.getByLabel("Autocompletar desde la liga")).toHaveCount(0);
});

/**
 * Un partido nuestro ya jugado: no ofrece hacer convocatoria ni once, sí el acta. Y `?partido=`
 * abre ese mismo partido en su jornada.
 */
test("partidos: nuestro partido jugado lleva el acta y se abre por enlace", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/admin/partidos?categoria=Senior");
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
  const hoja = page.getByRole("dialog");
  const acta = hoja.getByRole("link", { name: /^(Corregir acta|Meter acta a mano)$/ });
  await expect(acta).toHaveAttribute("href", /\/admin\/actas\?.*partido=[^&]+/);
  await expect(hoja.getByRole("link", { name: /^Hacer (Convocatoria|Once)/ })).toHaveCount(0);
  const titulo = await hoja.getByRole("heading").first().textContent();
  const id = new URL((await acta.getAttribute("href"))!, page.url()).searchParams.get("partido")!;

  await page.goto(`/admin/partidos?partido=${encodeURIComponent(id)}`);
  const abierta = page.getByRole("dialog");
  await expect(abierta.getByRole("heading").first()).toHaveText(titulo!);
  await expect(page).not.toHaveURL(/partido=/);
  await abierta.getByRole("button", { name: "Cerrar partido" }).click();
  await expect(abierta).toBeHidden();
});
