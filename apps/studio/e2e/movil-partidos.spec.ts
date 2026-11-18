import { expect, test } from "@playwright/test";

/**
 * Liga → Partidos: abre en la jornada que toca, todos en filas y el nuestro el primero, sin pasos;
 * las flechas cambian de jornada y cada partido abre su detalle en una hoja. Solo lee.
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
    // Sin mesa ni pasos: si juega el Santiso, su fila es la primera.
    await expect(page.locator("[data-mesa-partido], [data-accion-principal]")).toHaveCount(0);
    if ((await page.locator("button[data-propio]").count()) > 0)
      await expect(filas.first()).toHaveAttribute("data-propio", "true");
    for (const caja of await filas.evaluateAll((els) => els.map((e) => e.getBoundingClientRect())))
      expect(caja.height).toBeGreaterThanOrEqual(44);
    await filas.first().click();
    const hoja = page.getByRole("dialog");
    await expect(hoja).toBeVisible();
    await expect(hoja.getByRole("link", { name: /^Ficha de / }).first()).toBeVisible();
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
  // Lo de después se hace junto, en el carrusel.
  await expect(resultado).toHaveAttribute("href", /plantilla=despues&partido=[^&]+/);
  // Veteranos no convoca ni alinea: no salen esos pasos.
  await expect(carteles.getByText("Convocatoria", { exact: true })).toHaveCount(0);
  for (const caja of await carteles
    .getByRole("link")
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect())))
    expect(caja.height).toBeGreaterThanOrEqual(44);
  await resultado.click();
  await expect(
    page.getByRole("banner").getByRole("heading", { level: 1, name: "Resultado e O Noso 11" }),
  ).toBeVisible();
  // Llega con el partido puesto: su tarjeta arriba y los campos plegados para retocar.
  const elegido = page.getByRole("region", { name: "Partido del cartel" });
  await expect(elegido).toContainText(/\d+–\d+/);
  await expect(elegido).toContainText("Veteranos");
  const categorias = page.getByRole("group", { name: "Categoría" });
  await expect(categorias).toBeHidden();
  // Desde el 16/11/2026 se abre con el lápiz ✎ de la tarjeta; el texto queda para lectores.
  await page.locator("summary", { hasText: "Cambiar partido o editar datos" }).click();
  // Un solo selector de partido: el de arriba, dentro del plegable, ya en Veteranos.
  await expect(categorias.getByRole("button", { name: "Veteranos" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByLabel("Jornada", { exact: true })).toHaveCount(1);
  await expect(page.getByLabel("Autocompletar desde la liga")).toHaveCount(0);
});

/**
 * Un partido nuestro ya jugado: no ofrece hacer convocatoria ni once, ni corregir el acta (manda
 * la federación). Y `?partido=` abre ese mismo partido en su jornada.
 */
test("partidos: nuestro partido jugado sin acta a mano y se abre por enlace", async ({ page }) => {
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
  await expect(hoja.getByRole("link", { name: /^(Corregir acta|Meter acta a mano)$/ })).toHaveCount(0);
  const directo = hoja.getByRole("link", { name: "Directo", exact: true });
  await expect(directo).toHaveAttribute("href", /\/admin\/directo\?.*partido=[^&]+/);
  await expect(hoja.getByRole("link", { name: /^Hacer (Convocatoria|Once)/ })).toHaveCount(0);
  const titulo = await hoja.getByRole("heading").first().textContent();
  const id = new URL((await directo.getAttribute("href"))!, page.url()).searchParams.get("partido")!;

  await page.goto(`/admin/partidos?partido=${encodeURIComponent(id)}`);
  const abierta = page.getByRole("dialog");
  await expect(abierta.getByRole("heading").first()).toHaveText(titulo!);
  await expect(page).not.toHaveURL(/partido=/);
  await abierta.getByRole("button", { name: "Cerrar partido" }).click();
  await expect(abierta).toBeHidden();
});

/** La barra de Liga lleva a Archivo y solo arrastra el contexto (categoría), no `j=` ni `id=`. */
test("partidos: la barra de Liga incluye Archivo y no arrastra parámetros ajenos", async ({
  page,
}) => {
  await page.goto("/admin/partidos?categoria=Veteranos&j=2");
  const liga = page.getByRole("navigation", { name: "Liga" });
  await expect(liga.getByRole("link", { name: "Archivo" })).toHaveAttribute(
    "href",
    "/admin/archivo?categoria=Veteranos",
  );
  await expect(liga.getByRole("link", { name: "Clasificación" })).toHaveAttribute(
    "href",
    "/admin/clasificacion?categoria=Veteranos",
  );
});
