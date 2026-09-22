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
// Calendario mantiene edición en línea. Equipos y Plantilla usan editores modales.
test("borrador bloquea sección, categoría y atrás sin perder texto", async ({ page }) => {
  await page.goto("/admin/temporadas");
  await page.getByRole("link", { name: "Calendario", exact: true }).click();
  await expect(page).toHaveURL(/jornada=/);
  const marcador = page.locator('input[type="number"]').first();
  await expect(marcador).toBeVisible();
  const nuevo = (await marcador.inputValue()) === "17" ? "18" : "17";
  await marcador.fill(nuevo);
  page.on("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("link", { name: "Jugadores", exact: true }).click();
  await expect(page).toHaveURL(/calendario/);
  await expect(marcador).toHaveValue(nuevo);
  await page
    .getByRole("group", { name: "Categoría deportiva" })
    .getByRole("button", { name: "Veteranos" })
    .click();
  await expect(page.getByRole("button", { name: "Senior", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(marcador).toHaveValue(nuevo);
  const blocked = page.waitForEvent("dialog");
  await page.evaluate(() => window.history.back());
  await blocked;
  await expect(page).toHaveURL(/calendario/);
  await expect(marcador).toHaveValue(nuevo);
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
  await page.goto("/admin/calendario");
  await expect(page).toHaveURL(/jornada=/);
  const marcador = page.locator('input[type="number"]').first();
  await expect(marcador).toBeVisible();
  const nuevo = (await marcador.inputValue()) === "17" ? "18" : "17";
  await marcador.fill(nuevo);
  let dialogs = 0;
  page.on("dialog", async (dialog) => {
    dialogs++;
    await dialog.dismiss();
  });
  await page.getByRole("link", { name: "Calendario", exact: true }).click();
  expect(dialogs).toBe(0);
  await page.getByRole("link", { name: "Jugadores", exact: true }).click();
  await expect.poll(() => dialogs).toBe(1);
  await expect(marcador).toHaveValue(nuevo);
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
  try {
    await page.goto("/admin/equipos");
    await expect(page.getByText("Cargando contexto deportivo…")).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear equipo", exact: true })).toHaveCount(0);
  } finally {
    release();
  }
  await expect(page).toHaveURL(/competicion=/);
  await page.getByRole("button", { name: "Crear equipo", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Crear equipo" });
  const input = editor.getByLabel("Nombre del equipo");
  await input.fill("Equipo pendiente");
  page.once("dialog", (dialog) => dialog.dismiss());
  await editor.getByRole("button", { name: "Cancelar" }).click();
  await expect(input).toHaveValue("Equipo pendiente");
  page.once("dialog", (dialog) => dialog.accept());
  await editor.getByRole("button", { name: "Cancelar" }).click();
  await expect(editor).toBeHidden();
});
