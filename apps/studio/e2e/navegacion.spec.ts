import { expect, test } from "@playwright/test";
test("ruta, categoría y Directiva conservan contexto al recargar y volver", async ({ page }) => {
  await page.goto("/admin/jugadores?categoria=Veteranos");
  await expect(
    page
      .getByRole("group", { name: "Categoría deportiva" })
      .getByRole("button", { name: "Veteranos" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "Directiva", exact: true }).click();
  await expect(page).toHaveURL(/directiva.*categoria=Veteranos/);
  await expect(page.getByRole("group", { name: "Categoría deportiva" })).toHaveCount(0);
  await page.getByRole("link", { name: "Calendario", exact: true }).click();
  await expect(page).toHaveURL(/calendario.*categoria=Veteranos/);
  await page.reload();
  await expect(
    page
      .getByRole("group", { name: "Categoría deportiva" })
      .getByRole("button", { name: "Veteranos" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Directiva", exact: true, level: 1 }),
  ).toBeVisible();
});
// La guardia se prueba en Equipos porque tiene el formulario en línea. Jugadores lo tuvo hasta la
// 6B; desde entonces edita en un diálogo modal, que deja el menú inalcanzable mientras está
// abierto (su propia prueba de descarte está en plantilla.spec.ts).
test("borrador bloquea sección, categoría y atrás sin perder texto", async ({ page }) => {
  await page.goto("/admin/temporadas");
  await page.getByRole("link", { name: "Equipos", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Librería de Equipos (Senior)", exact: true }),
  ).toBeVisible();
  const name = page.getByPlaceholder("Ej: Racing de Ferrol").first();
  await name.fill("Borrador sin guardar");
  page.on("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("link", { name: "Calendario", exact: true }).click();
  await expect(page).toHaveURL(/equipos/);
  await expect(name).toHaveValue("Borrador sin guardar");
  await page
    .getByRole("group", { name: "Categoría deportiva" })
    .getByRole("button", { name: "Veteranos" })
    .click();
  await expect(name).toHaveValue("Borrador sin guardar");
  const blocked = page.waitForEvent("dialog");
  await page.evaluate(() => window.history.back());
  await blocked;
  await expect(page).toHaveURL(/equipos/);
  await expect(name).toHaveValue("Borrador sin guardar");
});
for (const width of [360, 390])
  test(`menú móvil accesible a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/admin/temporadas");
    await page.getByRole("button", { name: "Menú", exact: true }).click();
    const menu = page.getByRole("dialog", { name: "Menú de Studio" });
    await expect(menu).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`menu-${width}.png`), fullPage: true });
    await menu.getByRole("link", { name: "Ajustes gráficos", exact: true }).click();
    await expect(menu).not.toBeVisible();
    await expect(page).toHaveURL(/ajustes-graficos/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
test("rutas desconocidas no muestran un panel incorrecto", async ({ request }) => {
  const response = await request.get("/admin/no-existe");
  expect(response.status()).toBe(404);
});

test("el marcador sin guardar bloquea cambiar de sección", async ({ page }) => {
  await page.goto("/admin/calendario");
  await expect(page.getByRole("button", { name: "Guardar", exact: true }).first()).toBeVisible();
  await expect(page).toHaveURL(/jornada=/);
  const score = page.locator('input[type="number"]').first();
  await score.fill("17");
  const prompt = page.waitForEvent("dialog");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("link", { name: "Jugadores", exact: true }).click();
  await prompt;
  await expect(page).toHaveURL(/calendario/);
  await expect(score).toHaveValue("17");
  await page.route("**/admin/calendario**", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await page.getByRole("button", { name: "Guardar", exact: true }).first().click();
  await expect(
    page.getByText(
      "No se pudieron guardar todos los cambios. Revisa el partido y vuelve a intentarlo.",
    ),
  ).toBeVisible();
  await expect(score).toHaveValue("17");
});

test("pulsar la sección actual conserva la guardia", async ({ page }) => {
  await page.goto("/admin/equipos");
  await expect(
    page.getByRole("heading", { name: "Librería de Equipos (Senior)", exact: true }),
  ).toBeVisible();
  const input = page.getByPlaceholder("Ej: Racing de Ferrol").first();
  await input.fill("Borrador conservado");
  let dialogs = 0;
  page.on("dialog", async (dialog) => {
    dialogs++;
    await dialog.dismiss();
  });
  await page.getByRole("link", { name: "Equipos", exact: true }).click();
  expect(dialogs).toBe(0);
  await page.getByRole("link", { name: "Calendario", exact: true }).click();
  expect(dialogs).toBe(1);
  await expect(input).toHaveValue("Borrador conservado");
});

test("el calendario PDF mantiene Veteranos al cargar competiciones", async ({ page }) => {
  await page.goto("/admin/importar-jornada?origen=calendario");
  const category = page.locator("#cal-categoria");
  await category.selectOption("Veteranos");
  await expect(page.locator("#cal-competicion option")).not.toHaveCount(1);
  await page.locator("#cal-competicion").selectOption({ index: 1 });
  await expect(category).toHaveValue("Veteranos");
  await expect(page).not.toHaveURL(/competicion=/);
});

test("Equipos espera a resolver contexto antes de permitir edición", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/admin/equipos**", async (route) => {
    if (route.request().method() === "POST") await gate;
    await route.continue();
  });
  await page.goto("/admin/equipos");
  await expect(page.getByText("Cargando contexto deportivo…")).toBeVisible();
  await expect(page.locator("form input")).toHaveCount(0);
  release();
  await expect(page).toHaveURL(/competicion=/);
  const input = page.locator("form input").first();
  await input.fill("Equipo pendiente");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("link", { name: "Jugadores", exact: true }).click();
  await expect(input).toHaveValue("Equipo pendiente");
});
